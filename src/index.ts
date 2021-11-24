import {Client, Intents} from "discord.js";
import {config} from "dotenv";
import {dispatcher} from "./Dispatcher";
import {createServer} from "http";

config();
createServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end()
}).listen(process.env.PORT || 5000);
export const client = new Client({intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES]});
client.on("ready", () => {
    console.log("bot is ready");
});
client.on("messageCreate", (message) => {
    if (message.content.startsWith('-')) {
        dispatcher(message).catch(x => console.log(x));
    }
});
client.login(process.env.TOKEN).then(() => {
    console.log("logged in successfully");
});