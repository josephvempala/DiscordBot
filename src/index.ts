import {Client, Intents} from 'discord.js';
import {config} from 'dotenv';
import {musicPlayerDispatcher} from './MusicPlayer/dispatcher';
import {logger} from './services/logger';
import {RateLimiter} from './lib/RateLimiter';
import {MusicPlayerManager} from './MusicPlayer/MusicPlayerManager';

config();

export const client = new Client({intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES]});

client.on('ready', () => {
	console.log('bot is ready');
});

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

client.on('voiceStateUpdate', MusicPlayerManager.voiceChannelChange);

client.login(process.env.TOKEN).then(() => {
	console.log('logged in successfully');
});
