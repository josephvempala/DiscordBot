"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : {"default": mod};
};
Object.defineProperty(exports, "__esModule", {value: true});
exports.parseYouTubePlayParameter = exports.getYoutubeAudioStream = void 0;
const ytdl_core_discord_1 = require("ytdl-core-discord");
const ytpl_1 = __importDefault(require("ytpl"));
const ytsr_1 = __importDefault(require("ytsr"));
const IBasicVideoInfo_1 = require("./IBasicVideoInfo");

async function getYoutubeAudioStream(url) {
    try {
        let stream;
        const videoInfo = await (0, ytdl_core_discord_1.getInfo)(url).catch(x => null);
        if (!videoInfo)
            return null;
        if (videoInfo.videoDetails.isLiveContent) {
            const format = (0, ytdl_core_discord_1.chooseFormat)(videoInfo.formats, {quality: [128, 127, 120, 96, 95, 94, 93]});
            stream = (0, ytdl_core_discord_1.downloadFromInfo)(videoInfo, {
                highWaterMark: 1 << 25,
                liveBuffer: 4900,
                format: format
            });
        } else {
            stream = (0, ytdl_core_discord_1.downloadFromInfo)(videoInfo, {
                filter: "audioonly",
                highWaterMark: 1 << 25
            });
        }
        stream.on("error", (e) => {
            if (e.statusCode === 403 || 410) {
                return null;
            }
            console.log(e);
        });
        return stream;
    } catch (e) {
        console.error(e);
        return null;
    }
}

exports.getYoutubeAudioStream = getYoutubeAudioStream;

async function parseYouTubePlayParameter(param) {
    const result = [];
    try {
        const playlistID = await ytpl_1.default.getPlaylistID(param).catch(() => null);
        if (playlistID) {
            const playlistQueryResult = await (0, ytpl_1.default)(playlistID);
            playlistQueryResult.items.map(x => result.push({
                url: x.url,
                title: x.title,
                length: x.durationSec,
                type: IBasicVideoInfo_1.VideoInfoType.YouTube
            }));
            return result;
        }
        const basicVideoInfo = await (0, ytdl_core_discord_1.getBasicInfo)(param).catch(() => null);
        if (basicVideoInfo)
            return [{
                url: param,
                title: basicVideoInfo.player_response.videoDetails.title,
                length: +basicVideoInfo.videoDetails.lengthSeconds,
                type: IBasicVideoInfo_1.VideoInfoType.YouTube
            }];
        const searchStringResult = await ytsr_1.default.getFilters(param)
            .then(x => x.get('Type').get('Video'))
            .catch(() => null);
        if (!searchStringResult?.url)
            return null;
        const finalLinks = await (0, ytsr_1.default)(searchStringResult.url, {limit: 1}).catch(() => null);
        if (finalLinks) {
            const link = finalLinks.items[0];
            const basicVideoInfo = await (0, ytdl_core_discord_1.getBasicInfo)(link.url).catch(() => null);
            return [{
                url: link.url,
                title: link.title,
                length: +basicVideoInfo.videoDetails.lengthSeconds,
                type: IBasicVideoInfo_1.VideoInfoType.YouTube
            }];
        }
    } catch (e) {
        console.log(e);
        return null;
    }
    return null;
}

exports.parseYouTubePlayParameter = parseYouTubePlayParameter;
//# sourceMappingURL=youTube.js.map