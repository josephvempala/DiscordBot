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

type PlayerMessageDictionary = {
    [message : string] : Message;
}

interface IGuildPlayer {
    queue : IBasicVideoInfo[];
    player : AudioPlayer;
    voiceConnection : VoiceConnection;
    guild : Guild;
    currentlyPlaying : IBasicVideoInfo | null;
    playerMessages : PlayerMessageDictionary;
    botLeaveTimeout : NodeJS.Timeout | null;
}

const guildPlayers : {[guildId : string] : IGuildPlayer} = {};

async function createNewGuildPlayer(message: Message, queue? : IBasicVideoInfo[]) {
    const guildPlayer = {
        queue : queue ? queue : [],
        player : createAudioPlayer(),
        voiceConnection : joinVoiceChannel({
            selfDeaf : true,
            channelId: message.member!.voice.channel!.id,
            guildId: message.guild!.id,
            adapterCreator: message.guild!.voiceAdapterCreator as DiscordGatewayAdapterCreator
        }),
        guild : message.member?.guild!,
        currentlyPlaying : null,
        playerMessages: {} as PlayerMessageDictionary,
        botLeaveTimeout: null,
    }
    guildPlayers[message.guild?.id!] = guildPlayer;
    registerGuildPlayerEventListeners(guildPlayer);
    guildPlayer.voiceConnection.subscribe(guildPlayer.player);
}

async function removeGuildPlayer(guildPlayer : IGuildPlayer){
    for(const element in guildPlayer.playerMessages){
        let message = guildPlayer.playerMessages[element];
        if(message.deletable && !message.deleted){
            await message.delete();
        }
    }
    guildPlayer.player.removeAllListeners(AudioPlayerStatus.Idle);
    guildPlayer.player.removeAllListeners("error");
    guildPlayer.voiceConnection.disconnect();
    delete guildPlayers[guildPlayer.guild.id];
}

function registerGuildPlayerEventListeners(guildPlayer : IGuildPlayer){
    guildPlayer.voiceConnection.addListener(VoiceConnectionStatus.Disconnected,async () => {
        if(guildPlayers[guildPlayer.guild.id])
            await removeGuildPlayer(guildPlayer);
        guildPlayer.voiceConnection.destroy();
    });
    guildPlayer.player.addListener("error",async (e : any) => {
        console.log(e);
        await guildPlayer.playerMessages['playRequestMessage']?.delete();
        delete guildPlayer.playerMessages['playRequestMessage'];
        if(e.message === "Status code: 403" && guildPlayer.currentlyPlaying){
            guildPlayer.queue?.push(guildPlayer.currentlyPlaying!);
        }
        guildPlayer.player.stop();
        await playNext(guildPlayer.voiceConnection, guildPlayer.playerMessages['playRequestMessage']);
    });
    guildPlayer.player.addListener(AudioPlayerStatus.Idle,async () => {
        await guildPlayer.playerMessages['playRequestMessage']?.delete();
        delete guildPlayer.playerMessages['playRequestMessage'];
        if (guildPlayers[guildPlayer.guild.id].queue.length <= 0) {
            guildPlayer.botLeaveTimeout = setTimeout(async () => {
                await removeGuildPlayer(guildPlayer);
            },30000);
            return;
        }
        await playNext(guildPlayer.voiceConnection, guildPlayer.playerMessages['playRequestMessage']);
    });
}

async function getAudioStream(info : IBasicVideoInfo){
    switch (info.type){
        case VideoInfoType.YouTube:
            return await getYoutubeAudioStream(info.url);
    }
}

async function playNext(voiceConnection : VoiceConnection, message : Message) : Promise<void> {
    if (guildPlayers[message.guild?.id!].queue.length <= 0){
        return;
    }
    const audioToPlay = guildPlayers[message.guild?.id!].queue.shift();
    guildPlayers[message.guild?.id!].currentlyPlaying = audioToPlay!;
    const stream = await getAudioStream(audioToPlay!);
    if(!stream){
        await message.react('⛔');
        await message.channel.send(`Unable to play ${audioToPlay!.title}`)
        return playNext(voiceConnection,message);
    }
    const resource = createAudioResource(stream, { inputType:StreamType.Arbitrary });
    guildPlayers[message.guild!.id].player.play(resource);
    guildPlayers[message.guild?.id!].playerMessages['playRequestMessage'] = await message.channel.send(`Now Playing ${audioToPlay!.title}, \`[${secondsToTime(audioToPlay!.length)}]\``);
}

export async function addToQueue(param : string, message: Message){
    if(!message.member!.voice.channel){
        message.channel.send("Please join a voice channel to listen");
        return;
    }
    if(guildPlayers[message.guild?.id!] && guildPlayers[message.guild?.id!].botLeaveTimeout){
        clearTimeout(guildPlayers[message.guild?.id!].botLeaveTimeout!)
    }
    const newMessage = await message.channel.send(`Searching for ${param}`);
    const urls = await parseYouTubePlayParameter(param);
    newMessage.delete();
    if(!urls){
        message.react('⛔').then(()=>newMessage.edit("Unable to find "+param));
        return;
    }
    if(!guildPlayers[message.guild?.id!]) await createNewGuildPlayer(message, [...urls]);
    else guildPlayers[message.guild?.id!].queue = [...guildPlayers[message.guild?.id!].queue, ...urls];
    if(urls.length>1) message.channel.send(`Added playlist of ${urls.length} songs to the queue`);
    else await message.react("👍");
    if(guildPlayers[message.guild?.id!].player.state.status === AudioPlayerStatus.Idle){
        await playNext(guildPlayers[message.guild?.id!].voiceConnection, message);
    }
}

export function stop(message : Message) {
    if(guildPlayers[message.guild?.id!] && guildPlayers[message.guild?.id!].player.state.status === AudioPlayerStatus.Playing)
    {
        guildPlayers[message.guild?.id!].queue = [];
        guildPlayers[message.guild?.id!].player.stop();
        message.react("👍");
        return;
    }
    message.channel.send("I am not currently playing any music");
}

export function shuffle(message : Message) {
    if(guildPlayers[message.guild?.id!] && guildPlayers[message.guild?.id!].queue.length>0){
        shuffleArray(guildPlayers[message.guild?.id!].queue);
        message.react("👍");
        return;
    }
    message.channel.send("The queue is empty");
}

export function skip(message : Message){
    if(guildPlayers[message.guild?.id!] && guildPlayers[message.guild?.id!].player.state.status === AudioPlayerStatus.Playing)
    {
        guildPlayers[message.guild?.id!].player.stop();
        message.react("👍");
        return;
    }
    message.channel.send("I am not currently playing any music");
}

export function clear(message : Message){
    if(guildPlayers[message.guild?.id!] && guildPlayers[message.guild?.id!].queue.length>0){
        guildPlayers[message.guild?.id!].queue = [];
        message.react("👍");
        return;
    }
    message.channel.send("The queue is empty");
}

export function getQueue(param : string, message : Message){
    if(!guildPlayers[message.guild?.id!] || guildPlayers[message.guild?.id!].queue.length<=0){
        message.channel.send("The queue is empty");
        return;
    }
    let msg = ''
    if(!param)
    {
        guildPlayers[message.guild?.id!].queue.slice(0, 5).forEach((x,i) => msg += `**#${i+1}** ${x.title} \`[${secondsToTime(x.length)}]\`\n`);
        message.channel.send(msg);
        return;
    }
    if(isNaN(+param)){
        message.channel.send("Please enter number of queue entries to view");
        return;
    }
    guildPlayers[message.guild?.id!].queue.slice(0, +param).forEach((x, i) => msg += `**#${i+1}** ${x.title} \`[${secondsToTime(x.length)}]\`\n`);
    message.channel.send(msg);
}