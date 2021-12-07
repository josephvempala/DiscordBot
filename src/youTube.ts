import {Readable} from "node:stream";
import {chooseFormat, downloadFromInfo, getBasicInfo, getInfo} from 'ytdl-core-discord';
import ytpl from "ytpl";
import ytsr, {Video} from "ytsr";
import {IBasicVideoInfo, VideoInfoType} from "./IBasicVideoInfo";
import {GetAudioStreamResult} from "./GetAudioStreamResult";

export async function getYoutubeAudioStream(url: string): Promise<GetAudioStreamResult> {
    try {
        let stream: Readable;
        const videoInfo = await getInfo(url).catch(() => null);
        if (!videoInfo)
            return [null, 'Unable to get video info'];
        if (videoInfo.videoDetails.isLiveContent) {
            const format = chooseFormat(videoInfo.formats, {quality: [128, 127, 120, 96, 95, 94, 93]});
            stream = downloadFromInfo(videoInfo, {highWaterMark: 1 << 25, liveBuffer: 4900, format: format});
        } else {
            stream = downloadFromInfo(videoInfo, {filter: "audioonly", highWaterMark: 1 << 25});
        }
        stream.on("error", (e: any) => {
            if (e.statusCode! === 403 || 410) {
                return null;
            }
            console.log(e);
        });
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
            playlistQueryResult.items.map(x => result.push({
                url: x.url,
                title: x.title,
                length: x.durationSec!,
                type: VideoInfoType.YouTube,
                isLiveStream: x.isLive
            }));
            return result;
        }
        const basicVideoInfo = await getBasicInfo(param).catch(() => null);
        if (basicVideoInfo) return [{
            url: param,
            title: basicVideoInfo.player_response.videoDetails.title,
            length: +basicVideoInfo.videoDetails.lengthSeconds,
            type: VideoInfoType.YouTube,
            isLiveStream: +basicVideoInfo.videoDetails.lengthSeconds == 0
        }];
    } catch (e: any) {
        console.log(e);
        return null;
    }
    return null;
}

export async function getYoutubeSearchResultInfo(param: string) {
    try {
        const filter = await ytsr.getFilters(param).then(x=> x.get('Type')!.get('Video'));
        if(!filter || !filter.url) return null;
        const finalLinks = await ytsr(filter.url, {limit: 5}).catch(() => null);
        if (finalLinks) {
            const items = finalLinks.items.map(async (x) => {
                const item = x as Video;
                const duration = item.duration?.split(':')
                    .map(x=>+x)
                    .reverse()
                    .reduce((x,y,z) => 
                        x+(y*(z*60))
                    );
                return {
                    url: item.url,
                    title: item.title,
                    length: duration,
                    type: VideoInfoType.YouTube,
                    isLiveStream: item.isLive
                } as IBasicVideoInfo;
            });
            return await Promise.all(items);
        }
    } catch (e: any) {
        console.log(e);
        return null;
    }
    return null;
}

export async function getYoutubeSearchResult(param: string): Promise<IBasicVideoInfo[] | null> {
    try {
        const filter = await ytsr.getFilters(param).then(x=> x.get('Type')!.get('Video'));
        if(!filter || !filter.url) return null;
        const finalLinks = await ytsr(param, {limit: 1}).catch(() => null);
        if (finalLinks) {
            const link = finalLinks.items[0] as Video;
            const duration = link.duration?.split(':')
                .map(x=>+x)
                .reverse()
                .reduce((x,y,z) =>
                    x+(y*(z*60))
                );
            return [{
                url: link.url,
                title: link.title,
                length: duration!,
                type: VideoInfoType.YouTube,
                isLiveStream: link.isLive
            }]
        }
    } catch (e: any) {
        console.log(e);
        return null;
    }
    return null;
}