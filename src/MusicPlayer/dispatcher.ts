import {MusicPlayerManager} from './MusicPlayerManager';
import {broadcastMessage} from '../lib/botutils';
import {Message} from 'discord.js';

export async function musicPlayerDispatcher(message: Message) {
	const input = message.content + ' ';
	const action = input.substring(1, input.indexOf(' ')).toLowerCase();
	const param = input.substring(input.indexOf(' '), input.length).trim();
	switch (action) {
		case 'ping':
			await message.reply('pong');
			break;
		case 'np':
		case 'nowplaying':
			MusicPlayerManager.getNowPlaying(message);
			break;
		case 'msgall':
			if (message.author.id === '704257828080058419' || message.author.id === '266115749704105984') broadcastMessage(param);
			break;
	}
	if (!message.member?.voice.channel) {
		message.channel.send('Please join a voice channel to listen');
		await message.react('🛑');
		return;
	}
	switch (action) {
		case 'play':
		case 'p':
			MusicPlayerManager.play(message, param);
			break;
		case 'search':
		case 'ps':
			///            MusicPlayerManager.search(message, param);
			break;
		case 'pause':
			MusicPlayerManager.pause(message);
			break;
		case 'stop':
		case 'st':
			MusicPlayerManager.stop(message);
			break;
		case 'clear':
		case 'c':
			MusicPlayerManager.clear(message);
			break;
		case 'shuffle':
		case 'sh':
			MusicPlayerManager.shuffle(message);
			break;
		case 'skip':
		case 's':
			MusicPlayerManager.skip(message);
			break;
		case 'queue':
		case 'q':
			MusicPlayerManager.getQueue(message, param);
			break;
		case 'bbpm':
			MusicPlayerManager.bbpm(message);
			break;
		case 'l':
		case 'leave':
			MusicPlayerManager.leave(message);
			break;
		case 'prev':
		case 'pt':
			MusicPlayerManager.previousTrack(message);
	}
}
