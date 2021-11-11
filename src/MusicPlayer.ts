import {Guild, Message} from "discord.js";
import {
    AudioPlayer,
    AudioPlayerStatus,
    createAudioPlayer,
    createAudioResource,
    DiscordGatewayAdapterCreator,
    joinVoiceChannel,
    StreamType, VoiceConnection,

} from "@discordjs/voice"
import {basicVideoInfo, getYoutubeAudioStream, parseYouTubePlayParameter} from "./youTube";
import {secondsToTime, shuffleArray, timer} from "./util"

interface IGuildPlayer {
    queue : basicVideoInfo[];
    player : AudioPlayer;
    voiceConnection : VoiceConnection;
    guild : Guild;
    currentlyPlaying? : basicVideoInfo;
}

const guildPlayers : {[guildId : string] : IGuildPlayer} = {};

async function createNewGuildPlayer(message: Message, queue? : basicVideoInfo[]) {
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
        currentlyPlaying : undefined
    }
    guildPlayers[message.guild?.id!] = guildPlayer;
    await playNext(guildPlayer.voiceConnection, message);
    guildPlayer.player.addListener(AudioPlayerStatus.Idle,async () => {
        if (guildPlayers[message.guild?.id!].queue.length <= 0) {
            guildPlayer.player.removeAllListeners(AudioPlayerStatus.Idle);
            guildPlayer.voiceConnection.disconnect();
            guildPlayer.voiceConnection.destroy();
            delete guildPlayers[message.guild!.id];
            return;
        }
        await playNext(guildPlayer.voiceConnection, message);
    });
    guildPlayer.player.addListener("error", async (e : any)=>{
        console.log(e);
        if(e.statusCode === 401||403 && guildPlayer.currentlyPlaying){
            queue?.push(guildPlayer.currentlyPlaying!);
        }
        guildPlayer.player.removeAllListeners(AudioPlayerStatus.Idle);
        guildPlayer.player.removeAllListeners("error");
        await createNewGuildPlayer(message, guildPlayer.queue);
    })
    guildPlayer.voiceConnection.subscribe(guildPlayer.player);
}

async function getAudioStream(url : string){
    let stream;
    try{
        stream = await getYoutubeAudioStream(url);
        return stream;
    }
    catch (e){
        return null;
    }
}

async function playNext(voiceConnection : VoiceConnection, message : Message) : Promise<null | undefined> {
    if (guildPlayers[message.guild?.id!].queue.length <= 0){
        return null;
    }
    const audioToPlay = guildPlayers[message.guild?.id!].queue.shift();
    guildPlayers[message.guild?.id!].currentlyPlaying = audioToPlay;
    const stream = await getAudioStream(audioToPlay!.url);
    if(!stream){
        message.react('⛔').then(()=> message.channel.send(`Unable to play ${audioToPlay!.title}`));
        return playNext(voiceConnection,message);
    }
    const resource = createAudioResource(stream.stream, { inputType:StreamType.Arbitrary });
    guildPlayers[message.guild!.id].player.play(resource);
    const nowPlayingMessage = await message.channel.send(`Now Playing ${audioToPlay!.title}, \`[${secondsToTime(audioToPlay!.length)}]\``);
    await timer(audioToPlay!.length*1000)
    nowPlayingMessage.delete();
}

export async function addToQueue(param : string, message: Message){
    if(!message.member!.voice.channel){
        message.channel.send("Please join a voice channel to listen");
        return;
    }
    const newMessage = await message.channel.send(`Searching youtube for ${param}`);
    const urls = await parseYouTubePlayParameter(param);
    if(!urls){
        message.react('⛔').then(()=>newMessage.edit("Invalid Query"));
        return;
    }
    else newMessage.delete();
    if(!guildPlayers[message.guild?.id!]) await createNewGuildPlayer(message, [...urls]);
    else guildPlayers[message.guild?.id!].queue = [...guildPlayers[message.guild?.id!].queue, ...urls];
    if(urls.length>1) message.channel.send(`Added playlist of ${urls.length} songs to the queue`);
    else message.react("👍");
}

export async function stop(message : Message) {
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
    if(guildPlayers[message.guild?.id!].player.state.status === AudioPlayerStatus.Playing)
    {
        guildPlayers[message.guild?.id!].player.stop();
        message.react("👍");
        return;
    }
    message.channel.send("I am not currently playing any music");
}

export async function clear(message : Message){
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
        guildPlayers[message.guild?.id!].queue.slice(0, 5).forEach((x,i) => msg += `**#${i+1}** ${x.title}\n`);
        message.channel.send(msg);
        return;
    }
    if(isNaN(+param)){
        message.channel.send("Please enter number of queue entries to view");
        return;
    }
    guildPlayers[message.guild?.id!].queue.slice(0, +param).forEach((x, i) => msg += `**#${i+1}** ${x.title}\n`);
    message.channel.send(msg);
}