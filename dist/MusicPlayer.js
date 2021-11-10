"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getQueue = exports.clear = exports.skip = exports.shuffle = exports.stop = exports.play = void 0;
const voice_1 = require("@discordjs/voice");
const youTube_1 = require("./youTube");
const util_1 = require("./util");
const guildPlayers = {};
async function createNewGuildPlayer(message, queue) {
    const guildPlayer = {
        queue: queue ? queue : [],
        player: (0, voice_1.createAudioPlayer)(),
        voiceConnection: (0, voice_1.joinVoiceChannel)({
            selfDeaf: true,
            channelId: message.member.voice.channel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator
        }),
        guild: message.member?.guild
    };
    guildPlayers[message.guild?.id] = guildPlayer;
    let nowPlayingMessage = await playNext(guildPlayer.voiceConnection, message).catch(x => console.log(x));
    guildPlayer.player.addListener(voice_1.AudioPlayerStatus.Idle, async () => {
        nowPlayingMessage?.delete();
        if (guildPlayers[message.guild?.id].queue.length <= 0) {
            guildPlayer.player.removeAllListeners(voice_1.AudioPlayerStatus.Idle);
            guildPlayer.voiceConnection.disconnect();
            guildPlayer.voiceConnection.destroy();
            delete guildPlayers[message.guild.id];
            return;
        }
        nowPlayingMessage = await playNext(guildPlayer.voiceConnection, message).catch(x => console.log(x));
    });
    guildPlayer.player.addListener("error", () => {
        nowPlayingMessage?.delete();
        guildPlayer.player.stop();
        nowPlayingMessage?.edit("Error while playing");
    });
    guildPlayer.voiceConnection.subscribe(guildPlayer.player);
}
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
    const audioToPlay = guildPlayers[message.guild?.id].queue.shift();
    const stream = await getAudioStream(audioToPlay.url);
    if (!stream)
        return message.react('⛔').then(() => message.channel.send(`Unable to play ${audioToPlay.title}`));
    const resource = (0, voice_1.createAudioResource)(stream.stream, { inputType: voice_1.StreamType.Arbitrary });
    guildPlayers[message.guild.id].player.play(resource);
    return message.channel.send(`Now Playing ${audioToPlay.title}`);
}
async function play(param, message) {
    if (!message.member.voice.channel) {
        message.channel.send("Please join a voice channel to listen");
        return;
    }
    const newMessage = await message.channel.send(`Searching youtube for ${param}`);
    const urls = await (0, youTube_1.parseYouTubePlayParameter)(param);
    if (!urls) {
        message.react('⛔').then(() => newMessage.edit("Invalid Query"));
        return;
    }
    else
        newMessage.delete();
    if (!guildPlayers[message.guild?.id])
        await createNewGuildPlayer(message, [...urls]);
    else
        guildPlayers[message.guild?.id].queue = [...guildPlayers[message.guild?.id].queue, ...urls];
    if (urls.length > 1)
        message.channel.send(`Added playlist of ${urls.length} songs to the queue`);
    else
        message.react("👍");
}
exports.play = play;
async function stop(message) {
    if (guildPlayers[message.guild?.id] && guildPlayers[message.guild?.id].player.state.status === voice_1.AudioPlayerStatus.Playing) {
        guildPlayers[message.guild?.id].queue = [];
        guildPlayers[message.guild?.id].player.stop();
        message.react("👍");
        return;
    }
    message.channel.send("I am not currently playing any music");
}
exports.stop = stop;
function shuffle(message) {
    if (guildPlayers[message.guild?.id] && guildPlayers[message.guild?.id].queue.length > 0) {
        (0, util_1.shuffleArray)(guildPlayers[message.guild?.id].queue);
        message.react("👍");
        return;
    }
    message.channel.send("The queue is empty");
}
exports.shuffle = shuffle;
function skip(message) {
    if (guildPlayers[message.guild?.id].player.state.status === voice_1.AudioPlayerStatus.Playing) {
        guildPlayers[message.guild?.id].player.stop();
        message.react("👍");
        return;
    }
    message.channel.send("I am not currently playing any music");
}
exports.skip = skip;
async function clear(message) {
    if (guildPlayers[message.guild?.id] && guildPlayers[message.guild?.id].queue.length > 0) {
        guildPlayers[message.guild?.id].queue = [];
        message.react("👍");
        return;
    }
    message.channel.send("The queue is empty");
}
exports.clear = clear;
function getQueue(param, message) {
    if (!guildPlayers[message.guild?.id] || guildPlayers[message.guild?.id].queue.length <= 0) {
        message.channel.send("The queue is empty");
        return;
    }
    let msg = '';
    if (!param) {
        guildPlayers[message.guild?.id].queue.slice(0, 5).forEach((x, i) => msg += `**#${i + 1}** ${x.title}\n`);
        message.channel.send(msg);
        return;
    }
    if (isNaN(+param)) {
        message.channel.send("Please enter number of queue entries to view");
        return;
    }
    guildPlayers[message.guild?.id].queue.slice(0, +param).forEach((x, i) => msg += `**#${i + 1}** ${x.title}\n`);
    message.channel.send(msg);
}
exports.getQueue = getQueue;
//# sourceMappingURL=MusicPlayer.js.map