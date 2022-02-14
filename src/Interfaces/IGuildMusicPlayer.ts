import {IBasicVideoInfo} from './IBasicVideoInfo';
import {AudioPlayer, VoiceConnection} from '@discordjs/voice';
import {Guild, GuildMember, Message, TextChannel} from 'discord.js';

type MemberId = string;

export interface IGuildMusicPlayer {
    queue: IBasicVideoInfo[];
    queueHistory: IBasicVideoInfo[];
    player: AudioPlayer;
    voiceConnection: VoiceConnection;
    textChannel: TextChannel;
    guild: Guild;
    currentlyPlaying: IBasicVideoInfo | null;
    playerMessages: Map<string, Message>;
    botLeaveTimeout: NodeJS.Timeout | null;
    voiceChannelMembers: Map<MemberId, GuildMember>;
    replayRetries: number;
    playSearch: IBasicVideoInfo[] | null;
}
