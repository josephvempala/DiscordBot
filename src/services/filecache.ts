import os from 'os';
import {open} from 'fs/promises';
import {createReadStream, createWriteStream, writeFile} from 'fs';
import {Readable} from 'stream';
import ReadableStreamClone from 'readable-stream-clone';
import path from 'path';

export function cacheStream(stream: Readable, key: string) {
    try {
        const writeStream = createWriteStream(path.join(os.tmpdir(), encodeURIComponent(key) + '.mp3'));
        stream.pipe(writeStream);
        const playerStream = new ReadableStreamClone(stream);
        return playerStream;
    } catch (e: any) {
        console.log(e);
    }
}

export async function getCachedStream(key: string) {
    try {
        const file = await open(path.join(os.tmpdir(), encodeURIComponent(key)) + '.mp3');
        const present = (await file.stat()).size > 1024;
        file.close();
        if (present) return createReadStream(path.join(os.tmpdir(), encodeURIComponent(key)) + '.mp3');
    } catch (e: any) {
        return null;
    }
}
