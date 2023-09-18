import {Readable} from 'node:stream';
import {default as ytdl, chooseFormat, downloadFromInfo, getBasicInfo, getInfo} from 'ytdl-core';
import ytpl from 'ytpl';
import ytsr from '@yimura/scraper';
import {IBasicVideoInfo, VideoInfoType} from '../Interfaces/IBasicVideoInfo';
import {GetAudioStreamResult} from '../Interfaces/GetAudioStreamResult';
import {cacheStream, getCachedStream} from '../services/filecache';

const search = new ytsr.Scraper();

export async function getYoutubeAudioStream(url: string): Promise<GetAudioStreamResult> {
	try {
		let stream: Readable;
		const cachedStream = await getCachedStream(url);
		if (cachedStream) return [cachedStream, null];
		const videoInfo = await getInfo(url);
		if (!videoInfo) return [null, 'Unable to get video info'];
		if (videoInfo.videoDetails.isLiveContent) {
			const format = chooseFormat(videoInfo.formats, {quality: [128, 127, 120, 96, 95, 94, 93]});
			stream = downloadFromInfo(videoInfo, {highWaterMark: 1 << 25, liveBuffer: 4900, format: format});
		} else {
			stream = ytdl(videoInfo.videoDetails.video_url, {filter: 'audioonly', highWaterMark: 1 << 25});
		}
		stream.on('error', (e: any) => {
			console.log(e);
		});
		if (!videoInfo.videoDetails.isLiveContent || +videoInfo.videoDetails.lengthSeconds > 1000) return [cacheStream(stream, url)!, null];
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
		const basicVideoInfo = await getBasicInfo(param).catch(() => null);
		if (basicVideoInfo)
			return [
				{
					url: param,
					title: basicVideoInfo.player_response.videoDetails.title,
					length: +basicVideoInfo.videoDetails.lengthSeconds,
					type: VideoInfoType.YouTube,
					isLiveStream: +basicVideoInfo.videoDetails.lengthSeconds == 0,
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

export async function getYoutubeSearchResult(param: string): Promise<IBasicVideoInfo[] | null> {
	try {
		return [
			(
				await search.search(param, {
					language: 'en-GB',
					searchType: 'VIDEO',
				})
			).videos.map((x) => ({
				url: x.link,
				title: x.title,
				length: x.duration,
				type: VideoInfoType.YouTube,
				isLiveStream: false,
			}))[0],
		];
	} catch (e: any) {
		console.log(e);
		return null;
	}
}
