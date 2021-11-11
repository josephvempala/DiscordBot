"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.secondsToTime = exports.timer = exports.shuffleArray = void 0;
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}
exports.shuffleArray = shuffleArray;
const timer = (ms) => new Promise(res => {
    const timeout = setTimeout(res, ms);
});
exports.timer = timer;
const secondsToTime = (seconds) => new Date(1000 * seconds).toISOString().substr(11, 8);
exports.secondsToTime = secondsToTime;
//# sourceMappingURL=util.js.map