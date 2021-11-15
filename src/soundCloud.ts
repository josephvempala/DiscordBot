import scdl from 'soundcloud-downloader';
import {IBasicVideoInfo, VideoInfoType} from "./IBasicVideoInfo";
import {Readable} from "node:stream";

//const client_id = 'dofXe8NgBa5qIJ98dpBxyRzXlQ6tlOKk';

export async function getSoundCloudAudioStream(url: string): Promise<Readable | null> {
    try {
        return await scdl.download(url);
    } catch (e) {
        console.log(e);
        return null;
    }
}

export async function parseSoundCloudPlayParameter(param: string): Promise<IBasicVideoInfo[] | null> {
    try {
        if (!scdl.isValidUrl(param))
            return null;
        const info = await scdl.getInfo(param);
        return [{url: info.uri!, type: VideoInfoType.SoundCloud, length: info.duration! / 1000, title: info.title!}]
    } catch (e) {
        console.log(e);
        return null;
    }
}