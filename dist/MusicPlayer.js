"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getQueue = exports.clear = exports.skip = exports.shuffle = exports.stop = exports.addToQueue = void 0;
const voice_1 = require("@discordjs/voice");
const youTube_1 = require("./youTube");
const util_1 = require("./util");
const IBasicVideoInfo_1 = require("./IBasicVideoInfo");
const soundCloud_1 = require("./soundCloud");
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
        await playNext(guildPlayer.voiceConnection, guildPlayer.playerMessages['latestToQueue']);
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
        await playNext(guildPlayer.voiceConnection, guildPlayer.playerMessages['latestToQueue']);
    });
}
async function getAudioStream(info) {
    switch (info.type) {
        case IBasicVideoInfo_1.VideoInfoType.YouTube:
            return await (0, youTube_1.getYoutubeAudioStream)(info.url);
        case IBasicVideoInfo_1.VideoInfoType.SoundCloud:
            return await (0, soundCloud_1.getSoundCloudAudioStream)(info.url);
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
async function parsePlayParameter(param) {
    let info;
    info = await (0, soundCloud_1.parseSoundCloudPlayParameter)(param);
    if (!info)
        info = await (0, youTube_1.parseYouTubePlayParameter)(param);
    return info;
}
async function addToQueue(param, message) {
    if (!message.member.voice.channel) {
        message.channel.send("Please join a voice channel to listen");
        return;
    }
    if (!message.guild) {
        message.channel.send("An error occurred while processing command, please try again");
        return;
    }
    const guildId = message.guild.id;
    if (guildPlayers[guildId] && guildPlayers[guildId].botLeaveTimeout) {
        clearTimeout(guildPlayers[guildId].botLeaveTimeout);
    }
    const newMessage = await message.channel.send(`Searching for ${param}`);
    const urls = await parsePlayParameter(param);
    newMessage.delete();
    if (!urls) {
        message.react('⛔').then(() => message.channel.send("Unable to find " + param));
        return;
    }
    if (!guildPlayers[guildId])
        await createNewGuildPlayer(message, [...urls]);
    else
        guildPlayers[guildId].queue = [...guildPlayers[guildId].queue, ...urls];
    guildPlayers[guildId].playerMessages['latestToQueue'] = message;
    if (urls.length > 1)
        message.channel.send(`Added playlist of ${urls.length} songs to the queue`);
    else {
        message.channel.send(`Added playlist of ${urls[0].title} queue`);
        await message.react("👍");
    }
    if (guildPlayers[guildId].player.state.status === voice_1.AudioPlayerStatus.Idle) {
        await playNext(guildPlayers[guildId].voiceConnection, message);
    }
}
exports.addToQueue = addToQueue;
function stop(message) {
    if (!message.guild) {
        message.channel.send("An error occurred while processing command, please try again");
        return;
    }
    const guildId = message.guild.id;
    if (guildPlayers[guildId] && guildPlayers[guildId].player.state.status === voice_1.AudioPlayerStatus.Playing) {
        guildPlayers[guildId].queue = [];
        guildPlayers[guildId].player.stop();
        message.react("👍");
        return;
    }
    message.channel.send("I am not currently playing any music");
}
exports.stop = stop;
function shuffle(message) {
    if (!message.guild) {
        message.channel.send("An error occurred while processing command, please try again");
        return;
    }
    const guildId = message.guild.id;
    if (guildPlayers[guildId] && guildPlayers[guildId].queue.length > 0) {
        (0, util_1.shuffleArray)(guildPlayers[guildId].queue);
        message.react("👍");
        return;
    }
    message.channel.send("The queue is empty");
}
exports.shuffle = shuffle;
function skip(message) {
    if (!message.guild) {
        message.channel.send("An error occurred while processing command, please try again");
        return;
    }
    const guildId = message.guild.id;
    if (guildPlayers[guildId] && guildPlayers[guildId].player.state.status === voice_1.AudioPlayerStatus.Playing) {
        guildPlayers[guildId].player.stop();
        message.react("👍");
        return;
    }
    message.channel.send("I am not currently playing any music");
}
exports.skip = skip;
function clear(message) {
    if (!message.guild) {
        message.channel.send("An error occurred while processing command, please try again");
        return;
    }
    const guildId = message.guild.id;
    if (guildPlayers[guildId] && guildPlayers[guildId].queue.length > 0) {
        guildPlayers[guildId].queue = [];
        message.react("👍");
        return;
    }
    message.channel.send("The queue is empty");
}
exports.clear = clear;
function getQueue(param, message) {
    if (!message.guild) {
        message.channel.send("An error occurred while processing command, please try again");
        return;
    }
    const guildId = message.guild.id;
    if (!guildPlayers[guildId] || guildPlayers[guildId].queue.length <= 0) {
        message.channel.send("The queue is empty");
        return;
    }
    let msg = '';
    if (!param) {
        guildPlayers[guildId].queue.slice(0, 5).forEach((x, i) => msg += `**#${i + 1}** ${x.title} \`[${(0, util_1.secondsToTime)(x.length)}]\`\n`);
        message.channel.send(msg);
        return;
    }
    if (isNaN(+param)) {
        message.channel.send("Please enter number of queue entries to view");
        return;
    }
    guildPlayers[guildId].queue.slice(0, +param).forEach((x, i) => msg += `**#${i + 1}** ${x.title} \`[${(0, util_1.secondsToTime)(x.length)}]\`\n`);
    message.channel.send(msg);
}
exports.getQueue = getQueue;
//# sourceMappingURL=MusicPlayer.js.map