import mongoose, {Model, Types} from 'mongoose';
import {splitArrayIntoChunks} from "../util";

export interface ILogReading {
    guildId: string,
    type: string,
    timestamp: number,
    msg: string
}

export interface ILog {
    startTime: number,
    endTime: number,
    readings: Types.DocumentArray<ILogReading>;
}

export interface ILogDoc extends Document, ILog {
}

export interface ILogModel extends Model<ILogDoc> {
    writeReadings(readings : ILogReading[]): void
}

const logEntrySchema = new mongoose.Schema({
    guildId: String,
    type: String,
    timestamp: Number,
    msg: String
});

const logSchema = new mongoose.Schema<ILog, ILogModel>({
    startTime: Number,
    endTime: Number,
    readings: [logEntrySchema]
});

logSchema.static('writeReadings', async function (this:ILogModel, readings : ILogReading[]) {
    const latestDocument = await this.findOne().sort('-endTime');
    if(!latestDocument && readings.length <= 50){
        const doc = await this.create({startTime: readings[0].timestamp, endTime: readings[readings.length-1].timestamp, readings:readings});
        await doc.save();
        return;
    }
    const readingsToInsert = readings.slice(0, 50 - latestDocument!.readings.length);
    latestDocument!.endTime = readings[readings.length - 1].timestamp;
    latestDocument!.readings.push(...readingsToInsert);
    await latestDocument!.save();

    const remainingReadingsChunks = splitArrayIntoChunks(readings.slice(50 - latestDocument!.readings.length + 1, readings.length), 50);
    if(remainingReadingsChunks.length>0){
        const bulkSave = await Promise.all(remainingReadingsChunks.map(x => this.create({startTime:x[0].timestamp, endTime:x[x.length-1].timestamp, readings: x})));
        await this.bulkSave(bulkSave);
    }
})

export const logModel = mongoose.model<ILog, ILogModel>('Log', logSchema, 'Log');