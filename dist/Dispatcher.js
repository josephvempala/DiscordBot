"use strict";
Object.defineProperty(exports, "__esModule", {value: true});
exports.dispatcher = void 0;
const MusicPlayer_1 = require("./MusicPlayer");

async function dispatcher(message) {
    const input = message.content + ' ';
    const action = input.substring(1, input.indexOf(' ')).toLowerCase();
    const param = input.substring(input.indexOf(' '), input.length).trim();
    switch (action) {
        case 'ping':
            return message.reply('pong');
        case 'play':
        case 'p':
            return (0, MusicPlayer_1.addToQueue)(param, message);
        case 'stop':
        case 'st':
            return (0, MusicPlayer_1.stop)(message);
        case 'clear':
        case 'c':
            return (0, MusicPlayer_1.clear)(message);
        case 'shuffle':
        case 'sh':
            return (0, MusicPlayer_1.shuffle)(message);
        case 'skip':
        case 's':
            return (0, MusicPlayer_1.skip)(message);
        case 'queue':
        case 'q':
            return (0, MusicPlayer_1.getQueue)(param, message);
        default:
            return;
    }
}

exports.dispatcher = dispatcher;
//# sourceMappingURL=Dispatcher.js.map