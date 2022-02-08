import {ILogReading, logModel} from "../Models/log";

class MusicPlayerLogger {

    private static instance: MusicPlayerLogger;
    private static readings: ILogReading[];
    private static writeInterval: NodeJS.Timer;

    private constructor() {
        MusicPlayerLogger.instance = this;
        MusicPlayerLogger.readings = [];
        MusicPlayerLogger.writeInterval = setInterval(MusicPlayerLogger.writeBucketToDatabase, 60000);
    }

    public static getInstance() {
        if (!MusicPlayerLogger.instance) {
            return MusicPlayerLogger.instance = new MusicPlayerLogger();
        }
        return MusicPlayerLogger.instance;
    }

    private static writeBucketToDatabase() {
        if (MusicPlayerLogger.readings.length === 0)
            return;
        logModel.writeReadings(MusicPlayerLogger.readings);
        MusicPlayerLogger.readings = [];
    }

    private static addLogToBucket(reading: ILogReading) {
        MusicPlayerLogger.readings.push(reading);
        if (MusicPlayerLogger.readings.length >= 50) {
            MusicPlayerLogger.writeBucketToDatabase();
        }
    }

    public debug(msg: string, guildId: string) {
        const time = new Date();
        console.log(`[${time.toString()}][DEBUG] : ${msg}`);
        MusicPlayerLogger.addLogToBucket({msg: msg, type: 'DEBUG', timestamp: time, guildId: guildId});
    }

    public error(msg: string, guildId: string) {
        const time = new Date;
        console.error(`[${time.toString()}][ERROR] : ${msg}`);
        MusicPlayerLogger.addLogToBucket({msg: msg, type: 'ERROR', timestamp: time, guildId: guildId});
    }

}

export const logger = MusicPlayerLogger.getInstance();