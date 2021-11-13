"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getQueue = exports.clear = exports.skip = exports.shuffle = exports.stop = exports.addToQueue = void 0;
const voice_1 = require("@discordjs/voice");
const youTube_1 = require("./youTube");
const util_1 = require("./util");
const IBasicVideoInfo_1 = require("./IBasicVideoInfo");
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
        guild: message.member?.guild,
        currentlyPlaying: null,
        playerMessages: {},
        botLeaveTimeout: null,
    };
    guildPlayers[message.guild?.id] = guildPlayer;
    registerGuildPlayerEventListeners(guildPlayer);
    guildPlayer.voiceConnection.subscribe(guildPlayer.player);
}
async function removeGuildPlayer(guildPlayer) {
    for (const element in guildPlayer.playerMessages) {
        let message = guildPlayer.playerMessages[element];
        if (message.deletable && !message.deleted) {
            await message.delete();
        }
    }
    guildPlayer.player.removeAllListeners(voice_1.AudioPlayerStatus.Idle);
    guildPlayer.player.removeAllListeners("error");
    guildPlayer.voiceConnection.disconnect();
    delete guildPlayers[guildPlayer.guild.id];
}
function registerGuildPlayerEventListeners(guildPlayer) {
    guildPlayer.voiceConnection.addListener(voice_1.VoiceConnectionStatus.Disconnected, async () => {
        if (guildPlayers[guildPlayer.guild.id])
            await removeGuildPlayer(guildPlayer);
        guildPlayer.voiceConnection.destroy();
    });
    guildPlayer.player.addListener("error", async (e) => {
        console.log(e);
        await guildPlayer.playerMessages['playRequestMessage']?.delete();
        delete guildPlayer.playerMessages['playRequestMessage'];
        if (e.message === "Status code: 403" && guildPlayer.currentlyPlaying) {
            guildPlayer.queue?.push(guildPlayer.currentlyPlaying);
        }
        guildPlayer.player.stop();
        await playNext(guildPlayer.voiceConnection, guildPlayer.playerMessages['playRequestMessage']);
    });
    guildPlayer.player.addListener(voice_1.AudioPlayerStatus.Idle, async () => {
        await guildPlayer.playerMessages['playRequestMessage']?.delete();
        delete guildPlayer.playerMessages['playRequestMessage'];
        if (guildPlayers[guildPlayer.guild.id].queue.length <= 0) {
            guildPlayer.botLeaveTimeout = setTimeout(async () => {
                await removeGuildPlayer(guildPlayer);
            }, 30000);
            return;
        }
        await playNext(guildPlayer.voiceConnection, guildPlayer.playerMessages['playRequestMessage']);
    });
}
async function getAudioStream(info) {
    switch (info.type) {
        case IBasicVideoInfo_1.VideoInfoType.YouTube:
            return await (0, youTube_1.getYoutubeAudioStream)(info.url);
    }
}
async function playNext(voiceConnection, message) {
    if (guildPlayers[message.guild?.id].queue.length <= 0) {
        return;
    }
    const audioToPlay = guildPlayers[message.guild?.id].queue.shift();
    guildPlayers[message.guild?.id].currentlyPlaying = audioToPlay;
    const stream = await getAudioStream(audioToPlay);
    if (!stream) {
        await message.react('⛔');
        await message.channel.send(`Unable to play ${audioToPlay.title}`);
        return playNext(voiceConnection, message);
    }
    const resource = (0, voice_1.createAudioResource)(stream, { inputType: voice_1.StreamType.Arbitrary });
    guildPlayers[message.guild.id].player.play(resource);
    guildPlayers[message.guild?.id].playerMessages['playRequestMessage'] = await message.channel.send(`Now Playing ${audioToPlay.title}, \`[${(0, util_1.secondsToTime)(audioToPlay.length)}]\``);
}
async function addToQueue(param, message) {
    if (!message.member.voice.channel) {
        message.channel.send("Please join a voice channel to listen");
        return;
    }
    if (guildPlayers[message.guild?.id] && guildPlayers[message.guild?.id].botLeaveTimeout) {
        clearTimeout(guildPlayers[message.guild?.id].botLeaveTimeout);
    }
    const newMessage = await message.channel.send(`Searching for ${param}`);
    const urls = await (0, youTube_1.parseYouTubePlayParameter)(param);
    newMessage.delete();
    if (!urls) {
        message.react('⛔').then(() => newMessage.edit("Unable to find " + param));
        return;
    }
    if (!guildPlayers[message.guild?.id])
        await createNewGuildPlayer(message, [...urls]);
    else
        guildPlayers[message.guild?.id].queue = [...guildPlayers[message.guild?.id].queue, ...urls];
    if (urls.length > 1)
        message.channel.send(`Added playlist of ${urls.length} songs to the queue`);
    else
        await message.react("👍");
    if (guildPlayers[message.guild?.id].player.state.status === voice_1.AudioPlayerStatus.Idle) {
        await playNext(guildPlayers[message.guild?.id].voiceConnection, message);
    }
}
exports.addToQueue = addToQueue;
function stop(message) {
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
    if (guildPlayers[message.guild?.id] && guildPlayers[message.guild?.id].player.state.status === voice_1.AudioPlayerStatus.Playing) {
        guildPlayers[message.guild?.id].player.stop();
        message.react("👍");
        return;
    }
    message.channel.send("I am not currently playing any music");
}
exports.skip = skip;
function clear(message) {
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
        guildPlayers[message.guild?.id].queue.slice(0, 5).forEach((x, i) => msg += `**#${i + 1}** ${x.title} \`[${(0, util_1.secondsToTime)(x.length)}]\`\n`);
        message.channel.send(msg);
        return;
    }
    if (isNaN(+param)) {
        message.channel.send("Please enter number of queue entries to view");
        return;
    }
    guildPlayers[message.guild?.id].queue.slice(0, +param).forEach((x, i) => msg += `**#${i + 1}** ${x.title} \`[${(0, util_1.secondsToTime)(x.length)}]\`\n`);
    message.channel.send(msg);
}
exports.getQueue = getQueue;
//# sourceMappingURL=MusicPlayer.js.map