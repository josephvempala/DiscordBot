import {Message} from "discord.js";
import {
    bbpm,
    clear,
    getNowPlaying,
    getQueue,
    leave,
    pause,
    playDispatcher,
    search,
    shuffle,
    skip,
    stop
} from "./MusicPlayer";
import {broadcastMessage} from "./botutils";

export function messageDispatcher(message: Message) {
    const input = message.content + ' ';
    const action = input.substring(1, input.indexOf(' ')).toLowerCase();
    const param = input.substring(input.indexOf(' '), input.length).trim();
    switch (action) {
        case 'ping':
            message.reply('pong');
            break;
        case 'play':
        case 'p':
            return playDispatcher(message, param);
        case 'search':
        case 'ps':
            return search(message, param);
        case 'pause':
            return pause(message);
        case 'stop':
        case 'st':
            return stop(message);
        case 'clear':
        case 'c':
            return clear(message);
        case 'shuffle':
        case 'sh':
            return shuffle(message);
        case 'skip':
        case 's':
            return skip(message);
        case 'queue':
        case'q':
            return getQueue(param, message);
        case 'bbpm':
            return bbpm(message);
        case 'np':
        case'nowplaying':
            return getNowPlaying(message);
        case 'l':
        case 'leave':
            return leave(message);
        case'msgall': {
            if (message.author.id === '704257828080058419' || message.author.id === '266115749704105984')
                return broadcastMessage(param);
            return;
        }
        default:
            return;
    }
}