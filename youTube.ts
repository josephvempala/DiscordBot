import {Readable} from "node:stream";
import ytdl, {downloadFromInfo, getInfo, videoInfo, getBasicInfo} from "ytdl-core";
import ytpl from "ytpl";

interface GetAudioStreamSuccess{
    stream : Readable;
    videoInfo: videoInfo;
}

export interface basicVideoInfo{
    url: string,
    title:string
}

export async function getYoutubeAudioStream(url : string) : Promise<GetAudioStreamSuccess> {
    const videoInfo = await getInfo(url);
    return { stream: downloadFromInfo(videoInfo, {quality: "highestaudio", filter:"audioonly"}), videoInfo: videoInfo};
}

export async function parsePlayParameter(param : string) : Promise<basicVideoInfo[] | null>{
    const result : basicVideoInfo[] = [];
    const plid = await ytpl.getPlaylistID(param).catch();
    if(plid){
        const playlistQueryResult = await ytpl(plid);
        playlistQueryResult.items.map(x => result.push({url : x.url, title : x.title}));
        return result;
    }
    if(ytdl.validateURL(param)){
        const binfo = await getBasicInfo(param);
        return [{url: param, title: binfo.player_response.videoDetails.title}];
    }
    return null;
}