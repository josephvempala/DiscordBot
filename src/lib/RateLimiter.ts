import {TokenBucket} from './TokenBucket';

export class RateLimiter {
    private buckets: Map<string, TokenBucket>;

    public constructor(private maxCommandsBurst: number, private commandsPerSecond: number) {
        this.buckets = new Map<string, TokenBucket>();
    }

    public isRateLimited(uid: string) {
        if (this.buckets.size > 100) {
            this.clearStaleBuckets();
        }
        if (!this.buckets.has(uid)) {
            this.buckets.set(uid, new TokenBucket(this.maxCommandsBurst, this.commandsPerSecond));
        }
        return !this.buckets.get(uid)!.take();
    }

    private clearStaleBuckets() {
        const uidsToRemove: string[] = [];
        this.buckets.forEach((tokenBucket, uid) => {
            if (tokenBucket.calculateTokenAmountFromTime(Date.now()) === this.maxCommandsBurst) {
                uidsToRemove.push(uid);
            }
        });
        uidsToRemove.forEach((x) => this.buckets.delete(x));
    }
}
