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
    url:string,
    title:string,
    length:number
}

export async function getYoutubeAudioStream(url : string) : Promise<GetAudioStreamSuccess | null> {
    try{
        const videoInfo = await getInfo(url).catch(x => null);
        if(!videoInfo)
            return null;
        const stream = downloadFromInfo(videoInfo!, {filter:"audioonly", highWaterMark: 1<<25 })
            .on("error",(e : any)=>{
                if(e.statusCode! === 403||410){
                    return null;
                }
                console.log(e);
            });
        return { stream: stream, videoInfo: videoInfo!};
    }
    catch (e){
        console.error(e);
        return null;
    }
}

export async function parseYouTubePlayParameter(param : string) : Promise<basicVideoInfo[] | null>{
    const result : basicVideoInfo[] = [];
    try{
        const playlistID = await ytpl.getPlaylistID(param).catch(() => null);
        if(playlistID){
            const playlistQueryResult = await ytpl(playlistID);
            playlistQueryResult.items.map(x => result.push({url : x.url, title : x.title, length: x.durationSec!}));
            return result;
        }
        const basicVideoInfo = await getBasicInfo(param).catch(() => null);
        if(basicVideoInfo) return [{url: param, title: basicVideoInfo.player_response.videoDetails.title, length : +basicVideoInfo.videoDetails.lengthSeconds}];
        const searchStringResult = await ytsr.getFilters(param)
            .then(x => x.get('Type')!.get('Video'))
            .catch(() => null);
        if(!searchStringResult?.url)
            return null;
        const finalLinks = await ytsr(searchStringResult.url, {limit:1}).catch(() => null);
        if(finalLinks){
            const link = finalLinks.items[0] as basicVideoInfo;
            const basicVideoInfo = await getBasicInfo(link.url).catch(() => null);
            return [{url:link.url, title : link.title, length:+basicVideoInfo!.videoDetails.lengthSeconds}]
        }
    }
    catch (e : any){
        console.log(e);
        return null;
    }
    return null;
}