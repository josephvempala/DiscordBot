import {Message} from "discord.js";
import {
    AudioPlayerStatus,
    createAudioPlayer,
    createAudioResource,
    DiscordGatewayAdapterCreator,
    joinVoiceChannel,
    StreamType, VoiceConnection,

} from "@discordjs/voice"
import {basicVideoInfo, getYoutubeAudioStream, parsePlayParameter} from "./youTube";
import {shuffleArray} from "./util"

let player = createAudioPlayer();
let queue: basicVideoInfo[] = [];

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
async function playNext(voiceConnection : VoiceConnection, message : Message){
    const audioToPlay = queue.shift();
    const stream = await getAudioStream(audioToPlay!.url);
    if(!stream) return;
    const resource = createAudioResource(stream.stream, { inputType:StreamType.Arbitrary });
    await player.play(resource);
    voiceConnection.subscribe(player);
    return message.channel.send(`Now Playing ${stream.videoInfo!.player_response.microformat.playerMicroformatRenderer.title.simpleText}`);
}
export async function addToPlayer(param : string, message: Message){
    if(!message.member!.voice.channel) return message.channel.send("Please join a voice channel to listen to your music");
    const urls = await parsePlayParameter(param);
    if(!urls) return message.channel.send("Invalid URL");
    urls.forEach(x => queue.push(x));
    if(urls.length>1) message.channel.send(`Added playlist of ${urls.length} songs to the queue`);
    else message.channel.send(`Added ${urls[0].title} to queue`);
    if(player.state.status === AudioPlayerStatus.Playing){
        return;
    }
    const voiceConnection = joinVoiceChannel({
        selfDeaf:true,
        channelId: message.member!.voice.channel.id,
        guildId: message.guild!.id,
        adapterCreator: message.guild!.voiceAdapterCreator as DiscordGatewayAdapterCreator
    });
    playNext(voiceConnection,message).catch();
    player.addListener(AudioPlayerStatus.Idle, () => {
        if (queue.length <= 0) {
            player.removeAllListeners(AudioPlayerStatus.Idle);
            voiceConnection.disconnect();
            voiceConnection.destroy();
            return;
        }
        playNext(voiceConnection, message).catch();
    });
}

export async function skip(message : Message) {
    return message.channel.send("Skipped current song");
}

export async function shuffle(message : Message) {
    if(queue.length>0){
        shuffleArray(queue);
        return message.channel.send("Shuffled current queue");
    }
    return message.channel.send("The queue is empty");
}

export function stop(message : Message){
    if(player.state.status === AudioPlayerStatus.Playing)
    {
        player.stop();
        return message.channel.send("Stopped playing music");
    }
    return message.channel.send("I am not currently playing any music");
}

export async function clear(message : Message){
    if(queue.length>0){
        queue = [];
        return message.channel.send("Cleared the queue");
    }
    return message.channel.send("The queue is empty");
}

export function getQueue(param : string, message : Message){
    if(queue.length<=0){
        return message.channel.send("The queue is empty");
    }
    let msg = ''
    if(!param)
    {
        queue.slice(0, 5).map(x => msg += `${x.title}\n`)
        return message.channel.send(msg);
    }
    if(isNaN(+param))
        return message.channel.send("Please enter number of queue entries to view");
    queue.slice(0, +param).map(x => msg += `${x.title}\n`)
    return message.channel.send(msg);
}