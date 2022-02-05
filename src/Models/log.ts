import mongoose, {Model} from 'mongoose';

export interface ILogReading {
    guildId: string,
    type: string,
    timestamp: number,
    msg: string
}

export interface ILog {
    startTime: number,
    endTime: number,
    readings: ILogReading[]
}

export interface ILogDoc extends Document, ILog {
}

export interface ILogModel extends Model<ILogDoc> {
}

const logEntrySchema = new mongoose.Schema({
    guildId: String,
    type: String,
    timestamp: Number,
    msg: String
});

const logSchema = new mongoose.Schema({
    startTime: Number,
    endTime: Number,
    readings: [logEntrySchema]
});

export const logModel = mongoose.model<ILog, ILogModel>('Log', logSchema, 'Log');