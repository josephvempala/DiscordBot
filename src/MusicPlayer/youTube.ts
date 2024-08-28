import {Readable} from 'node:stream';
import ytpl from 'ytpl';
import ytsr from '@distube/ytsr';
import {IBasicVideoInfo, VideoInfoType} from '../Interfaces/IBasicVideoInfo';
import {GetAudioStreamResult} from '../Interfaces/GetAudioStreamResult';
import {cacheStream, getCachedStream} from '../services/filecache';
import {exec, spawn} from 'child_process';
import {join} from 'path';
import * as fs from 'fs';
import https from 'https';
import querystring from 'querystring';

import {arch} from 'os';
import {downloadFile} from '../lib/util';

const system = arch();
let ytdlpPath = '';

export function initialize() {
	return new Promise<void>((resolve, reject) => {
		if (ytdlpPath) return resolve();
		try {
			switch (system) {
				case 'arm64':
					if (process.platform !== 'linux') {
						throw Error('Unsupported platform');
					} else {
						const binaryPath = join(__dirname, 'ytdlp');
						if (fs.existsSync(binaryPath)) {
							fs.chmodSync(binaryPath, 0o755);
							ytdlpPath = binaryPath;
							console.log('ytdlp found');
							resolve();
							return;
						}
						return new Promise<void>((res, reject) => {
							downloadFile('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux_aarch64', binaryPath).then(() => {
								ytdlpPath = binaryPath;
								console.log('ytdlp downloaded');
								res();
							});
						});
					}
				case 'x64':
					if (process.platform === 'win32') {
						if (fs.existsSync('ytdlp.exe')) {
							ytdlpPath = 'ytdlp.exe';
							resolve();
							return;
						}
						return new Promise<void>((res, reject) => {
							downloadFile('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe', 'ytdlp.exe').then(() => {
								ytdlpPath = 'ytdlp.exe';
								res();
							});
						});
					} else if (process.platform === 'linux') {
						const binaryPath = join(__dirname, 'ytdlp');
						if (fs.existsSync(binaryPath)) {
							fs.chmodSync(binaryPath, 0o755);
							ytdlpPath = binaryPath;
							console.log('ytdlp found');
							resolve();
							return;
						}
						return new Promise<void>((res, reject) => {
							downloadFile('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux', binaryPath).then(() => {
								ytdlpPath = join(__dirname, 'ytdlp');
								console.log('ytdlp downloaded');
								res();
								return;
							});
						});
					} else {
						throw new Error('Unsupported platform');
					}
				default:
					throw new Error('Unsupported platform');
			}
		} catch (e) {
			reject(e);
		}
	});
}

function getYouTubeVideoId(query: string): Promise<string> {
	if (query.startsWith('https://www.youtube.com/watch?v=')) {
		const url = new URL(query);
		return Promise.resolve(url.searchParams.get('v')!);
	}
	const url = `https://www.youtube.com/results?search_query=${querystring.escape(query)}`;
	return new Promise((resolve, reject) => {
		const req = https
			.get(url, (res) => {
				let data = '';
				res.on('data', (chunk) => {
					data += chunk;
				});
				res.on('end', () => {
					const regex = /(?:\[{"v.*?:")(.{11})/;
					const match = data.match(regex);
					if (match && match[1]) {
						resolve(match[1]);
					} else {
						reject(new Error('No match found'));
					}
				});
			})
			.on('error', (err) => {
				reject(err);
			});
	});
}

function getYtdlpStream(ytId: string): Readable | null {
	if (!ytdlpPath) return null;
	const ytdlp = spawn(
		ytdlpPath,
		['--extractor-args', 'youtube:player_client=ios,web,android', '--buffer-size', '64k', '-f', 'ba*', '--audio-quality', '0', '-o', '-', ytId],
		{
			shell: true,
			stdio: ['ignore', 'pipe', 'pipe'],
		},
	);
	ytdlp.stderr.on('data', (data) => {
		console.error(data.toString());
	});
	return ytdlp.stdout;
}

export async function getYoutubeAudioStream(url: string): Promise<GetAudioStreamResult> {
	try {
		const cachedStream = await getCachedStream(url);
		if (cachedStream) return [cachedStream, null];
		await initialize();
		const videoInfo = await getYouTubeVideoId(url);
		if (!videoInfo) return [null, 'Unable to get video info'];
		const stream = getYtdlpStream(videoInfo);
		if (!stream) return [null, 'Unable to get YouTube audio stream'];
		stream.on('error', (e: any) => {
			console.log(e);
		});
		// if (!videoInfo.videoDetails.isLiveContent || +videoInfo.videoDetails.lengthSeconds > 1000) return [cacheStream(stream, url)!, null];
		return [stream, null];
	} catch (e) {
		console.error(e);
		return [null, 'Error occurred while getting YouTube audio stream'];
	}
}

export async function parseYouTubePlayParameter(param: string): Promise<IBasicVideoInfo[] | null> {
	const result: IBasicVideoInfo[] = [];
	try {
		const playlistID = await ytpl.getPlaylistID(param).catch(() => null);
		if (playlistID) {
			const playlistQueryResult = await ytpl(playlistID);
			playlistQueryResult.items.map((x) =>
				result.push({
					url: x.url,
					title: x.title,
					length: x.durationSec!,
					type: VideoInfoType.YouTube,
					isLiveStream: x.isLive,
				}),
			);
			return result;
		}
		const basicVideoInfo = await getYouTubeVideoId(param).catch(() => null);
		if (basicVideoInfo)
			return [
				{
					url: basicVideoInfo,
					title: param,
					length: 0,
					type: VideoInfoType.YouTube,
					isLiveStream: false,
				},
			];
	} catch (e: any) {
		console.log(e);
		return null;
	}
	return null;
}

// export async function getYoutubeSearchResultInfo(param: string) {
//     try {
//         const filter = await ytsr.getFilters(param).then((x) => x.get('Type')!.get('Video'));
//         if (!filter || !filter.url) return null;
//         const finalLinks = await ytsr(filter.url, {limit: 5}).catch(() => null);
//         if (finalLinks) {
//             const items = finalLinks.items.map(async (x) => {
//                 const item = x as Video;
//                 const duration = item.duration
//                     ?.split(':')
//                     .map((x) => +x)
//                     .reverse()
//                     .reduce((x, y, z) => x + y * (z * 60));
//                 return {
//                     url: item.url,
//                     title: item.title,
//                     length: duration,
//                     type: VideoInfoType.YouTube,
//                     isLiveStream: item.isLive,
//                 } as IBasicVideoInfo;
//             });
//             return await Promise.all(items);
//         }
//     } catch (e: any) {
//         console.log(e);
//         return null;
//     }
//     return null;
// }

export async function getYoutubeSearchResult(param: string, limit: number): Promise<IBasicVideoInfo[] | null> {
	try {
		const result = (
			await ytsr(param, {
				safeSearch: false,
				limit,
			})
		).items[0];
		return [
			{
				url: result.url,
				title: result.name,
				length: result.duration
					?.split(':')
					.map((x) => +x)
					.reverse()
					.reduce((x, y, z) => x + y * (z * 60)),
				type: VideoInfoType.YouTube,
				isLiveStream: result.isLive,
			},
		];
	} catch (e: any) {
		console.log(e);
		return null;
	}
}
