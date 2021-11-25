import miniget from 'miniget';
import axios from 'axios';
import {Readable} from "node:stream";
import {GetAudioStreamResult} from "./GetAudioStreamResult";
import {IBasicVideoInfo, VideoInfoType} from "./IBasicVideoInfo";

const urlValidationRegex = /(?:https?:\/\/)?(?:www\.)?(mixlr\.com\/[^\/]*?\/\B)/gm;

export async function getMixlrAudioStream(url: string): Promise<GetAudioStreamResult> {
    let metadata;
    for (let i = 0; i < 5 && !metadata; i++) {
        metadata = await axios.get(url).catch(x => {
            console.log(x);
            return null;
        });
    }
    if (!metadata) {
        return [null, 'Unable to find stream'];
    }
    if (!metadata.data.is_live) {
        return [null, 'Stream is currently not live'];
    }
    const readable = miniget(metadata.data.current_broadcast.streams.progressive.url, {maxRetries: 10}) as Readable;
    if (readable) {
        return [readable, null];
    }
    return [null, 'Unable to get stream from service'];
}

export async function parseMixlrPlayParameter(url: string): Promise<IBasicVideoInfo[] | null> {
    const urlMatch = urlValidationRegex.exec(url + '/');
    if (!urlMatch) {
        return null;
    }
    const result = await axios.get(`https://${urlMatch[1]}`);
    const userId = /({"id":)(\d*?),/.exec(result.data);
    const playUrl = `https://api.mixlr.com/users/${userId![1]}?source=embed`;
    const apiResult = await axios.get(playUrl);
    return [{
        url: playUrl,
        title: apiResult.data.slug,
        type: VideoInfoType.Mixlr,
        length: 0,
        isLiveStream: true
    }];
}