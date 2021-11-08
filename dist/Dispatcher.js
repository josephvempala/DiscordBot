"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatcher = void 0;
const MusicPlayer_1 = require("./MusicPlayer");
async function dispatcher(message) {
    const input = message.content + ' ';
    const action = input.substring(1, input.indexOf(' ')).toLowerCase();
    const param = input.substring(input.indexOf(' '), input.length).trim();
    switch (action) {
        case 'ping':
            await message.reply('pong');
            break;
        case 'play':
        case 'p':
            await (0, MusicPlayer_1.play)(param, message);
            break;
        case 'stop':
        case 's':
            await (0, MusicPlayer_1.stop)(message);
            break;
        case 'clear':
        case 'c':
            await (0, MusicPlayer_1.clear)(message);
            break;
        case 'shuffle':
        case 'sh':
            await (0, MusicPlayer_1.shuffle)(message);
            break;
        case 'skip':
        case 'sk':
            await (0, MusicPlayer_1.skip)(message);
            break;
        case 'queue':
        case 'q':
            (0, MusicPlayer_1.getQueue)(param, message);
            break;
        default:
            return;
    }
}
exports.dispatcher = dispatcher;
//# sourceMappingURL=Dispatcher.js.map