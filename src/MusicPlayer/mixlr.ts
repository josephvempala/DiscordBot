import miniget from 'miniget';
import axios from 'axios';
import {Readable} from 'node:stream';
import {GetAudioStreamResult} from '../Interfaces/GetAudioStreamResult';
import {IBasicVideoInfo, VideoInfoType} from '../Interfaces/IBasicVideoInfo';
import {timer} from '../lib/util';

const urlValidationRegex = /(?:https?:\/\/)?(?:www\.)?(mixlr\.com\/[^\/]*?\/\B)/gm;

export async function getMixlrAudioStream(url: string): Promise<GetAudioStreamResult> {
    let metadata;
    for (let i = 0; i < 5 && !metadata; i++) {
        metadata = await axios.get(url).catch(() => null);
        await timer(100 * i);
    }
    if (!metadata) {
        return [null, 'Unable to find stream'];
    }
    if (!metadata.data.is_live) {
        return [null, 'Stream is currently not live'];
    }
    const readable = miniget(metadata.data.current_broadcast.streams.progressive.url, {
        maxRetries: 10,
        maxReconnects: 10,
        highWaterMark: 1 << 25,
        backoff: {inc: 200, max: 10},
    }) as Readable;
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
    let result;
    for (let i = 0; i < 5 && !result; i++) {
        result = await axios.get(`https://${urlMatch[1]}`).catch(() => null);
        await timer(100 * i);
    }
    if (!result) {
        return null;
    }
    const userId = /({"id":)(\d*?),/.exec(result.data);
    const playUrl = `https://api.mixlr.com/users/${userId![2]}?source=embed`;
    return [
        {
            url: playUrl,
            title: 'Mixlr Stream',
            type: VideoInfoType.Mixlr,
            length: 0,
            isLiveStream: true,
        },
    ];
}
