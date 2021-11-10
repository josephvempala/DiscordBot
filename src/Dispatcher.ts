import {Message} from "discord.js";
import {play, stop, clear, shuffle, skip, getQueue} from "./MusicPlayer";

export async function dispatcher(message : Message) {
    const input = message.content + ' ';
    const action = input.substring(1,input.indexOf(' ')).toLowerCase();
    const param = input.substring(input.indexOf(' '), input.length).trim();
    switch (action){
        case 'ping':
            return message.reply('pong');
        case 'play': case 'p':
            return play(param, message);
        case 'stop': case 's':
            return stop(message);
        case 'clear': case 'c':
            return clear(message);
        case 'shuffle': case 'sh':
            return shuffle(message);
        case 'skip': case 'sk':
            return skip(message);
        case 'queue': case'q':
            return getQueue(param, message);
        default:
            return;
    }
}