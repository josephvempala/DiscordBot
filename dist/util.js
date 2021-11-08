"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.timer = exports.shuffleArray = void 0;
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
//# sourceMappingURL=util.js.map