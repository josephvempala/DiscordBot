import {Client, Intents} from "discord.js";
import {config} from "dotenv";
import {messageDispatcher} from "./Dispatcher";
import {createServer} from "http";
import {voiceChannelChange} from "./MusicPlayer";
import {logger} from "./logger.js";

config();
createServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write(
        "<!DOCTYPE html>\n" +
        "<html lang=\"en\">\n" +
        "<head>\n" +
        "    <meta charset=\"UTF-8\">\n" +
        "    <meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\">\n" +
        "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n" +
        "    <title>Document</title>\n" +
        "</head>\n" +
        "<body>\n" +
        "    \n" +
        "</body>\n" +
        "<script>\n" +
        "    window.location.replace(\"https://discord.com/api/oauth2/authorize?client_id=902475106381606915&permissions=3157056&scope=bot\");\n" +
        "</script>\n" +
        "</html>"
    );
    res.end()
}).listen(process.env.PORT || 5001);

export const client = new Client({intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES]});

client.on("ready", () => {
    console.log("bot is ready");
});

client.on("messageCreate", (message) => {
    if (message.content.startsWith('-') && !message.author.bot && message.guildId) {
        messageDispatcher(message)?.catch(x => logger.error(`${x}`));
    }
});

client.on('voiceStateUpdate', voiceChannelChange);

client.login(process.env.TOKEN).then(() => {
    console.log("logged in successfully");
});
