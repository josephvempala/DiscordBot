import {GuildMember, Message, TextChannel, VoiceState} from 'discord.js';
import {
    AudioPlayerStatus,
    createAudioPlayer,
    createAudioResource,
    DiscordGatewayAdapterCreator,
    joinVoiceChannel,
    StreamType,
    VoiceConnection,
    VoiceConnectionStatus,
} from '@discordjs/voice';
import {getYoutubeAudioStream, getYoutubeSearchResult, parseYouTubePlayParameter} from './youTube';
import {isValidURL, secondsToTime, shuffleArray, timer} from '../lib/util';
import {IBasicVideoInfo, VideoInfoType} from '../Interfaces/IBasicVideoInfo';
import {getSoundCloudAudioStream, parseSoundCloudPlayParameter} from './soundCloud';
import {GetAudioStreamResult} from '../Interfaces/GetAudioStreamResult';
import {getMixlrAudioStream, parseMixlrPlayParameter} from './mixlr';
import {logger} from '../services/logger';
import {client} from '../index';
import {MaxQueueHistorySize, MaxQueueSize} from '../lib/Constants';
import {EventEmitter} from 'events';

type MemberId = string;
export class GuildPlayer {
    queue: IBasicVideoInfo[];
    queueHistory: IBasicVideoInfo[];
    player = createAudioPlayer();
    textChannel: TextChannel;
    voiceConnection: VoiceConnection;
    guildId: string;
    currentlyPlaying: IBasicVideoInfo | null;
    botLeaveTimeout: ReturnType<typeof setTimeout> | null;
    voiceChannelMembers = new Map<MemberId, GuildMember>();
    replayRetries = 0;
    events = new EventEmitter();

    constructor(message: Message) {
        this.queue = [];
        this.queueHistory = [];
        this.textChannel = message.channel as TextChannel;
        this.voiceConnection = joinVoiceChannel({
            selfDeaf: true,
            channelId: message.member!.voice.channel!.id,
            guildId: message.guildId!,
            adapterCreator: message.guild!.voiceAdapterCreator as DiscordGatewayAdapterCreator,
        });
        this.guildId = message.member!.guild!.id;
        this.botLeaveTimeout = null;
        this.currentlyPlaying = null;
        this.voiceConnection.on('stateChange', (oldState, newState) => {
            const oldNetworking = Reflect.get(oldState, 'networking');
            const newNetworking = Reflect.get(newState, 'networking');
            const networkStateChangeHandler = (oldNetworkState: any, newNetworkState: any) => {
                const newUdp = Reflect.get(newNetworkState, 'udp');
                clearInterval(newUdp?.keepAliveInterval);
            };
            oldNetworking?.off('stateChange', networkStateChangeHandler);
            newNetworking?.on('stateChange', networkStateChangeHandler);
        });
        message.member!.voice.channel!.members!.forEach((x) => {
            this.voiceChannelMembers.set(x.id, x);
        });
        if (this.voiceChannelMembers.size < 1) {
            this.botLeaveTimeout = setTimeout(() => {
                this.removeGuildPlayer('Users Left channel');
            }, 600000);
            logger.debug(`Added Timeout for bot to leave as no listeners in vc`, this.guildId);
        }
        this.registerGuildPlayerEventListeners();
        this.voiceConnection.subscribe(this.player);
        logger.debug(`Created music player`, this.guildId);
    }

    private registerGuildPlayerEventListeners() {
        this.voiceConnection.addListener(VoiceConnectionStatus.Disconnected, () => {
            logger.debug(`Voice disconnected`, this.guildId);
            this.removeGuildPlayer('Disconnected');
        });
        this.player.addListener('error', async (e: any) => {
            if (e.message === 'Status code: 403' && this.currentlyPlaying && this.replayRetries < 5) {
                await timer(100 * this.replayRetries);
                this.queue?.unshift(this.currentlyPlaying!);
                this.replayRetries++;
                logger.debug(
                    `Error occurred in music player while attempting to play '${this.currentlyPlaying.title}' playing retrying.. ${this.replayRetries} retries`,
                    this.guildId,
                );
            } else {
                logger.error(
                    `Error occurred in music player while attempting to play '${this.currentlyPlaying?.title ?? ''}' : ${e.message}`,
                    this.guildId,
                );
            }
            this.player.stop();
            this.playNext();
        });
        this.player.addListener(AudioPlayerStatus.Idle, () => {
            if (this.queue.length <= 0) {
                this.botLeaveTimeout = setTimeout(() => {
                    this.removeGuildPlayer('finished playing music');
                }, 600000);
                logger.debug(`Added Timeout for bot to leave as queue empty`, this.guildId);
                return;
            }
            logger.debug(`finished playing ${this.currentlyPlaying!.title}`, this.guildId);
            this.pushTracksIntoHistoryQueue([this.currentlyPlaying!]);
            this.playNext();
        });
        this.player.addListener(AudioPlayerStatus.Playing, async (oldState: any) => {
            this.replayRetries = 0;
            if (oldState.status === AudioPlayerStatus.AutoPaused || oldState.status === AudioPlayerStatus.Paused) return;
            this.textChannel.send(
                `Now Playing ${this.currentlyPlaying!.title}, \`[${
                    this.currentlyPlaying!.isLiveStream ? 'LIVE 🔴' : secondsToTime(this.currentlyPlaying!.length)
                }]\``,
            );
        });
    }

    private async getAudioStream(info: IBasicVideoInfo) {
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

    private async searchByQueryString(param: string) {
        const newMessage = await this.textChannel.send(`Searching for '${param}'`);
        const urls = await getYoutubeSearchResult(param);
        newMessage.delete();
        return urls;
    }

    private pushTracksIntoQueue(tracks: IBasicVideoInfo[]) {
        if (tracks.length + this.queue.length <= MaxQueueSize) this.queue.push(...tracks);
        else throw new Error('failed to add tracks to queue');
        return true;
    }

    private pushTracksIntoHistoryQueue(tracks: IBasicVideoInfo[]) {
        if (tracks.length + this.queueHistory.length <= MaxQueueHistorySize) this.queueHistory.push(...tracks);
        else {
            tracks.forEach(() => this.queueHistory.shift());
            this.pushTracksIntoHistoryQueue(tracks);
        }
    }

    private async parsePlayParameter(param: string) {
        const urlRegexResult = isValidURL(param);
        if (!urlRegexResult) return await this.searchByQueryString(param);
        switch (urlRegexResult[4].toLowerCase()) {
            case 'youtube':
                return await parseYouTubePlayParameter(param);
            case 'soundcloud':
                return await parseSoundCloudPlayParameter(param);
            case 'mixlr':
                return await parseMixlrPlayParameter(param);
            default:
                this.textChannel.send(`${urlRegexResult[2]} is not supported currently`);
        }
    }

    private async playNext() {
        if (this.queue.length <= 0) return;
        const audioToPlay = this.queue.shift();
        logger.debug(`Preparing to play ${audioToPlay?.title}`, this.guildId);
        this.currentlyPlaying = audioToPlay!;
        const stream = await this.getAudioStream(audioToPlay!);
        if (stream[0]) {
            // // const filestream = stream[0].pipe(fs.createWriteStream(path.join(__dirname, `${message.guildId}.mp3`)));
            // const file = fs.createReadStream(path.join(__dirname, `${message.guildId}.mp3`));
            const resource = createAudioResource(stream[0], {inputType: StreamType.Arbitrary});
            this.player.play(resource);
            logger.debug(`Now playing... ${audioToPlay!.title}`, this.guildId);
            return;
        }
        this.textChannel.send(`${stream[1]} for ${audioToPlay!.title}`);
        this.playNext();
    }

    clearBotLeaveTimeout() {
        if (!this.botLeaveTimeout) return;
        clearTimeout(this.botLeaveTimeout!);
        this.botLeaveTimeout = null;
    }

    removeGuildPlayer(reason: string) {
        logger.debug(`Removing music player: ${reason}`, this.guildId);
        this.clearBotLeaveTimeout();
        this.player.removeAllListeners(AudioPlayerStatus.Idle);
        this.player.removeAllListeners(AudioPlayerStatus.Playing);
        this.player.removeAllListeners('error');
        this.voiceConnection.removeAllListeners(VoiceConnectionStatus.Disconnected);
        if (this.voiceChannelMembers.has(client.user!.id)) this.voiceConnection.destroy();
        this.events.emit('disposed');
        logger.debug(`Removed music player ${reason}`, this.guildId);
    }

    async addToQueue(param: string) {
        const urls = await this.parsePlayParameter(param);
        if (!urls) {
            throw new Error('Unable to find ' + param);
        } else {
            if (!this.pushTracksIntoQueue(urls)) {
                logger.error('Reached maximum queue size', this.guildId);
                throw new Error('Reached maximum queue size');
            }
        }
        logger.debug(`AddToQueue called with '${param}' as parameter`, this.guildId);
        if (urls.length > 1) this.textChannel.send(`Added playlist of ${urls.length} songs to the queue`);
        else this.textChannel.send(`Added ${urls[0].title} queue \`[${urls[0].isLiveStream ? 'LIVE 🔴' : secondsToTime(urls[0].length)}]\``);
        if (this.player.state.status === AudioPlayerStatus.Idle) this.playNext();
    }

    stop() {
        if (this.player.state.status !== AudioPlayerStatus.Playing) {
            throw new Error('I am not currently playing any music');
        }
        this.queue = [];
        this.player.stop();
    }

    shuffle() {
        if (this.queue.length === 0) {
            throw new Error('The queue is empty');
        }
        shuffleArray(this.queue);
    }

    skip() {
        if (this.player.state.status !== AudioPlayerStatus.Playing) {
            throw new Error('I am not currently playing any music');
        }
        this.player.stop();
    }

    clear() {
        if (this.queue.length == 0) {
            throw new Error('The queue is empty');
        }
        this.queue = [];
    }

    previousTrack() {
        if (this.queueHistory.length === 0) {
            throw new Error('No previous track found');
        }
        const previousTrack = this.queueHistory.pop();
        this.queue.unshift(previousTrack!);
        this.player.stop();
    }

    getQueue(param?: string) {
        if (this.queue.length <= 0 && !this.currentlyPlaying) {
            throw new Error('The queue is empty');
        }
        let msg = `►**#1** ${this.currentlyPlaying?.title} \`[${
            this.currentlyPlaying?.isLiveStream ? 'LIVE 🔴' : secondsToTime(this.currentlyPlaying!.length)
        }]\`\n`;
        if (!param) {
            this.queue
                .slice(0, 5)
                .forEach((x, i) => (msg += `**#${i + 2}** ${x.title} \`[${x.isLiveStream ? 'LIVE 🔴' : secondsToTime(x.length)}]\`\n`));
            return msg;
        }
        if (isNaN(+param)) {
            throw new Error('Please enter number of queue entries to view');
        }
        const queueSlice = this.queue.slice(0, +param);
        let i = 2;
        for (const x of queueSlice) {
            if (msg.length > 3500) {
                return false;
            }
            msg += `**#${i}** ${x.title} \`[${x.isLiveStream ? 'LIVE 🔴' : secondsToTime(x.length)}]\`\n`;
            i++;
        }
        return msg;
    }

    getNowPlaying() {
        const currentlyPlaying = this.currentlyPlaying;
        if (!currentlyPlaying) {
            throw new Error('I am not currently playing any music');
        }
        return `${currentlyPlaying.title} \`[${currentlyPlaying.isLiveStream ? 'LIVE 🔴' : secondsToTime(currentlyPlaying.length)}]\`\n`;
    }

    pause() {
        if (this.player.state.status === AudioPlayerStatus.Playing) {
            this.player.pause();
            return;
        }
        throw new Error('I am not currently playing any music');
    }
}
