import {Readable} from "node:stream";
import {downloadFromInfo, getBasicInfo, getInfo, chooseFormat} from 'ytdl-core-discord';
import ytpl from "ytpl";
import ytsr from "ytsr";
import {IBasicVideoInfo, VideoInfoType} from "./IBasicVideoInfo";

export async function getYoutubeAudioStream(url : string) : Promise<Readable | null> {
    try{
        let stream : Readable;
        const videoInfo = await getInfo(url).catch(x => null);
        if(!videoInfo)
            return null;
        if(videoInfo.videoDetails.isLiveContent){
            const format = chooseFormat(videoInfo.formats, {quality: [128,127,120,96,95,94,93]});
            stream = downloadFromInfo(videoInfo, {highWaterMark : 1<<25, liveBuffer:4900, format:format});
        }
        else{
            stream = downloadFromInfo(videoInfo, {filter:"audioonly", highWaterMark: 1<<25 });
        }
        stream.on("error",(e : any)=>{
                if(e.statusCode! === 403||410){
                    return null;
                }
                console.log(e);
            });
        return stream;
    }
    catch (e){
        console.error(e);
        return null;
    }
}

export async function parseYouTubePlayParameter(param : string) : Promise<IBasicVideoInfo[] | null>{
    const result : IBasicVideoInfo[] = [];
    try{
        const playlistID = await ytpl.getPlaylistID(param).catch(() => null);
        if(playlistID){
            const playlistQueryResult = await ytpl(playlistID);
            playlistQueryResult.items.map(x => result.push({url : x.url, title : x.title, length: x.durationSec!, type: VideoInfoType.YouTube}));
            return result;
        }
        const basicVideoInfo = await getBasicInfo(param).catch(() => null);
        if(basicVideoInfo) return [{url: param, title: basicVideoInfo.player_response.videoDetails.title, length : +basicVideoInfo.videoDetails.lengthSeconds, type: VideoInfoType.YouTube}];
        const searchStringResult = await ytsr.getFilters(param)
            .then(x => x.get('Type')!.get('Video'))
            .catch(() => null);
        if(!searchStringResult?.url)
            return null;
        const finalLinks = await ytsr(searchStringResult.url, {limit:1}).catch(() => null);
        if(finalLinks){
            const link = finalLinks.items[0] as unknown as IBasicVideoInfo;
            const basicVideoInfo = await getBasicInfo(link.url).catch(() => null);
            return [{url:link.url, title : link.title, length:+basicVideoInfo!.videoDetails.lengthSeconds, type : VideoInfoType.YouTube}]
        }
    }
    catch (e : any){
        console.log(e);
        return null;
    }
    return null;
}