import {ILogReading, logModel} from "./Models/log";

class MusicPlayerLogger {

    private static instance: MusicPlayerLogger;
    private static readings: ILogReading[];
    private static startTime: number;
    private static writeInterval: NodeJS.Timer;

    private constructor() {
        MusicPlayerLogger.instance = this;
        MusicPlayerLogger.readings = [];
        MusicPlayerLogger.startTime = Date.now();
        MusicPlayerLogger.writeInterval = setInterval(this.writeBucketToDatabase, 60000);
    }

    public static getInstance() {
        if (!MusicPlayerLogger.instance) {
            return MusicPlayerLogger.instance = new MusicPlayerLogger();
        }
        return MusicPlayerLogger.instance;
    }

    public debug(msg: string, guildId: string) {
        const time = Date.now();
        console.log(`[${time.toString()}][DEBUG] : ${msg}`);
        this.addLogToBucket({msg: msg, type: 'DEBUG', timestamp: time, guildId: guildId});
    }

    public error(msg: string, guildId: string) {
        const time = Date.now();
        console.error(`[${time.toString()}][ERROR] : ${msg}`);
        this.addLogToBucket({msg: msg, type: 'ERROR', timestamp: time, guildId: guildId});
    }

    private writeBucketToDatabase() {
        if (MusicPlayerLogger.readings.length > 0) {
            const databaseDocument = new logModel({
                startTime: MusicPlayerLogger.startTime,
                endTime: Date.now(),
                readings: MusicPlayerLogger.readings
            })
            databaseDocument.save()
                .then(() => {
                    MusicPlayerLogger.startTime = Date.now();
                    MusicPlayerLogger.readings = [];
                }, (err) => {
                    console.error(err, '');
                });
        }
    }

    private addLogToBucket(reading: ILogReading) {
        MusicPlayerLogger.readings.push(reading);
        if (MusicPlayerLogger.readings.length >= 50) {
            this.writeBucketToDatabase();
        }
    }

}

export const logger = MusicPlayerLogger.getInstance();