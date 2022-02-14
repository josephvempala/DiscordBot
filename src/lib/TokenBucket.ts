export class TokenBucket {
    private lastFilled: number;
    private tokens: number;

    public constructor(private readonly capacity: number, private readonly fillPerSecond: number) {
        this.lastFilled = Math.floor(Date.now() / 1000);
        this.tokens = capacity;
    }

    public take() {
        this.refill();

        if (this.tokens > 0) {
            this.tokens -= 1;
            return true;
        }

        return false;
    }

    public calculateTokenAmountFromTime(unixTimestamp: number) {
        const now = Math.floor(unixTimestamp / 1000);
        const secondsElapsedFromLastFill = now - this.lastFilled;
        const tokensToAdd = Math.floor(secondsElapsedFromLastFill * this.fillPerSecond);
        return Math.min(this.capacity, this.tokens + tokensToAdd);
    }

    private refill() {
        const now = Date.now();
        this.tokens = this.calculateTokenAmountFromTime(now);
        this.lastFilled = now / 1000;
    }
}
