import {Message} from "discord.js";
import {addToQueue, stop, clear, shuffle, skip, getQueue} from "./MusicPlayer";

export async function dispatcher(message : Message) {
    const input = message.content + ' ';
    const action = input.substring(1,input.indexOf(' ')).toLowerCase();
    const param = input.substring(input.indexOf(' '), input.length).trim();
    switch (action){
        case 'ping':
            return message.reply('pong');
        case 'play': case 'p':
            return addToQueue(param, message);
        case 'stop': case 'st':
            return stop(message);
        case 'clear': case 'c':
            return clear(message);
        case 'shuffle': case 'sh':
            return shuffle(message);
        case 'skip': case 's':
            return skip(message);
        case 'queue': case'q':
            return getQueue(param, message);
        default:
            return;
    }
}