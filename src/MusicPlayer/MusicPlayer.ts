import {GuildMember, Message, TextChannel, VoiceState} from 'discord.js';
import {
    AudioPlayerStatus,
    createAudioPlayer,
    createAudioResource,
    DiscordGatewayAdapterCreator,
    entersState,
    joinVoiceChannel,
    StreamType,
    VoiceConnection,
    VoiceConnectionStatus,
} from '@discordjs/voice';
import {getYoutubeAudioStream, getYoutubeSearchResult, getYoutubeSearchResultInfo, parseYouTubePlayParameter} from './youTube';
import {isValidURL, secondsToTime, shuffleArray, timer} from '../lib/util';
import {IBasicVideoInfo, VideoInfoType} from '../Interfaces/IBasicVideoInfo';
import {getSoundCloudAudioStream, parseSoundCloudPlayParameter} from './soundCloud';
import {GetAudioStreamResult} from '../Interfaces/GetAudioStreamResult';
import {getMixlrAudioStream, parseMixlrPlayParameter} from './mixlr';
import {logger} from '../services/logger.js';
import {client} from '../index';
import {IGuildMusicPlayer} from '../Interfaces/IGuildMusicPlayer';
import {MaxQueueHistorySize, MaxQueueSize} from '../lib/Constants';
import fs from 'fs';

type GuildId = string;
type MemberId = string;

const guildPlayers: {[guildId: GuildId]: IGuildMusicPlayer} = {};

async function createNewGuildPlayer(message: Message, queue?: IBasicVideoInfo[]) {
    const guildPlayer: IGuildMusicPlayer = {
        queue: queue ? queue : [],
        queueHistory: [],
        player: createAudioPlayer(),
        textChannel: message.channel as TextChannel,
        voiceConnection: joinVoiceChannel({
            channelId: message.member!.voice.channel!.id,
            guildId: message.guildId!,
            adapterCreator: message.guild!.voiceAdapterCreator as DiscordGatewayAdapterCreator,
        }),
        guild: message.member!.guild!,
        currentlyPlaying: null,
        playerMessages: new Map<string, Message>(),
        botLeaveTimeout: null,
        voiceChannelMembers: new Map<MemberId, GuildMember>(),
        replayRetries: 0,
        playSearch: null,
    };
    await entersState(guildPlayer.voiceConnection, VoiceConnectionStatus.Ready, 30_000);
    guildPlayers[message.guildId!] = guildPlayer;
    message.member!.voice.channel!.members!.forEach((x) => {
        guildPlayer.voiceChannelMembers.set(x.id, x);
    });
    if (guildPlayer.voiceChannelMembers.size < 1) {
        guildPlayer.botLeaveTimeout = setTimeout(() => {
            removeGuildPlayer(guildPlayer, 'Users Left channel');
        }, 600000);
        logger.debug(`Added Timeout for bot to leave as no listeners in vc`, guildPlayer.guild.id);
    }
    registerGuildPlayerEventListeners(guildPlayer);
    guildPlayer.voiceConnection.subscribe(guildPlayer.player);
    logger.debug(`Created music player`, guildPlayer.guild.id);
    return guildPlayer;
}

function removeGuildPlayer(guildPlayer: IGuildMusicPlayer, reason: string) {
    logger.debug(`Removing music player: ${reason}`, guildPlayer.guild.id);
    if (!guildPlayers[guildPlayer.guild.id]) return;
    delete guildPlayers[guildPlayer.guild.id];
    clearBotLeaveTimeout(guildPlayer);
    for (const element in guildPlayer.playerMessages) {
        const message = guildPlayer.playerMessages.get(element)!;
        if (message.deletable) {
            message.delete();
            guildPlayer.playerMessages.delete(element);
        }
    }
    guildPlayer.player.removeAllListeners(AudioPlayerStatus.Idle);
    guildPlayer.player.removeAllListeners(AudioPlayerStatus.Playing);
    guildPlayer.player.removeAllListeners('error');
    guildPlayer.voiceConnection.removeAllListeners(VoiceConnectionStatus.Disconnected);
    if (guildPlayer.voiceChannelMembers.has(client.user!.id)) guildPlayer.voiceConnection.destroy();
    logger.debug(`Removed music player ${reason}`, guildPlayer.guild.id);
}

function clearBotLeaveTimeout(guildPlayer: IGuildMusicPlayer) {
    if (!guildPlayer.botLeaveTimeout) return;
    clearTimeout(guildPlayer.botLeaveTimeout!);
    guildPlayer.botLeaveTimeout = null;
}

function registerGuildPlayerEventListeners(guildPlayer: IGuildMusicPlayer) {
    guildPlayer.voiceConnection.addListener(VoiceConnectionStatus.Disconnected, () => {
        logger.debug(`Voice disconnected`, guildPlayer.guild.id);
        removeGuildPlayer(guildPlayer, 'Disconnected');
    });
    guildPlayer.player.addListener('error', async (e: any) => {
        if (guildPlayer.playerMessages.has('playRequest')) {
            guildPlayer.playerMessages.get('playRequest')!.delete();
            guildPlayer.playerMessages.delete('playRequest');
        }
        if (e.message === 'Status code: 403' && guildPlayer.currentlyPlaying && guildPlayer.replayRetries < 5) {
            await timer(100 * guildPlayer.replayRetries);
            guildPlayer.queue?.unshift(guildPlayer.currentlyPlaying!);
            guildPlayer.replayRetries++;
            logger.debug(
                `Error occurred in music player while attempting to play '${guildPlayer.currentlyPlaying.title}' playing retrying.. ${guildPlayer.replayRetries} retries`,
                guildPlayer.guild.id,
            );
        } else {
            logger.error(
                `Error occurred in music player while attempting to play '${guildPlayer.currentlyPlaying?.title ?? ''}' : ${e.message}`,
                guildPlayer.guild.id,
            );
        }
        guildPlayer.player.stop();
        playNext(guildPlayer.voiceConnection, guildPlayer.playerMessages.get('latestToQueue')!);
    });
    guildPlayer.player.addListener(AudioPlayerStatus.Idle, () => {
        logger.debug('idle', '');
        if (guildPlayer.playerMessages.has('playRequest')) {
            guildPlayer.playerMessages.get('playRequest')!.delete();
            guildPlayer.playerMessages.delete('playRequest');
        }
        if (guildPlayers[guildPlayer.guild.id].queue.length <= 0) {
            guildPlayer.botLeaveTimeout = setTimeout(() => {
                removeGuildPlayer(guildPlayer, 'finished playing music');
            }, 600000);
            logger.debug(`Added Timeout for bot to leave as queue empty`, guildPlayer.guild.id);
            return;
        }
        logger.debug(`finished playing ${guildPlayer.currentlyPlaying!.title}`, guildPlayer.guild.id);
        pushTracksIntoHistoryQueue(guildPlayer, [guildPlayer.currentlyPlaying!]);
        playNext(guildPlayer.voiceConnection, guildPlayer.playerMessages.get('latestToQueue')!);
    });
    guildPlayer.player.addListener(AudioPlayerStatus.Buffering, () => {
        logger.debug('buffering', '');
    });
    guildPlayer.player.addListener(AudioPlayerStatus.Playing, async (oldState) => {
        guildPlayer.replayRetries = 0;
        if (oldState.status === AudioPlayerStatus.AutoPaused || oldState.status === AudioPlayerStatus.Paused) return;
        const newPlayingMessage = `Now Playing ${guildPlayer.currentlyPlaying!.title}, \`[${
            guildPlayer.currentlyPlaying!.isLiveStream ? 'LIVE 🔴' : secondsToTime(guildPlayer.currentlyPlaying!.length)
        }]\``;
        guildPlayer.playerMessages.set('playRequest', await guildPlayer.playerMessages.get('latestToQueue')!.author.send(newPlayingMessage));
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

async function playNext(voiceConnection: VoiceConnection, message: Message) {
    const guildPlayer = guildPlayers[message.guildId!];
    if (guildPlayer.queue.length <= 0) return;
    const audioToPlay = guildPlayer.queue.shift();
    logger.debug(`Preparing to play ${audioToPlay?.title}`, guildPlayer.guild.id);
    guildPlayer.currentlyPlaying = audioToPlay!;
    const stream = await getAudioStream(audioToPlay!);
    stream[0]?.addListener('error', (e) => {
        logger.error(e.message, message.guildId!);
    });
    stream[0]?.addListener('close', () => {
        logger.error('Closed', message.guildId!);
    });
    if (stream[0]) {
        const resource = createAudioResource('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', {
            inputType: StreamType.Arbitrary,
        });
        guildPlayer.player.play(resource);
        logger.debug(`Now playing... ${audioToPlay!.title}`, guildPlayer.guild.id);
        return;
    }
    message.react('⛔');
    message.author.send(`${stream[1]} for ${audioToPlay!.title}`);
    playNext(voiceConnection, message);
}

async function searchByQueryString(param: string, message: Message) {
    const newMessage = await message.author.send(`Searching for '${param}'`);
    const urls = await getYoutubeSearchResult(param);
    newMessage.delete();
    return urls;
}

function pushTracksIntoQueue(guildPlayer: IGuildMusicPlayer, tracks: IBasicVideoInfo[]) {
    if (tracks.length + guildPlayer.queue.length <= MaxQueueSize) guildPlayer.queue.push(...tracks);
    else return false;
    return true;
}

function pushTracksIntoHistoryQueue(guildPlayer: IGuildMusicPlayer, tracks: IBasicVideoInfo[]) {
    if (tracks.length + guildPlayer.queueHistory.length <= MaxQueueHistorySize) guildPlayer.queueHistory.push(...tracks);
    else {
        tracks.forEach(() => guildPlayer.queueHistory.shift());
        pushTracksIntoHistoryQueue(guildPlayer, tracks);
    }
}

async function parsePlayParameter(param: string, message: Message) {
    const urlRegexResult = isValidURL(param);
    if (!urlRegexResult) return await searchByQueryString(param, message);
    switch (urlRegexResult[4].toLowerCase()) {
        case 'youtube':
            return await parseYouTubePlayParameter(param);
        case 'soundcloud':
            return await parseSoundCloudPlayParameter(param);
        case 'mixlr':
            return await parseMixlrPlayParameter(param);
        default:
            message.author.send(`${urlRegexResult[2]} is not supported currently`);
    }
}

export function play(message: Message, param: string) {
    const guildPlayer = guildPlayers[message.guildId!];
    let searchResults;
    if (guildPlayer) {
        searchResults = guildPlayer.playSearch ? [...guildPlayer.playSearch] : null;
        guildPlayer.playSearch = null;
        clearBotLeaveTimeout(guildPlayer);
        logger.debug(`Play Dispatcher cleared leave timeout`, guildPlayer.guild.id);
    }
    if (!param && guildPlayer && guildPlayer.player.state.status === AudioPlayerStatus.Paused) {
        guildPlayer.player.unpause();
        message.author.send(`Resumed ${guildPlayer.currentlyPlaying!.title}`);
        logger.debug(`Un-paused music player ${guildPlayer.currentlyPlaying!.title}`, guildPlayer.guild.id);
        return true;
    }
    if (isNaN(+param)) {
        addToQueue(param, message);
        logger.debug(`Added '${param}' for youtube string search`, message.guildId!);
        return true;
    }
    if (+param && searchResults && +param <= searchResults.length) {
        addToQueue(searchResults[+param - 1].url, message);
        logger.debug(`Selected song number '${param}' from search results`, guildPlayer.guild.id);
        return true;
    }
    if (guildPlayer && param != '' && +param <= guildPlayer.queue.length + 1) {
        logger.debug(`Selected song number '${param}' from queue`, guildPlayer.guild.id);
        const songPointer = +param - 2;
        if (songPointer === -1 && guildPlayer.currentlyPlaying) {
            guildPlayer.queue.unshift(guildPlayer.currentlyPlaying);
        } else {
            const targetSong = guildPlayer.queue[songPointer];
            guildPlayer.queue = guildPlayer.queue.filter((x, index) => index != songPointer);
            guildPlayer.queue.unshift(targetSong);
        }
        playNext(guildPlayer.voiceConnection, message);
        return true;
    }
    message.author.send(`Song number '${param}' is not valid`);
    return false;
}

export async function search(message: Message, param: string) {
    if (!guildPlayers[message.guildId!]) await createNewGuildPlayer(message);
    const guildPlayer = guildPlayers[message.guildId!];
    logger.debug(`Searching using ps command with '${param}' as search query`, guildPlayer.guild.id);
    const newMessage = await message.author.send(`Searching for '${param}'`);
    guildPlayer.playSearch = await getYoutubeSearchResultInfo(param);
    newMessage.delete();
    if (!guildPlayer.playSearch) {
        message.author.send(`Unable to get search results for '${param}'`);
    }
    let msg = '**Please select a track with the -p 1-5 command**\n';
    guildPlayer.playSearch!.forEach((x, i) => (msg += `**#${i + 1}** ${x.title} \`[${x.isLiveStream ? 'LIVE 🔴' : secondsToTime(x.length)}]\`\n`));
    message.author.send(msg);
    return true;
}

export async function addToQueue(param: string, message: Message) {
    let guildPlayer = guildPlayers[message.guildId!];
    const urls = await parsePlayParameter(param, message);
    if (!urls) {
        message.author.send('Unable to find ' + param);
        return false;
    }
    if (!guildPlayer) guildPlayer = await createNewGuildPlayer(message, [...urls]);
    else {
        if (!pushTracksIntoQueue(guildPlayer, urls)) {
            message.author.send('Reached maximum queue size');
            logger.error('Reached maximum queue size', guildPlayer.guild.id);
            return false;
        }
    }
    logger.debug(`AddToQueue called with '${param}' as parameter`, guildPlayer.guild.id);
    guildPlayer.playerMessages.set('latestToQueue', message);
    if (urls.length > 1) message.author.send(`Added playlist of ${urls.length} songs to the queue`);
    else
        guildPlayer.playerMessages.set(
            'addedTrack',
            await message.author.send(`Added ${urls[0].title} queue \`[${urls[0].isLiveStream ? 'LIVE 🔴' : secondsToTime(urls[0].length)}]\``),
        );
    if (guildPlayer.player.state.status === AudioPlayerStatus.Idle) playNext(guildPlayer.voiceConnection, message);
    return true;
}

export function voiceChannelChange(oldState: VoiceState, newState: VoiceState) {
    const oldChannelId = oldState.channelId;
    const newChannelId = newState.channelId;
    const oldGuildPlayer = guildPlayers[oldState.guild.id];
    const newGuildPlayer = guildPlayers[newState.guild.id];
    if (oldChannelId === newChannelId) return;
    if (oldChannelId && oldGuildPlayer) {
        const voiceChannelMemberMap = oldGuildPlayer.voiceChannelMembers;
        if (voiceChannelMemberMap.has(oldState.member!.id)) {
            voiceChannelMemberMap.delete(oldState.member!.id);
            if (voiceChannelMemberMap.size === 1) {
                oldGuildPlayer.textChannel.send('All members left voice channel. Player paused.');
                oldGuildPlayer.player.pause();
                oldGuildPlayer.botLeaveTimeout = setTimeout(() => {
                    removeGuildPlayer(oldGuildPlayer, 'users left');
                }, 60000);
                logger.debug(`Added Timeout for bot to leave as no members left in voice channel`, oldGuildPlayer.guild.id);
            }
        }
    }
    if (newChannelId && newGuildPlayer) {
        newGuildPlayer.voiceChannelMembers.set(newState.member!.id, newState.member!);
        if (
            newGuildPlayer.voiceChannelMembers.size === 2 &&
            oldGuildPlayer.botLeaveTimeout &&
            newGuildPlayer.player.state.status === AudioPlayerStatus.Paused
        ) {
            clearBotLeaveTimeout(oldGuildPlayer);
            logger.debug(`Removed timeout as member rejoined vc`, newGuildPlayer.guild.id);
            newGuildPlayer.player.unpause();
        }
    }
}

export function stop(message: Message) {
    const guildPlayer = guildPlayers[message.guildId!];
    if (!guildPlayer || guildPlayer.player.state.status !== AudioPlayerStatus.Playing) {
        message.author.send('I am not currently playing any music');
        return false;
    }
    guildPlayer.queue = [];
    guildPlayer.player.stop();
    return true;
}

export function shuffle(message: Message) {
    const guildPlayer = guildPlayers[message.guildId!];
    if (!guildPlayer || guildPlayer.queue.length === 0) {
        message.author.send('The queue is empty');
        return false;
    }
    shuffleArray(guildPlayer.queue);
    return true;
}

export function skip(message: Message) {
    const guildPlayer = guildPlayers[message.guildId!];
    if (!guildPlayer || guildPlayer.player.state.status !== AudioPlayerStatus.Playing) {
        message.author.send('I am not currently playing any music');
        return false;
    }
    guildPlayer.player.stop();
    return true;
}

export function clear(message: Message) {
    const guildPlayer = guildPlayers[message.guildId!];
    if (!guildPlayer || guildPlayer.queue.length == 0) {
        message.author.send('The queue is empty');
        return false;
    }
    guildPlayer.queue = [];
    return true;
}

export function previousTrack(message: Message) {
    const guildPlayer = guildPlayers[message.guildId!];
    if (!guildPlayer || guildPlayer.queueHistory.length === 0) {
        message.author.send('No previous track found');
        return false;
    }
    const previousTrack = guildPlayer.queueHistory.pop();
    guildPlayer.queue.unshift(previousTrack!);
    guildPlayer.player.stop();
    return true;
}

export function getQueue(param: string, message: Message) {
    const guildPlayer = guildPlayers[message.guildId!];
    if (!guildPlayer || (guildPlayer.queue.length <= 0 && !guildPlayer.currentlyPlaying)) {
        message.author.send('The queue is empty');
        return false;
    }
    let msg = `►**#1** ${guildPlayer.currentlyPlaying?.title} \`[${
        guildPlayer.currentlyPlaying?.isLiveStream ? 'LIVE 🔴' : secondsToTime(guildPlayer.currentlyPlaying!.length)
    }]\`\n`;
    if (!param) {
        guildPlayer.queue
            .slice(0, 5)
            .forEach((x, i) => (msg += `**#${i + 2}** ${x.title} \`[${x.isLiveStream ? 'LIVE 🔴' : secondsToTime(x.length)}]\`\n`));
        message.author.send(msg);
        return true;
    }
    if (isNaN(+param)) {
        message.author.send('Please enter number of queue entries to view');
        return false;
    }
    const queueSlice = guildPlayer.queue.slice(0, +param);
    let i = 2;
    for (const x of queueSlice) {
        if (msg.length > 3500) {
            return false;
        }
        msg += `**#${i}** ${x.title} \`[${x.isLiveStream ? 'LIVE 🔴' : secondsToTime(x.length)}]\`\n`;
        i++;
    }
    message.author.send(msg);
    return true;
}

export async function bbpm(message: Message) {
    return await addToQueue('https://api.mixlr.com/v3/channel_view/thebbpm', message);
}

export function getNowPlaying(message: Message) {
    const currentlyPlaying = guildPlayers[message.guildId!].currentlyPlaying;
    if (!currentlyPlaying) {
        message.author.send('I am not currently playing any music');
        return false;
    }
    message.author.send(`${currentlyPlaying.title} \`[${currentlyPlaying.isLiveStream ? 'LIVE 🔴' : secondsToTime(currentlyPlaying.length)}]\`\n`);
    return true;
}

export function pause(message: Message) {
    const guildPlayer = guildPlayers[message.guildId!];
    if (guildPlayer.player.state.status === AudioPlayerStatus.Playing) {
        guildPlayer.player.pause();
        message.author.send(`paused ${guildPlayer.currentlyPlaying!.title}`);
    }
    return true;
}

export function leave(message: Message) {
    removeGuildPlayer(guildPlayers[message.guildId!], 'leave command');
    message.react('👋');
    return true;
}
