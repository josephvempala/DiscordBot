export interface IDiscordCommand {
    guildId: string,
    voiceChannelId: string,
    reply: (message: string) => Promise<void>,
}