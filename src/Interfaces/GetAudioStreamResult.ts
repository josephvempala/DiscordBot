import {Readable} from 'node:stream';

export type GetAudioStreamResult = [Readable | null, string | null];
