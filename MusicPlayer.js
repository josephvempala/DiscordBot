"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getQueue = exports.clear = exports.stop = exports.shuffle = exports.skip = exports.addToPlayer = void 0;
const voice_1 = require("@discordjs/voice");
const youTube_1 = require("./youTube");
const util_1 = require("./util");
let player = (0, voice_1.createAudioPlayer)();
let queue = [];
async function getAudioStream(url) {
    let stream;
    try {
        stream = await (0, youTube_1.getYoutubeAudioStream)(url);
        return stream;
    }
    catch (e) {
        return null;
    }
}
async function playNext(voiceConnection, message) {
    const audioToPlay = queue.shift();
    const stream = await getAudioStream(audioToPlay.url);
    if (!stream)
        return;
    const resource = (0, voice_1.createAudioResource)(stream.stream, { inputType: voice_1.StreamType.Arbitrary });
    await player.play(resource);
    voiceConnection.subscribe(player);
    return message.channel.send(`Now Playing ${stream.videoInfo.player_response.microformat.playerMicroformatRenderer.title.simpleText}`);
}
async function addToPlayer(param, message) {
    if (!message.member.voice.channel)
        return message.channel.send("Please join a voice channel to listen to your music");
    const urls = await (0, youTube_1.parsePlayParameter)(param);
    if (!urls)
        return message.channel.send("Invalid URL");
    urls.forEach(x => queue.push(x));
    if (urls.length > 1)
        message.channel.send(`Added playlist of ${urls.length} songs to the queue`);
    else
        message.channel.send(`Added ${urls[0].title} to queue`);
    if (player.state.status === voice_1.AudioPlayerStatus.Playing) {
        return;
    }
    const voiceConnection = (0, voice_1.joinVoiceChannel)({
        selfDeaf: true,
        channelId: message.member.voice.channel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator
    });
    playNext(voiceConnection, message).catch();
    player.addListener(voice_1.AudioPlayerStatus.Idle, () => {
        if (queue.length <= 0) {
            player.removeAllListeners(voice_1.AudioPlayerStatus.Idle);
            voiceConnection.disconnect();
            voiceConnection.destroy();
            return;
        }
        playNext(voiceConnection, message).catch();
    });
}
exports.addToPlayer = addToPlayer;
async function skip(message) {
    return message.channel.send("Skipped current song");
}
exports.skip = skip;
async function shuffle(message) {
    if (queue.length > 0) {
        (0, util_1.shuffleArray)(queue);
        return message.channel.send("Shuffled current queue");
    }
    return message.channel.send("The queue is empty");
}
exports.shuffle = shuffle;
function stop(message) {
    if (player.state.status === voice_1.AudioPlayerStatus.Playing) {
        player.stop();
        return message.channel.send("Stopped playing music");
    }
    return message.channel.send("I am not currently playing any music");
}
exports.stop = stop;
async function clear(message) {
    if (queue.length > 0) {
        queue = [];
        return message.channel.send("Cleared the queue");
    }
    return message.channel.send("The queue is empty");
}
exports.clear = clear;
function getQueue(param, message) {
    if (queue.length <= 0) {
        return message.channel.send("The queue is empty");
    }
    let msg = '';
    if (!param) {
        queue.slice(0, 5).map(x => msg += `${x.title}\n`);
        return message.channel.send(msg);
    }
    if (isNaN(+param))
        return message.channel.send("Please enter number of queue entries to view");
    queue.slice(0, +param).map(x => msg += `${x.title}\n`);
    return message.channel.send(msg);
}
exports.getQueue = getQueue;
//# sourceMappingURL=MusicPlayer.js.map