import {Client, Events, GatewayIntentBits} from 'discord.js';
import {config} from 'dotenv';
import {musicPlayerDispatcher} from './MusicPlayer/dispatcher';
import {logger} from './services/logger.js';
import {RateLimiter} from './lib/RateLimiter';
import {voiceChannelChange} from './MusicPlayer/MusicPlayer';

config();

export const client = new Client({intents: [GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.Guilds]});

const rateLimiter = new RateLimiter(4, 0.34);

client.on('messageCreate', (message) => {
    if (message.content.startsWith('-') && !message.author.bot && message.guildId) {
        if (rateLimiter.isRateLimited(message.author.id)) {
            message.reply('Please wait before issuing more commands');
            return;
        }
        musicPlayerDispatcher(message).catch((x: any) => logger.error(`${x}`, ''));
    }
});

client.once(Events.ClientReady, (c) => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.on('voiceStateUpdate', voiceChannelChange);

client.login(process.env.TOKEN);
