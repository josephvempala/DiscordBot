"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSpotifyPlayParameter = exports.getSpotifyAudioStream = void 0;
const spdl_core_1 = __importDefault(require("spdl-core"));
const IBasicVideoInfo_1 = require("./IBasicVideoInfo");
const fs = __importStar(require("fs"));
//@ts-ignore
spdl_core_1.default.setCredentials(process.env.SPOTIFY_CLIENT_ID, process.env.SPOTIFY_CLIENT_SECRET);
async function getSpotifyAudioStream(url) {
    try {
        const videoInfo = await spdl_core_1.default.getInfo(url).catch(x => null);
        if (!videoInfo)
            return null;
        const stream = await (0, spdl_core_1.default)(url);
        stream.on('error', (e) => {
            if (e.statusCode === 403 || 410) {
                return null;
            }
            console.log(e);
        });
        stream.pipe(fs.createWriteStream(`${videoInfo.title}.mp3`));
        return stream;
    }
    catch (e) {
        console.log(e);
        return null;
    }
}
exports.getSpotifyAudioStream = getSpotifyAudioStream;
async function parseSpotifyPlayParameter(param) {
    const result = [];
    const spotifyAudioInfo = await spdl_core_1.default.getInfo(param).catch(() => null);
    if (spotifyAudioInfo) {
        return [{ url: spotifyAudioInfo.url, title: spotifyAudioInfo.title, length: spotifyAudioInfo.duration ? spotifyAudioInfo.duration : 0, type: IBasicVideoInfo_1.VideoInfoType.Spotify }];
    }
    return null;
}
exports.parseSpotifyPlayParameter = parseSpotifyPlayParameter;
//# sourceMappingURL=spotify.js.map