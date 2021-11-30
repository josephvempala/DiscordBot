import {Guild, GuildMember, Message, VoiceState} from "discord.js";
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
import {getYoutubeAudioStream, getYoutubeSearchResult, parseYouTubePlayParameter} from "./youTube";
import {isValidURL, secondsToTime, shuffleArray} from "./util"
import {IBasicVideoInfo, VideoInfoType} from "./IBasicVideoInfo";
import {getSoundCloudAudioStream, parseSoundCloudPlayParameter} from "./soundCloud";
import {GetAudioStreamResult} from "./GetAudioStreamResult";
import {getMixlrAudioStream, parseMixlrPlayParameter} from "./mixlr";

type PlayerMessageDictionary = {
    [message: string]: Message;
}

interface IGuildPlayer {
    queue: IBasicVideoInfo[];
    player: AudioPlayer;
    listeners: GuildMember[];
    voiceConnection: VoiceConnection;
    guild: Guild;
    currentlyPlaying: IBasicVideoInfo | null;
    playerMessages: PlayerMessageDictionary;
    botLeaveTimeout: NodeJS.Timeout | null;
    replayRetries: number;
}

const guildPlayers: { [guildId: string]: IGuildPlayer } = {};
const voiceChannels = new Map<string, Map<string, GuildMember>>();

function createNewGuildPlayer(message: Message, queue?: IBasicVideoInfo[]) {
    const guildPlayer = {
        queue: queue ? queue : [],
        player: createAudioPlayer(),
        listeners: [],
        voiceConnection: joinVoiceChannel({
            selfDeaf: true,
            channelId: message.member!.voice.channel!.id,
            guildId: message.guildId!,
            adapterCreator: message.guild!.voiceAdapterCreator as DiscordGatewayAdapterCreator
        }),
        guild: message.member?.guild!,
        currentlyPlaying: null,
        playerMessages: {} as PlayerMessageDictionary,
        botLeaveTimeout: null,
        replayRetries: 0,
    }
    guildPlayers[message.guildId!] = guildPlayer;
    const voiceChannelMap = new Map<string, GuildMember>();
    message.member!.voice.channel!.members!.forEach(x => {
        voiceChannelMap.set(x.id, x);
    });
    voiceChannels.set(message.member!.voice.channel!.id, voiceChannelMap);
    registerGuildPlayerEventListeners(guildPlayer);
    guildPlayer.voiceConnection.subscribe(guildPlayer.player);
    return guildPlayer;
}

async function removeGuildPlayer(guildPlayer: IGuildPlayer) {
    if (!guildPlayers[guildPlayer.guild.id]) return;
    delete guildPlayers[guildPlayer.guild.id];
    voiceChannels.delete(guildPlayer.guild.id);
    clearTimeout(guildPlayer.botLeaveTimeout!);
    for (const element in guildPlayer.playerMessages) {
        let message = guildPlayer.playerMessages[element];
        if (message.deletable && !message.deleted) {
            await message.delete();
            delete guildPlayer.playerMessages[element];
        }
    }
    guildPlayer.player.removeAllListeners(AudioPlayerStatus.Idle);
    guildPlayer.player.removeAllListeners(AudioPlayerStatus.Playing);
    guildPlayer.player.removeAllListeners("error");
    guildPlayer.voiceConnection.removeAllListeners(VoiceConnectionStatus.Disconnected);
    guildPlayer.voiceConnection.disconnect();
    guildPlayer.voiceConnection.destroy();
}

function registerGuildPlayerEventListeners(guildPlayer: IGuildPlayer) {
    guildPlayer.voiceConnection.addListener(VoiceConnectionStatus.Disconnected, async () => {
        await removeGuildPlayer(guildPlayer);
    });
    guildPlayer.player.addListener("error", async (e: any) => {
        if (guildPlayer.playerMessages['playRequest']) {
            await guildPlayer.playerMessages['playRequest'].delete();
            delete guildPlayer.playerMessages['playRequest'];
        }
        if (e.message === "Status code: 403" && guildPlayer.currentlyPlaying && guildPlayer.replayRetries < 5) {
            guildPlayer.queue?.push(guildPlayer.currentlyPlaying!);
            guildPlayer.replayRetries++;
            console.log('403');
        } else {
            console.log(e);
        }
        guildPlayer.player.stop();
        await playNext(guildPlayer.voiceConnection, guildPlayer.playerMessages['latestToQueue']);
    });
    guildPlayer.player.addListener(AudioPlayerStatus.Idle, async () => {
        if (guildPlayer.playerMessages['playRequest']) {
            await guildPlayer.playerMessages['playRequest'].delete();
            delete guildPlayer.playerMessages['playRequest'];
        }
        if (guildPlayers[guildPlayer.guild.id].queue.length <= 0) {
            guildPlayer.botLeaveTimeout = setTimeout(async () => {
                await removeGuildPlayer(guildPlayer);
            }, 600000);
            return;
        }
        await playNext(guildPlayer.voiceConnection, guildPlayer.playerMessages['latestToQueue']);
    });
    guildPlayer.player.addListener(AudioPlayerStatus.Playing, async () => {
        guildPlayer.replayRetries = 0;
        const newPlayingMessage = `Now Playing ${guildPlayer.currentlyPlaying!.title}, \`[${guildPlayer.currentlyPlaying!.isLiveStream ? "LIVE 🔴" : secondsToTime(guildPlayer.currentlyPlaying!.length)}]\``;
        if (guildPlayer.playerMessages['playRequest'] && guildPlayer.playerMessages['playRequest'].content == newPlayingMessage) return;
        guildPlayer.playerMessages['playRequest'] = await guildPlayer
            .playerMessages['latestToQueue'].channel
            .send(newPlayingMessage);
    });
}

async function getAudioStream(info: IBasicVideoInfo) {
    switch (info.type) {
        case VideoInfoType.YouTube:
            return await getYoutubeAudioStream(info.url);
        case VideoInfoType.SoundCloud:
            return await getSoundCloudAudioStream(info.url);
        case VideoInfoType.Mixlr:
            return await getMixlrAudioStream(info.url);
    }
    return [null, null] as GetAudioStreamResult;
}

async function playNext(voiceConnection: VoiceConnection, message: Message): Promise<void> {
    const guildPlayer = guildPlayers[message.guildId!];
    if (guildPlayer.queue.length <= 0) return;
    const audioToPlay = guildPlayer.queue.shift();
    guildPlayer.currentlyPlaying = audioToPlay!;
    const stream = await getAudioStream(audioToPlay!);
    if (stream[0]) {
        const resource = createAudioResource(stream[0], {inputType: StreamType.Arbitrary});
        guildPlayer.player.play(resource);
        return;
    }
    await message.react('⛔');
    await message.channel.send(`${stream[1]} for ${audioToPlay!.title}`)
    return playNext(voiceConnection, message);
}

async function parsePlayParameter(param: string) {
    let info: IBasicVideoInfo[] | null;
    if (!isValidURL(param)) return null;
    info = await parseSoundCloudPlayParameter(param);
    if (!info) info = await parseMixlrPlayParameter(param);
    if (!info) info = await parseYouTubePlayParameter(param);
    return info;
}

export async function addToQueue(param: string, message: Message) {
    if (!message.member!.voice.channel) {
        message.channel.send("Please join a voice channel to listen");
        return;
    }
    let guildPlayer = guildPlayers[message.guildId!];
    if (guildPlayer && guildPlayer.botLeaveTimeout) clearTimeout(guildPlayer.botLeaveTimeout!)
    let urls = await parsePlayParameter(param);
    if (!urls) {
        const newMessage = await message.channel.send(`Searching for ${param}`);
        urls = await getYoutubeSearchResult(param);
        newMessage.delete();
    }
    if (!urls) {
        message.react('⛔').then(() => message.channel.send("Unable to find " + param));
        return;
    }
    if (!guildPlayer) guildPlayer = createNewGuildPlayer(message, [...urls]);
    else guildPlayer.queue = [...guildPlayer.queue, ...urls];
    guildPlayer.playerMessages['latestToQueue'] = message;
    if (urls.length > 1) message.channel.send(`Added playlist of ${urls.length} songs to the queue`);
    else {
        message.channel.send(`Added ${urls[0].title} queue \`[${urls[0].isLiveStream ? "LIVE 🔴" : secondsToTime(urls[0].length)}]\``);
        await message.react("👍");
    }
    if (guildPlayer.player.state.status === AudioPlayerStatus.Idle) await playNext(guildPlayer.voiceConnection, message);
}

export async function voiceChannelChange(oldState: VoiceState, newState: VoiceState) {
    const oldStateId = oldState.channelId;
    const newStateId = newState.channelId;
    if (oldStateId && voiceChannels.has(oldStateId)) {
        const voiceChannelMemberMap = voiceChannels.get(oldStateId);
        if (voiceChannelMemberMap && voiceChannelMemberMap.has(oldState.member!.id)) {
            const memberGuildPlayer = guildPlayers[voiceChannelMemberMap.get(oldState.member!.id)!.guild.id];
            voiceChannelMemberMap.delete(oldState.member!.id);
            if (memberGuildPlayer && voiceChannelMemberMap.size === 1) await removeGuildPlayer(memberGuildPlayer);
        }
    }
    if (newStateId && voiceChannels.has(newStateId)) voiceChannels.get(newStateId)!.set(newState.member!.id, newState.member!);
}

export function stop(message: Message) {
    const guildPlayer = guildPlayers[message.guildId!];
    if (!guildPlayer || guildPlayer.player.state.status !== AudioPlayerStatus.Playing) {
        message.channel.send("I am not currently playing any music");
        return;
    }
    guildPlayer.queue = [];
    guildPlayer.player.stop();
    message.react("👍");
}

export function shuffle(message: Message) {
    const guildPlayer = guildPlayers[message.guildId!];
    if (!guildPlayer || guildPlayer.queue.length === 0) {
        message.channel.send("The queue is empty");
        return;
    }
    shuffleArray(guildPlayer.queue);
    message.react("👍");

}

export function skip(message: Message) {
    const guildPlayer = guildPlayers[message.guildId!];
    if (!guildPlayer || guildPlayer.player.state.status !== AudioPlayerStatus.Playing) {
        message.channel.send("I am not currently playing any music");
        return;
    }
    guildPlayer.player.stop();
    message.react("👍");
}

export function clear(message: Message) {
    const guildPlayer = guildPlayers[message.guildId!];
    if (!guildPlayer || guildPlayer.queue.length == 0) {
        message.channel.send("The queue is empty");
        return;
    }
    guildPlayer.queue = [];
    message.react("👍");
}

export function getQueue(param: string, message: Message) {
    const guildPlayer = guildPlayers[message.guildId!];
    if (!guildPlayer || guildPlayer.queue.length <= 0) {
        message.channel.send("The queue is empty");
        return;
    }
    let msg = `►**#1** ${guildPlayer.currentlyPlaying?.title} \`[${guildPlayer.currentlyPlaying?.isLiveStream ? "LIVE 🔴" : secondsToTime(guildPlayer.currentlyPlaying?.length!)}]\`\n`
    if (!param) {
        guildPlayer.queue.slice(0, 5).forEach((x, i) => msg += `**#${i + 2}** ${x.title} \`[${x.isLiveStream ? "LIVE 🔴" : secondsToTime(x.length)}]\`\n`);
        message.channel.send(msg);
        return;
    }
    if (isNaN(+param)) {
        message.channel.send("Please enter number of queue entries to view");
        return;
    }
    guildPlayer.queue.slice(0, +param).forEach((x, i) => msg += `**#${i + 2}** ${x.title} \`[${x.isLiveStream ? "LIVE 🔴" : secondsToTime(x.length)}]\`\n`);
    message.channel.send(msg);
}

export async function bbpm(message: Message) {
    await addToQueue('https://mixlr.com/rjlee27/', message);
}

export function getNowPlaying(message: Message) {
    const currentlyPlaying = guildPlayers[message.guildId!].currentlyPlaying;
    if (!currentlyPlaying) {
        message.channel.send("I am not currently playing any music");
        return;
    }
    message.channel.send(`${currentlyPlaying.title} \`[${currentlyPlaying.isLiveStream ? "LIVE 🔴" : secondsToTime(currentlyPlaying.length)}]\`\n`);
}

export async function leave(message: Message) {
    await removeGuildPlayer(guildPlayers[message.guildId!]);
}