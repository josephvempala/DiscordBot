import {GetAudioStreamResult} from "./Interfaces/GetAudioStreamResult";
import {IBasicVideoInfo, VideoInfoType} from "./Interfaces/IBasicVideoInfo";

const scdl = require('soundcloud-downloader').create({});

export async function getSoundCloudAudioStream(url: string): Promise<GetAudioStreamResult> {
    try {
        const stream = await scdl.download(url);
        return [stream, null];
    } catch (e) {
        return [null, 'Error occurred while getting SoundCloud audio stream'];
    }
}

export async function parseSoundCloudPlayParameter(param: string): Promise<IBasicVideoInfo[] | null> {
    try {
        if (!scdl.isValidUrl(param))
            return null;
        const info = await scdl.getInfo(param);
        return [{
            url: info.uri!,
            type: VideoInfoType.SoundCloud,
            length: info.duration! / 1000,
            title: info.title!,
            isLiveStream: +info.duration == 0
        }]
    } catch (e) {
        return null;
    }
}