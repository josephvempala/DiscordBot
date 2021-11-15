"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : {"default": mod};
};
Object.defineProperty(exports, "__esModule", {value: true});
exports.parseSoundCloudPlayParameter = exports.getSoundCloudAudioStream = void 0;
const soundcloud_downloader_1 = __importDefault(require("soundcloud-downloader"));
const IBasicVideoInfo_1 = require("./IBasicVideoInfo");

//const client_id = 'dofXe8NgBa5qIJ98dpBxyRzXlQ6tlOKk';
async function getSoundCloudAudioStream(url) {
    try {
        return await soundcloud_downloader_1.default.download(url);
    } catch (e) {
        console.log(e);
        return null;
    }
}

exports.getSoundCloudAudioStream = getSoundCloudAudioStream;

async function parseSoundCloudPlayParameter(param) {
    try {
        if (!soundcloud_downloader_1.default.isValidUrl(param))
            return null;
        const info = await soundcloud_downloader_1.default.getInfo(param);
        return [{
            url: info.uri,
            type: IBasicVideoInfo_1.VideoInfoType.SoundCloud,
            length: info.duration / 1000,
            title: info.title
        }];
    } catch (e) {
        console.log(e);
        return null;
    }
}

exports.parseSoundCloudPlayParameter = parseSoundCloudPlayParameter;
//# sourceMappingURL=soundCloud.js.map