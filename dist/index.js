"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const dotenv_1 = require("dotenv");
const Dispatcher_1 = require("./Dispatcher");
(0, dotenv_1.config)();
const client = new discord_js_1.Client({ intents: [discord_js_1.Intents.FLAGS.GUILDS, discord_js_1.Intents.FLAGS.GUILD_MESSAGES, discord_js_1.Intents.FLAGS.GUILD_VOICE_STATES] });
(async () => {
    client.on("ready", () => {
        console.log("bot is ready");
    });
    client.on("messageCreate", async (message) => {
        if (message.content.startsWith('-')) {
            await (0, Dispatcher_1.dispatcher)(message);
        }
    });
    const loginResult = await client.login(process.env.TOKEN);
    if (loginResult) {
        console.log("logged in successfully");
    }
})();
//# sourceMappingURL=index.js.map