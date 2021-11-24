import {GetAudioStreamResult} from "./GetAudioStreamResult";
const scdl = require('soundcloud-downloader').create({});
import {IBasicVideoInfo, VideoInfoType} from "./IBasicVideoInfo";
import {Readable} from "node:stream";

export async function getSoundCloudAudioStream(url: string): Promise<GetAudioStreamResult> {
    try {
        const stream = await scdl.download(url);
        return [stream, null];
    } catch (e) {
        console.log(e);
        return [null, 'Error occurred while getting SoundCloud audio stream'];
    }
}

export async function parseSoundCloudPlayParameter(param: string): Promise<IBasicVideoInfo[] | null> {
    try {
        if (!scdl.isValidUrl(param))
            return null;
        const info = await scdl.getInfo(param);
        return [{url: info.uri!, type: VideoInfoType.SoundCloud, length: info.duration! / 1000, title: info.title!, isLiveStream: +info.duration == 0}]
    } catch (e) {
        console.log(e);
        return null;
    }
}