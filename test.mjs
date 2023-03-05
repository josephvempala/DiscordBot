import ytdl from 'ytdl-core';
import fs from 'fs';

const info = await ytdl.getInfo('https://www.youtube.com/watch?v=VtndbeucAbk');
const file = ytdl
    .downloadFromInfo(info, {highWaterMark: 1 << 40, filter: 'audioonly', dlChunkSize: 4096})
    .pipe(fs.createWriteStream(`./${info.uid}`));
export {};
