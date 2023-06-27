import {Message, VoiceState} from 'discord.js';
import {logger} from '../services/logger';
import {GuildPlayer} from './MusicPlayer';
import {AudioPlayerStatus} from '@discordjs/voice';

type GuildId = string;
export class MusicPlayerManager {
    private static activeGuilds = new Map<GuildId, GuildPlayer>();

    static async play(message: Message, param: string) {
        try {
            let guildPlayer = MusicPlayerManager.activeGuilds.get(message.guildId!);
            if (!guildPlayer) {
                guildPlayer = new GuildPlayer(message);
                guildPlayer.events.on('disposed', () => MusicPlayerManager.activeGuilds.delete(message.guildId!));
                MusicPlayerManager.activeGuilds.set(message.guildId!, guildPlayer);
            }
            guildPlayer.clearBotLeaveTimeout();
            logger.debug(`Play Dispatcher cleared leave timeout`, guildPlayer.guildId);
            if (guildPlayer.player.state.status === AudioPlayerStatus.Paused && !param && guildPlayer) {
                guildPlayer.player.unpause();
                message.channel.send(`Resumed ${guildPlayer.currentlyPlaying!.title}`);
                logger.debug(`Un-paused music player ${guildPlayer.currentlyPlaying!.title}`, guildPlayer.guildId);
                return;
            }
            if (isNaN(+param)) {
                await guildPlayer.addToQueue(param);
                logger.debug(`Added '${param}' for youtube string search`, message.guildId!);
                return;
            }
            if (guildPlayer && param != '' && +param <= guildPlayer.queue.length + 1) {
                logger.debug(`Selected song number '${param}' from queue`, guildPlayer.guildId);
                const songPointer = +param - 2;
                if (songPointer === -1 && guildPlayer.currentlyPlaying) {
                    guildPlayer.queue.unshift(guildPlayer.currentlyPlaying);
                } else {
                    const targetSong = guildPlayer.queue[songPointer];
                    guildPlayer.queue = guildPlayer.queue.filter((x, index) => index != songPointer);
                    guildPlayer.queue.unshift(targetSong);
                }
                guildPlayer.skip();
                return;
            }
            message.channel.send(`Song number '${param}' is not valid`);
        } catch (e: any) {
            message.channel.send(e.message);
        }
    }

    // export async function search(message: Message, param: string) {
    //     if (!guildPlayers[message.guildId!]) createNewGuildPlayer(message);
    //     const guildPlayer = guildPlayers[message.guildId!];
    //     logger.debug(`Searching using ps command with '${param}' as search query`, guildPlayer.guild.id);
    //     const newMessage = await message.channel.send(`Searching for '${param}'`);
    //     guildPlayer.playSearch = await getYoutubeSearchResultInfo(param);
    //     newMessage.delete();
    //     if (!guildPlayer.playSearch) {
    //         message.channel.send(`Unable to get search results for '${param}'`);
    //     }
    //     let msg = '**Please select a track with the -p 1-5 command**\n';
    //     guildPlayer.playSearch!.forEach((x, i) => (msg += `**#${i + 1}** ${x.title} \`[${x.isLiveStream ? 'LIVE 🔴' : secondsToTime(x.length)}]\`\n`));
    //     message.channel.send(msg);
    //     return true;
    // }

    static voiceChannelChange(oldState: VoiceState, newState: VoiceState) {
        const oldChannelId = oldState.channelId;
        const newChannelId = newState.channelId;
        const oldGuildPlayer = MusicPlayerManager.activeGuilds.get(oldState.guild.id);
        const newGuildPlayer = MusicPlayerManager.activeGuilds.get(newState.guild.id);
        if (oldChannelId === newChannelId) return;
        if (oldChannelId && oldGuildPlayer) {
            const voiceChannelMemberMap = oldGuildPlayer.voiceChannelMembers;
            if (voiceChannelMemberMap.has(oldState.member!.id)) {
                voiceChannelMemberMap.delete(oldState.member!.id);
                if (voiceChannelMemberMap.size === 1) {
                    oldGuildPlayer.textChannel.send('All members left voice channel. Player paused.');
                    oldGuildPlayer.player.pause();
                    oldGuildPlayer.botLeaveTimeout = setTimeout(() => {
                        oldGuildPlayer.removeGuildPlayer('users left');
                    }, 60000);
                    logger.debug(`Added Timeout for bot to leave as no members left in voice channel`, oldGuildPlayer.guildId);
                }
            }
        }
        if (newChannelId && newGuildPlayer) {
            newGuildPlayer.voiceChannelMembers.set(newState.member!.id, newState.member!);
            if (newGuildPlayer.voiceChannelMembers.size === 2 && newGuildPlayer.player.state.status === AudioPlayerStatus.Paused) {
                newGuildPlayer.clearBotLeaveTimeout();
                logger.debug(`Removed timeout as member rejoined vc`, newGuildPlayer.guildId);
                newGuildPlayer.player.unpause();
            }
        }
    }

    static leave(message: Message) {
        try {
            const newGuildPlayer = MusicPlayerManager.activeGuilds.get(message.guildId!);
            newGuildPlayer?.removeGuildPlayer('requester by user');
            message.react('👋');
        } catch (e: any) {
            message.reply(e.message);
        }
    }

    static stop(message: Message) {
        try {
            const newGuildPlayer = MusicPlayerManager.activeGuilds.get(message.guildId!);
            newGuildPlayer?.player.stop();
        } catch (e: any) {
            message.reply(e.message);
        }
    }

    static shuffle(message: Message) {
        try {
            const newGuildPlayer = MusicPlayerManager.activeGuilds.get(message.guildId!);
            newGuildPlayer?.shuffle();
        } catch (e: any) {
            message.reply(e.message);
        }
    }

    static skip(message: Message) {
        try {
            const newGuildPlayer = MusicPlayerManager.activeGuilds.get(message.guildId!);
            newGuildPlayer?.skip();
        } catch (e: any) {
            message.reply(e.message);
        }
    }

    static clear(message: Message) {
        try {
            const newGuildPlayer = MusicPlayerManager.activeGuilds.get(message.guildId!);
            newGuildPlayer?.clear();
        } catch (e: any) {
            message.reply(e.message);
        }
    }

    static previousTrack(message: Message) {
        try {
            const newGuildPlayer = MusicPlayerManager.activeGuilds.get(message.guildId!);
            newGuildPlayer?.previousTrack();
        } catch (e: any) {
            message.reply(e.message);
        }
    }

    static getQueue(message: Message, param?: string) {
        try {
            const newGuildPlayer = MusicPlayerManager.activeGuilds.get(message.guildId!);
            newGuildPlayer?.getQueue(param);
        } catch (e: any) {
            message.reply(e.message);
        }
    }

    static async bbpm(message: Message) {
        try {
            return await MusicPlayerManager.play(message, 'https://api.mixlr.com/v3/channel_view/thebbpm');
        } catch (e: any) {
            message.reply(e.message);
        }
    }

    static getNowPlaying(message: Message) {
        try {
            const newGuildPlayer = MusicPlayerManager.activeGuilds.get(message.guildId!);
            newGuildPlayer?.getNowPlaying();
        } catch (e: any) {
            message.reply(e.message);
        }
    }

    static pause(message: Message) {
        try {
            const newGuildPlayer = MusicPlayerManager.activeGuilds.get(message.guildId!);
            newGuildPlayer?.pause();
        } catch (e: any) {
            message.reply(e.message);
        }
    }
}
