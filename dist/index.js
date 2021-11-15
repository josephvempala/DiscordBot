"use strict";
Object.defineProperty(exports, "__esModule", {value: true});
const discord_js_1 = require("discord.js");
const dotenv_1 = require("dotenv");
const Dispatcher_1 = require("./Dispatcher");
const http_1 = require("http");
(0, dotenv_1.config)();
(0, http_1.createServer)((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end();
}).listen(process.env.PORT || 5000);
const client = new discord_js_1.Client({intents: [discord_js_1.Intents.FLAGS.GUILDS, discord_js_1.Intents.FLAGS.GUILD_MESSAGES, discord_js_1.Intents.FLAGS.GUILD_VOICE_STATES]});
client.on("ready", () => {
    console.log("bot is ready");
});
client.on("messageCreate", (message) => {
    if (message.content.startsWith('-')) {
        (0, Dispatcher_1.dispatcher)(message).catch(x => "error");
    }
});
client.login(process.env.TOKEN).then(() => {
    console.log("logged in successfully");
});
//# sourceMappingURL=index.js.map