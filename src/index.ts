import {Client, Intents} from "discord.js";
import {config} from "dotenv";
import {dispatcher} from "./Dispatcher";
import {createServer} from 'http';

config();
createServer(function (req, res) {     res.writeHead(200, {'Content-Type': 'text/plain'}); }).listen(process.env.PORT || 5000);
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
