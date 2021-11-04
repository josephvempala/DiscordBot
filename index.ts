import {Client, Intents} from "discord.js";
import {config} from "dotenv";
import {dispatcher} from "./Dispatcher";

config();
const client = new Client({intents:[Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES]});
(async()=>{
    client.on("ready",()=>{
        console.log("bot is ready");
    });
    client.on("messageCreate",async (message)=>{
        if(message.content.startsWith('-')){
            await dispatcher(message);
        }
    });
    const loginResult = await client.login(process.env.TOKEN);
    if(loginResult){
        console.log("logged in successfully");
    }
})();
