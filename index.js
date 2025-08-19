require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.Guilds,
  ],
});

const TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const TARGET_USER_ID = process.env.TARGET_USER_ID;

client.on("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("presenceUpdate", (oldPresence, newPresence) => {
  if (newPresence?.userId === TARGET_USER_ID && newPresence.status === "online") {
    const channel = client.channels.cache.get(CHANNEL_ID);
    channel?.send(`Hi <@${TARGET_USER_ID}> 👋`);
  }
});

client.login(TOKEN);
