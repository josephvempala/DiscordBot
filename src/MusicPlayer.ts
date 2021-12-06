import {Guild, GuildMember, Message, TextChannel, VoiceState} from "discord.js";
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
import {
    getYoutubeAudioStream,
    getYoutubeSearchResult,
    getYoutubeSearchResultInfo,
    parseYouTubePlayParameter
} from "./youTube";
import {isValidURL, secondsToTime, shuffleArray, timer} from "./util"
import {IBasicVideoInfo, VideoInfoType} from "./IBasicVideoInfo";
import {getSoundCloudAudioStream, parseSoundCloudPlayParameter} from "./soundCloud";
import {GetAudioStreamResult} from "./GetAudioStreamResult";
import {getMixlrAudioStream, parseMixlrPlayParameter} from "./mixlr";

type PlayerMessageDictionary = {
    [message: string]: Message;
}

type GuildId = string;
type MemberId = string

interface IGuildPlayer {
    queue: IBasicVideoInfo[];
    player: AudioPlayer;
    voiceConnection: VoiceConnection;
    textChannel: TextChannel;
    guild: Guild;
    currentlyPlaying: IBasicVideoInfo | null;
    playerMessages: PlayerMessageDictionary;
    botLeaveTimeout: NodeJS.Timeout | null;
    voiceChannelMembers: Map<MemberId, GuildMember>;
    replayRetries: number;
    playSearch: IBasicVideoInfo[] | null;
}

const guildPlayers: { [guildId: GuildId]: IGuildPlayer } = {};

function createNewGuildPlayer(message: Message, queue?: IBasicVideoInfo[]) {
    const guildPlayer = {
        queue: queue ? queue : [],
        player: createAudioPlayer(),
        textChannel: message.channel as TextChannel,
        voiceConnection: joinVoiceChannel({
            selfDeaf: true,
            channelId: message.member!.voice.channel!.id,
            guildId: message.guildId!,
            adapterCreator: message.guild!.voiceAdapterCreator as DiscordGatewayAdapterCreator
        }),
        guild: message.member?.guild!,
        currentlyPlaying: null,
        playerMessages: {} as PlayerMessageDictionary,
        botLeaveTimeout: setTimeout(async () => {
            await removeGuildPlayer(guildPlayer);
        }, 600000),
        voiceChannelMembers: new Map<MemberId, GuildMember>(),
        replayRetries: 0,
        playSearch: null
    }
    guildPlayers[message.guildId!] = guildPlayer;
    message.member!.voice.channel!.members!.forEach(x => {
        guildPlayer.voiceChannelMembers.set(x.id, x);
    });
    registerGuildPlayerEventListeners(guildPlayer);
    guildPlayer.voiceConnection.subscribe(guildPlayer.player);
    return guildPlayer;
}

async function removeGuildPlayer(guildPlayer: IGuildPlayer) {
    if (!guildPlayers[guildPlayer.guild.id]) return;
    delete guildPlayers[guildPlayer.guild.id];
    clearTimeout(guildPlayer.botLeaveTimeout!);
    guildPlayer.botLeaveTimeout = null;
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
            await timer(100 * guildPlayer.replayRetries);
            guildPlayer.queue?.unshift(guildPlayer.currentlyPlaying!);
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
    guildPlayer.player.addListener(AudioPlayerStatus.Playing, async (oldState) => {
        guildPlayer.replayRetries = 0;
        if (oldState.status === AudioPlayerStatus.AutoPaused || oldState.status === AudioPlayerStatus.Paused) return;
        const newPlayingMessage = `Now Playing ${guildPlayer.currentlyPlaying!.title}, \`[${guildPlayer.currentlyPlaying!.isLiveStream ? "LIVE 🔴" : secondsToTime(guildPlayer.currentlyPlaying!.length)}]\``;
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

export async function playDispatcher(message: Message, param: string) {
    const guildPlayer = guildPlayers[message.guildId!];
    const searchResults = guildPlayer.playSearch ? [...guildPlayer.playSearch] : null;
    guildPlayer.playSearch = null;
    if (!param && guildPlayer && guildPlayer.player.state.status === AudioPlayerStatus.Paused) {
        guildPlayer.player.unpause();
        message.channel.send(`Resumed ${guildPlayer.currentlyPlaying!.title}`);
        return;
    }
    if (isNaN(+param)) {
        await addToQueue(param, message);
        return;
    }
    if (+param && searchResults) {
        await addToQueue(searchResults[+param - 1].url, message);
        return;
    }
    if (+param < guildPlayer.queue.length) {
        const songPointer = +param - 2;
        if (songPointer === -1 && guildPlayer.currentlyPlaying) {
            guildPlayer.queue.unshift(guildPlayer.currentlyPlaying);
        } else {
            const targetSong = guildPlayer.queue[songPointer];
            guildPlayer.queue = guildPlayer.queue.filter((x, index) => index != songPointer);
            guildPlayer.queue.unshift(targetSong);
        }
        await playNext(guildPlayer.voiceConnection, message);
        return;
    }
    message.channel.send(`Song number ${param} is not valid`);
}

export async function search(message: Message, param: string) {
    if (!message.member!.voice.channel) {
        message.channel.send("Please join a voice channel to listen");
        return;
    }
    if (!guildPlayers[message.guildId!]) createNewGuildPlayer(message);
    const guildPlayer = guildPlayers[message.guildId!];
    const newMessage = await message.channel.send(`Searching for ${param}`);
    guildPlayer.playSearch = await getYoutubeSearchResultInfo(param);
    newMessage.delete();
    if (!guildPlayer.playSearch) {
        message.channel.send(`unable to get search results for ${param}`);
    }
    let msg = '**Please select a track with the -p 1-5 command**\n';
    guildPlayer.playSearch!.forEach((x, i) => msg += `**#${i + 1}** ${x.title} \`[${x.isLiveStream ? "LIVE 🔴" : secondsToTime(x.length)}]\`\n`);
    message.channel.send(msg);
}

export async function addToQueue(param: string, message: Message) {
    if (!message.member!.voice.channel) {
        message.channel.send("Please join a voice channel to listen");
        return;
    }
    let guildPlayer = guildPlayers[message.guildId!];
    if (guildPlayer && guildPlayer.botLeaveTimeout) {
        clearTimeout(guildPlayer.botLeaveTimeout!);
        guildPlayer.botLeaveTimeout = null;
    }
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
    const oldChannelId = oldState.channelId;
    const newChannelId = newState.channelId;
    const oldGuildPlayer = guildPlayers[oldState.guild.id];
    const newGuildPlayer = guildPlayers[newState.guild.id];
    if (oldChannelId && oldGuildPlayer) {
        const voiceChannelMemberMap = oldGuildPlayer.voiceChannelMembers;
        if (voiceChannelMemberMap.has(oldState.member!.id)) {
            voiceChannelMemberMap.delete(oldState.member!.id);
            if (voiceChannelMemberMap.size === 1) {
                oldGuildPlayer.textChannel.send("All members left voice channel. Player paused.")
                oldGuildPlayer.player.pause();
                oldGuildPlayer.botLeaveTimeout = setTimeout(async () => {
                    await removeGuildPlayer(oldGuildPlayer);
                }, 60000);
            }
        }
    }
    if (newChannelId && newGuildPlayer) {
        newGuildPlayer.voiceChannelMembers.set(newState.member!.id, newState.member!);
        if (newGuildPlayer.voiceChannelMembers.size === 2 && oldGuildPlayer.botLeaveTimeout && newGuildPlayer.player.state.status === AudioPlayerStatus.Paused) {
            clearTimeout(oldGuildPlayer.botLeaveTimeout!);
            oldGuildPlayer.botLeaveTimeout = null;
            newGuildPlayer.player.unpause();
        }
    }
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
    if (!guildPlayer || guildPlayer.queue.length <= 0 && !guildPlayer.currentlyPlaying) {
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
    const queueSlice = guildPlayer.queue.slice(0, +param);
    let i = 2;
    for (const x of queueSlice) {
        if (msg.length > 3500) {
            return;
        }
        msg += `**#${i}** ${x.title} \`[${x.isLiveStream ? "LIVE 🔴" : secondsToTime(x.length)}]\`\n`;
        i++;
    }
    message.react("👍");
    message.channel.send(msg);
}

export async function bbpm(message: Message) {
    await addToQueue('https://mixlr.com/rjlee27/', message);
    await message.react("👍");
}

export function getNowPlaying(message: Message) {
    const currentlyPlaying = guildPlayers[message.guildId!].currentlyPlaying;
    if (!currentlyPlaying) {
        message.channel.send("I am not currently playing any music");
        return;
    }
    message.channel.send(`${currentlyPlaying.title} \`[${currentlyPlaying.isLiveStream ? "LIVE 🔴" : secondsToTime(currentlyPlaying.length)}]\`\n`);
    message.react("👍");
}

export function pause(message: Message) {
    const guildPlayer = guildPlayers[message.guildId!];
    if (guildPlayer.player.state.status === AudioPlayerStatus.Playing) {
        guildPlayer.player.pause();
        message.channel.send(`paused ${guildPlayer.currentlyPlaying!.title}`);
    }
    message.react("👍");
}

export async function leave(message: Message) {
    await removeGuildPlayer(guildPlayers[message.guildId!]);
    await message.react("👋");
}