export class MusicPlayerLogger {
	private static instance: MusicPlayerLogger;

	private constructor() {
		MusicPlayerLogger.instance = this;
	}

	public static getInstance() {
		if (!MusicPlayerLogger.instance) {
			return (MusicPlayerLogger.instance = new MusicPlayerLogger());
		}
		return MusicPlayerLogger.instance;
	}

	public debug(msg: string, guildId: string) {
		const time = new Date();
		console.log(`[${time.toLocaleDateString()}:${time.toLocaleTimeString()}][DEBUG] : ${msg}`);
	}

	public error(msg: string, guildId: string) {
		const time = new Date();
		console.error(`[${time.toLocaleDateString()}:${time.toLocaleTimeString()}][ERROR] : ${msg}`);
	}
}

export const logger = MusicPlayerLogger.getInstance();
