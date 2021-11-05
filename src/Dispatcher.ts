import {Message} from "discord.js";
import {play, stop, clear, shuffle, skip, getQueue} from "./MusicPlayer";

export async function dispatcher(message : Message) {
    const input = message.content + ' ';
    const action = input.substring(1,input.indexOf(' ')).toLowerCase();
    const param = input.substring(input.indexOf(' '), input.length).trim();
    switch (action){
        case 'ping':
            await message.reply('pong');
            break;
        case 'play': case 'p':
            await play(param, message);
            break;
        case 'stop': case 's':
            await stop(message);
            break;
        case 'clear': case 'c':
            await clear(message);
            break;
        case 'shuffle': case 'sh':
            await shuffle(message);
            break;
        case 'skip': case 'sk':
            await skip(message);
            break;
        case 'queue': case'q':
             getQueue(param, message);
            break;
        default:
            return;
    }
}