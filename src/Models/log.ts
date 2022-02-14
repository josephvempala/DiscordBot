import mongoose, {Model, Types} from 'mongoose';
import {splitArrayIntoChunks} from '../lib/util';
import {MaxReadingsPerDocument} from '../lib/Constants';

export interface ILogReading {
    guildId: string;
    type: string;
    timestamp: Date;
    msg: string;
}

export interface ILog {
    readings: Types.DocumentArray<ILogReading>;
}

export interface ILogDoc extends Document, ILog {}

export interface ILogModel extends Model<ILogDoc> {
    writeReadings(readings: ILogReading[]): void;
}

const logEntrySchema = new mongoose.Schema({
    guildId: String,
    type: String,
    timestamp: Date,
    msg: String,
});

const logSchema = new mongoose.Schema<ILog, ILogModel>({
    readings: [logEntrySchema],
});

logSchema.statics.writeReadings = async function (this: ILogModel, readings: ILogReading[]) {
    let latestDocument = await this.findOne().sort({_id: -1});
    if (!latestDocument) {
        latestDocument = new this();
    }

    const initialDocumentReadingsLength = latestDocument.readings.length;
    const readingsToInsert = readings.slice(0, MaxReadingsPerDocument - initialDocumentReadingsLength);
    latestDocument.readings.push(...readingsToInsert);
    await latestDocument.save();

    const remainingReadingsChunks = splitArrayIntoChunks(
        readings.slice(MaxReadingsPerDocument - initialDocumentReadingsLength),
        MaxReadingsPerDocument,
    );
    if (remainingReadingsChunks.length > 0) {
        remainingReadingsChunks.forEach((x) =>
            new this({
                readings: x,
            }).save(),
        );
    }
};

export const logModel = mongoose.model<ILog, ILogModel>('Log', logSchema, 'Log');
