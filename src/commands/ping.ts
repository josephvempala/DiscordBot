import {CommandInteraction, SlashCommandBuilder} from 'discord.js';

module.exports = {
    data: new SlashCommandBuilder().setName('ping').setDescription('says pong'),
    async execute(interaction: CommandInteraction) {
        await interaction.reply('Says Pong');
    },
};
