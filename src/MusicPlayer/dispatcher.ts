import {Message} from "discord.js";
import {bbpm, clear, getNowPlaying, getQueue, leave, pause, play, search, shuffle, skip, stop} from "./MusicPlayer";
import {broadcastMessage} from "../lib/botutils";

export async function musicPlayerDispatcher(message: Message) {
    const input = message.content + ' ';
    const action = input.substring(1, input.indexOf(' ')).toLowerCase();
    const param = input.substring(input.indexOf(' '), input.length).trim();
    let result: boolean;
    switch (action) {
        case 'ping':
            await message.reply('pong');
            result = true;
            break;
        case 'play':
        case 'p':
            result = play(message, param);
            break;
        case 'search':
        case 'ps':
            result = await search(message, param);
            break;
        case 'pause':
            result = pause(message);
            break;
        case 'stop':
        case 'st':
            result = stop(message);
            break;
        case 'clear':
        case 'c':
            result = clear(message);
            break;
        case 'shuffle':
        case 'sh':
            result = shuffle(message);
            break;
        case 'skip':
        case 's':
            result = skip(message);
            break;
        case 'queue':
        case'q':
            result = getQueue(param, message);
            break;
        case 'bbpm':
            result = bbpm(message);
            break;
        case 'np':
        case'nowplaying':
            result = getNowPlaying(message);
            break;
        case 'l':
        case 'leave':
            result = leave(message);
            break;
        case'msgall':
            if (message.author.id === '704257828080058419' || message.author.id === '266115749704105984')
                result = broadcastMessage(param);
            break;
        default:
            result = false;
    }
    result! ? await message.react("👍") : await message.react("🛑");
}