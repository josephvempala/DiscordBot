import {Guild, Message} from "discord.js";
import {
    AudioPlayer,
    AudioPlayerStatus,
    createAudioPlayer,
    createAudioResource,
    DiscordGatewayAdapterCreator,
    joinVoiceChannel,
    StreamType,
    VoiceConnection,
    VoiceConnectionStatus,
} from "@discordjs/voice"
import {getYoutubeAudioStream, parseYouTubePlayParameter} from "./youTube";
import {secondsToTime, shuffleArray} from "./util"
import {IBasicVideoInfo, VideoInfoType} from "./IBasicVideoInfo";
import {getSoundCloudAudioStream, parseSoundCloudPlayParameter} from "./soundCloud";

type PlayerMessageDictionary = {
    [message: string]: Message;
}

interface IGuildPlayer {
    queue: IBasicVideoInfo[];
    player: AudioPlayer;
    voiceConnection: VoiceConnection;
    guild: Guild;
    currentlyPlaying: IBasicVideoInfo | null;
    playerMessages: PlayerMessageDictionary;
    botLeaveTimeout: NodeJS.Timeout | null;
}

const guildPlayers: { [guildId: string]: IGuildPlayer } = {};

async function createNewGuildPlayer(message: Message, queue?: IBasicVideoInfo[]) {
    const guildPlayer = {
        queue: queue ? queue : [],
        player: createAudioPlayer(),
        voiceConnection: joinVoiceChannel({
            selfDeaf: true,
            channelId: message.member!.voice.channel!.id,
            guildId: message.guild!.id,
            adapterCreator: message.guild!.voiceAdapterCreator as DiscordGatewayAdapterCreator
        }),
        guild: message.member?.guild!,
        currentlyPlaying: null,
        playerMessages: {} as PlayerMessageDictionary,
        botLeaveTimeout: null,
    }
    guildPlayers[message.guild?.id!] = guildPlayer;
    registerGuildPlayerEventListeners(guildPlayer);
    guildPlayer.voiceConnection.subscribe(guildPlayer.player);
}

async function removeGuildPlayer(guildPlayer: IGuildPlayer) {
    for (const element in guildPlayer.playerMessages) {
        let message = guildPlayer.playerMessages[element];
        if (message.deletable && !message.deleted) {
            await message.delete();
        }
    }
    guildPlayer.player.removeAllListeners(AudioPlayerStatus.Idle);
    guildPlayer.player.removeAllListeners("error");
    guildPlayer.voiceConnection.disconnect();
    delete guildPlayers[guildPlayer.guild.id];
}

function registerGuildPlayerEventListeners(guildPlayer: IGuildPlayer) {
    guildPlayer.voiceConnection.addListener(VoiceConnectionStatus.Disconnected, async () => {
        if (guildPlayers[guildPlayer.guild.id])
            await removeGuildPlayer(guildPlayer);
        guildPlayer.voiceConnection.destroy();
    });
    guildPlayer.player.addListener("error", async (e: any) => {
        console.log(e);
        await guildPlayer.playerMessages['playRequestMessage']?.delete();
        delete guildPlayer.playerMessages['playRequestMessage'];
        if (e.message === "Status code: 403" && guildPlayer.currentlyPlaying) {
            guildPlayer.queue?.push(guildPlayer.currentlyPlaying!);
        }
        guildPlayer.player.stop();
        await playNext(guildPlayer.voiceConnection, guildPlayer.playerMessages['latestToQueue']);
    });
    guildPlayer.player.addListener(AudioPlayerStatus.Idle, async () => {
        await guildPlayer.playerMessages['playRequestMessage']?.delete();
        delete guildPlayer.playerMessages['playRequestMessage'];
        if (guildPlayers[guildPlayer.guild.id].queue.length <= 0) {
            guildPlayer.botLeaveTimeout = setTimeout(async () => {
                await removeGuildPlayer(guildPlayer);
            }, 120000);
            return;
        }
        await playNext(guildPlayer.voiceConnection, guildPlayer.playerMessages['latestToQueue']);
    });
}

async function getAudioStream(info: IBasicVideoInfo) {
    switch (info.type) {
        case VideoInfoType.YouTube:
            return await getYoutubeAudioStream(info.url);
        case VideoInfoType.SoundCloud:
            return await getSoundCloudAudioStream(info.url);
    }
}

async function playNext(voiceConnection: VoiceConnection, message: Message): Promise<void> {
    const guildId = message.guild!.id;
    if (guildPlayers[guildId].queue.length <= 0) {
        return;
    }
    const audioToPlay = guildPlayers[guildId].queue.shift();
    guildPlayers[guildId].currentlyPlaying = audioToPlay!;
    const stream = await getAudioStream(audioToPlay!);
    if (!stream) {
        await message.react('⛔');
        await message.channel.send(`Unable to play ${audioToPlay!.title}`)
        return playNext(voiceConnection, message);
    }
    const resource = createAudioResource(stream, {inputType: StreamType.Arbitrary});
    guildPlayers[guildId].player.play(resource);
    guildPlayers[guildId].playerMessages['playRequestMessage'] = await message.channel.send(`Now Playing ${audioToPlay!.title}, \`[${secondsToTime(audioToPlay!.length)}]\``);
}

async function parsePlayParameter(param: string) {
    let info: IBasicVideoInfo[] | null;
    info = await parseSoundCloudPlayParameter(param);
    if (!info)
        info = await parseYouTubePlayParameter(param);
    return info;
}

export async function addToQueue(param: string, message: Message) {
    if (!message.member!.voice.channel) {
        message.channel.send("Please join a voice channel to listen");
        return;
    }
    if (!message.guild) {
        message.channel.send("An error occurred while processing command, please try again");
        return;
    }
    const guildId = message.guild.id;
    if (guildPlayers[guildId] && guildPlayers[guildId].botLeaveTimeout) {
        clearTimeout(guildPlayers[guildId].botLeaveTimeout!)
    }
    const newMessage = await message.channel.send(`Searching for ${param}`);
    const urls = await parsePlayParameter(param);
    newMessage.delete();
    if (!urls) {
        message.react('⛔').then(() => message.channel.send("Unable to find " + param));
        return;
    }
    if (!guildPlayers[guildId]) await createNewGuildPlayer(message, [...urls]);
    else guildPlayers[guildId].queue = [...guildPlayers[guildId].queue, ...urls];
    guildPlayers[guildId].playerMessages['latestToQueue'] = message;
    if (urls.length > 1) message.channel.send(`Added playlist of ${urls.length} songs to the queue \`[${secondsToTime(urls[0].length)}]\``);
    else {
        message.channel.send(`Added playlist of ${urls[0].title} queue`);
        await message.react("👍");
    }
    if (guildPlayers[guildId].player.state.status === AudioPlayerStatus.Idle) {
        await playNext(guildPlayers[guildId].voiceConnection, message);
    }
}

export function stop(message: Message) {
    if (!message.guild) {
        message.channel.send("An error occurred while processing command, please try again");
        return;
    }
    const guildId = message.guild.id;
    if (guildPlayers[guildId] && guildPlayers[guildId].player.state.status === AudioPlayerStatus.Playing) {
        guildPlayers[guildId].queue = [];
        guildPlayers[guildId].player.stop();
        message.react("👍");
        return;
    }
    message.channel.send("I am not currently playing any music");
}

export function shuffle(message: Message) {
    if (!message.guild) {
        message.channel.send("An error occurred while processing command, please try again");
        return;
    }
    const guildId = message.guild.id;
    if (guildPlayers[guildId] && guildPlayers[guildId].queue.length > 0) {
        shuffleArray(guildPlayers[guildId].queue);
        message.react("👍");
        return;
    }
    message.channel.send("The queue is empty");
}

export function skip(message: Message) {
    if (!message.guild) {
        message.channel.send("An error occurred while processing command, please try again");
        return;
    }
    const guildId = message.guild.id;
    if (guildPlayers[guildId] && guildPlayers[guildId].player.state.status === AudioPlayerStatus.Playing) {
        guildPlayers[guildId].player.stop();
        message.react("👍");
        return;
    }
    message.channel.send("I am not currently playing any music");
}

export function clear(message: Message) {
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

export function getQueue(param: string, message: Message) {
    if (!message.guild) {
        message.channel.send("An error occurred while processing command, please try again");
        return;
    }
    const guildId = message.guild.id;
    if (!guildPlayers[guildId] || guildPlayers[guildId].queue.length <= 0) {
        message.channel.send("The queue is empty");
        return;
    }
    let msg = ''
    if (!param) {
        guildPlayers[guildId].queue.slice(0, 5).forEach((x, i) => msg += `**#${i + 1}** ${x.title} \`[${secondsToTime(x.length)}]\`\n`);
        message.channel.send(msg);
        return;
    }
    if (isNaN(+param)) {
        message.channel.send("Please enter number of queue entries to view");
        return;
    }
    guildPlayers[guildId].queue.slice(0, +param).forEach((x, i) => msg += `**#${i + 1}** ${x.title} \`[${secondsToTime(x.length)}]\`\n`);
    message.channel.send(msg);
}