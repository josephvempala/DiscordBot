import {Readable} from "node:stream";
import {videoInfo} from "ytdl-core";
import {downloadFromInfo, getInfo, getBasicInfo} from 'ytdl-core-discord';
import ytpl from "ytpl";
import ytsr from "ytsr";

interface GetAudioStreamSuccess{
    stream : Readable;
    videoInfo: videoInfo;
}

export interface basicVideoInfo{
    url: string,
    title:string
}

export async function getYoutubeAudioStream(url : string) : Promise<GetAudioStreamSuccess | null> {
    for (let i=0;i<5;i++){
        try{
            const videoInfo = await getInfo(url);
            return { stream: downloadFromInfo(videoInfo, {quality: "highestaudio", filter:"audioonly", highWaterMark: 1<<25}), videoInfo: videoInfo};
        }
        catch (e){
            console.error(e);
        }
    }
    return null;
}

export async function parseYouTubePlayParameter(param : string) : Promise<basicVideoInfo[] | null>{
    const result : basicVideoInfo[] = [];
    const playlistID = await ytpl.getPlaylistID(param).catch(() => null);
    if(playlistID){
        const playlistQueryResult = await ytpl(playlistID);
        playlistQueryResult.items.map(x => result.push({url : x.url, title : x.title}));
        return result;
    }
    const basicVideoInfo = await getBasicInfo(param).catch(() => null );
    if(basicVideoInfo) return [{url: param, title: basicVideoInfo.player_response.videoDetails.title}];
    const searchStringResult = await ytsr.getFilters(param);
    const filterResult = searchStringResult.get('Type')!.get('Video');
    const finalLinks = await ytsr(filterResult!.url!, {limit:1});
    if(finalLinks){
        const link = finalLinks.items[0] as basicVideoInfo;
        return  [{url:link.url, title : link.title}]
    }
    return null;
}