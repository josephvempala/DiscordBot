import {Readable} from "node:stream";
import {downloadFromInfo, getInfo, videoInfo, getBasicInfo} from "ytdl-core";
import ytpl from "ytpl";

interface GetAudioStreamSuccess{
    stream : Readable;
    videoInfo: videoInfo;
}

export interface basicVideoInfo{
    url: string,
    title:string
}

export async function getYoutubeAudioStream(url : string) : Promise<GetAudioStreamSuccess | null> {
    for (let i=0;i<5;i++)
    try{
        const videoInfo = await getInfo(url);
        return { stream: downloadFromInfo(videoInfo, {quality: "highestaudio", filter:"audioonly"}), videoInfo: videoInfo};
    }
    catch (e){
        console.error(e);
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
    if(basicVideoInfo)
        return [{url: param, title: basicVideoInfo.player_response.videoDetails.title}];
    return null;
}