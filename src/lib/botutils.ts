import {client} from '../index';
import {TextChannel} from 'discord.js';

export function broadcastMessage(message: string) {
    client.guilds.cache.map((guild) => {
        if (guild.available) {
            const firstTextChannel = guild.channels.cache.find((channel) => !!channel.isText()) as TextChannel;
            if (firstTextChannel) {
                firstTextChannel.send(message);
            }
        }
    });
    return true;
}
