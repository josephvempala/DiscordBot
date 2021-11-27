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
import {getYoutubeAudioStream, parseYouTubePlayParameter} from "./youTube";
import {secondsToTime, shuffleArray} from "./util"
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
const voiceChannels = new Map<string, Map<string,GuildMember>>();

async function createNewGuildPlayer(message: Message, queue?: IBasicVideoInfo[]) {
    const guildPlayer = {
        queue: queue ? queue : [],
        player: createAudioPlayer(),
        listeners: [],
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
        replayRetries: 0,
    }
    guildPlayers[message.guild?.id!] = guildPlayer;
    const voiceChannelMap = new Map<string, GuildMember>();
    message.member!.voice.channel!.members!.forEach(x => {
        voiceChannelMap.set(x.id, x);
    });
    voiceChannels.set(message.member!.voice.channel!.id, voiceChannelMap);
    registerGuildPlayerEventListeners(guildPlayer);
    guildPlayer.voiceConnection.subscribe(guildPlayer.player);
}

async function removeGuildPlayer(guildPlayer: IGuildPlayer) {
    for (const element in guildPlayer.playerMessages) {
        let message = guildPlayer.playerMessages[element];
        if (message.deletable && !message.deleted) {
            await message.delete();
            delete guildPlayer.playerMessages[element];
        }
    }
    guildPlayer.player.removeAllListeners(AudioPlayerStatus.Idle);
    guildPlayer.player.removeAllListeners("error");
    delete guildPlayers[guildPlayer.guild.id];
    guildPlayer.voiceConnection.disconnect();
    guildPlayer.voiceConnection.destroy();
}

function registerGuildPlayerEventListeners(guildPlayer: IGuildPlayer) {
    guildPlayer.voiceConnection.addListener(VoiceConnectionStatus.Disconnected, async () => {
        if (guildPlayers[guildPlayer.guild.id])
            await removeGuildPlayer(guildPlayer);
    });
    guildPlayer.player.addListener("debug", () => {
        console.log(new Date() + ":  " + guildPlayer.player.state.status);
    })
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
            }, 60000);
            return;
        }
        await playNext(guildPlayer.voiceConnection, guildPlayer.playerMessages['latestToQueue']);
    });
    guildPlayer.player.addListener(AudioPlayerStatus.Playing, async () => {
        guildPlayer.replayRetries = 0;
        guildPlayer.playerMessages['playRequest'] = await guildPlayer
            .playerMessages['latestToQueue'].channel
            .send(`Now Playing ${guildPlayer.currentlyPlaying!.title}, \`[${guildPlayer.currentlyPlaying!.isLiveStream ? "LIVE 🔴" : secondsToTime(guildPlayer.currentlyPlaying!.length)}]\``);
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
    const guildId = message.guild!.id;
    if (guildPlayers[guildId].queue.length <= 0) {
        return;
    }
    const audioToPlay = guildPlayers[guildId].queue.shift();
    guildPlayers[guildId].currentlyPlaying = audioToPlay!;
    const stream = await getAudioStream(audioToPlay!);
    if (!stream[0]) {
        await message.react('⛔');
        await message.channel.send(`${stream[1]} for ${audioToPlay!.title}`)
        return playNext(voiceConnection, message);
    }
    const resource = createAudioResource(stream[0], {inputType: StreamType.Arbitrary});
    guildPlayers[guildId].player.play(resource);
}

async function parsePlayParameter(param: string) {
    let info: IBasicVideoInfo[] | null;
    info = await parseSoundCloudPlayParameter(param);
    if (!info)
        info = await parseMixlrPlayParameter(param);
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
    if (urls.length > 1) message.channel.send(`Added playlist of ${urls.length} songs to the queue`);
    else {
        message.channel.send(`Added ${urls[0].title} queue \`[${urls[0].isLiveStream ? "LIVE 🔴" : secondsToTime(urls[0].length)}]\``);
        await message.react("👍");
    }
    if (guildPlayers[guildId].player.state.status === AudioPlayerStatus.Idle) {
        await playNext(guildPlayers[guildId].voiceConnection, message);
    }
}

export async function voiceChannelChange(oldState: VoiceState, newState: VoiceState) {
    const oldStateId = oldState.channelId;
    const newStateId = newState.channelId;
    if(oldStateId && voiceChannels.has(oldStateId)){
        const voiceChannelMemberMap = voiceChannels.get(oldStateId);
        if(voiceChannelMemberMap && voiceChannelMemberMap.has(oldState.member!.id)){
            const memberGuildId = voiceChannelMemberMap.get(oldState.member!.id)!.guild.id;
            voiceChannelMemberMap.delete(oldState.member!.id);
            if(voiceChannelMemberMap.size == 1){
                guildPlayers[memberGuildId].playerMessages['latestToQueue'].channel.send("All members left voice channel. Player stopped.")
                await removeGuildPlayer(guildPlayers[memberGuildId]);
            }
        }
    }
    if(newStateId && voiceChannels.has(newStateId)){
        voiceChannels.get(newStateId)!.set(newState.member!.id, newState.member!);
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
        guildPlayers[guildId].queue.slice(0, 5).forEach((x, i) => msg += `**#${i + 1}** ${x.title} \`[${x.isLiveStream ? "LIVE 🔴" : (x.length)}]\`\n`);
        message.channel.send(msg);
        return;
    }
    if (isNaN(+param)) {
        message.channel.send("Please enter number of queue entries to view");
        return;
    }
    guildPlayers[guildId].queue.slice(0, +param).forEach((x, i) => msg += `**#${i + 1}** ${x.title} \`[${x.isLiveStream ? "LIVE 🔴" : (x.length)}]\`\n`);
    message.channel.send(msg);
}

export async function bbpm(message: Message) {
    await addToQueue('https://mixlr.com/rjlee27/', message);
}

export function getNowPlaying(message: Message) {
    const currentlyPlaying = guildPlayers[message.guild?.id!].currentlyPlaying;
    if (!currentlyPlaying) {
        message.channel.send("I am not currently playing any music");
        return;
    }
    message.channel.send(`${currentlyPlaying.title} \`[${currentlyPlaying.isLiveStream ? "LIVE 🔴" : (currentlyPlaying.length)}]\`\n`);
}

export async function leave(message : Message){
    await removeGuildPlayer(guildPlayers[message.guild?.id!]);
}