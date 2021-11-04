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
exports.parsePlayParameter = exports.getYoutubeAudioStream = void 0;
const ytdl_core_1 = __importStar(require("ytdl-core"));
const ytpl_1 = __importDefault(require("ytpl"));
async function getYoutubeAudioStream(url) {
    const videoInfo = await (0, ytdl_core_1.getInfo)(url);
    return { stream: (0, ytdl_core_1.downloadFromInfo)(videoInfo, { quality: "highestaudio", filter: "audioonly" }), videoInfo: videoInfo };
}
exports.getYoutubeAudioStream = getYoutubeAudioStream;
async function parsePlayParameter(param) {
    const result = [];
    const plid = await ytpl_1.default.getPlaylistID(param).catch();
    if (plid) {
        const playlistQueryResult = await (0, ytpl_1.default)(plid);
        playlistQueryResult.items.map(x => result.push({ url: x.url, title: x.title }));
        return result;
    }
    if (ytdl_core_1.default.validateURL(param)) {
        const binfo = await (0, ytdl_core_1.getBasicInfo)(param);
        return [{ url: param, title: binfo.player_response.videoDetails.title }];
    }
    return null;
}
exports.parsePlayParameter = parsePlayParameter;
//# sourceMappingURL=youTube.js.map