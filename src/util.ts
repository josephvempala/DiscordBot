export function shuffleArray(arr: any[]) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

export const timer = (ms: number) => new Promise(res => {
    const timeout = setTimeout(res, ms);
});

export const secondsToTime = (seconds: number) => new Date(1000 * seconds).toISOString().substr(11, 8);
