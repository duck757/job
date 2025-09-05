require("dotenv").config();
const express = require("express");
const { Client } = require("discord.js-selfbot-v13");
const { fetch } = require("undici");

// === KeepAlive ===
const app = express();
app.get("/healthz", (_, res) => res.send("OK"));
app.listen(process.env.PORT || 3000, () => {
  console.log(`✅ KeepAlive running on port ${process.env.PORT || 3000}`);
});
const SELF_URL = process.env.SELF_URL;
setInterval(() => fetch(SELF_URL).catch(() => {}), 270000); // every 4.5m

// === Accounts Loader ===
// Expect environment variables like:
// DISCORD_TOKEN_1, CHANNEL_ID_1
// DISCORD_TOKEN_2, CHANNEL_ID_2
// ...
const ACCOUNTS = [
  { token: process.env.DISCORD_TOKEN_1, channel: process.env.CHANNEL_ID_1 },
  { token: process.env.DISCORD_TOKEN_2, channel: process.env.CHANNEL_ID_2 },
  { token: process.env.DISCORD_TOKEN_3, channel: process.env.CHANNEL_ID_3 },
  { token: process.env.DISCORD_TOKEN_4, channel: process.env.CHANNEL_ID_4 },
];

for (const acc of ACCOUNTS) {
  if (!acc.token || !acc.channel) continue; // skip missing
  startBot(acc.token, acc.channel);
}

// === Bot Logic (your original code wrapped) ===
function startBot(TOKEN, CHANNEL_ID) {
  const client = new Client();

  client.on("ready", () => {
    console.log(`[Login] ${client.user.username}`);
    startRandomCountingLoop(client, CHANNEL_ID);
  });

  client.login(TOKEN);
}

async function startRandomCountingLoop(client, CHANNEL_ID) {
  const channel = await client.channels.fetch(CHANNEL_ID);

  while (true) {
    const waitTime = randInt(1, 500) * 60 * 1000;
    logStatus(client, "Sleeping", `Waiting ${Math.floor(waitTime / 60000)} mins`);
    await sleep(waitTime);

    let retryAttempts = 0;
    while (retryAttempts <= 2) {
      const latest = (await channel.messages.fetch({ limit: 1 })).first();
      const latestNumber = parseInt(latest?.content.trim());

      if (!latest || isNaN(latestNumber)) {
        logStatus(client, "Skipping", "Latest message is not a number");
        break;
      }

      if (latest.author.id === client.user.id) {
        logStatus(client, "Skipping", "Last message was from self — solo not allowed");
        break;
      }

      const next = latestNumber + 1;
      await channel.sendTyping();
      await sleep(randInt(1000, 3000));

      const confirm = (await channel.messages.fetch({ limit: 1 })).first();
      const confirmNum = parseInt(confirm?.content.trim());

      if (!confirm || confirm.id !== latest.id || confirmNum !== latestNumber) {
        retryAttempts++;
        if (retryAttempts > 2) {
          logStatus(client, "Canceled", "Sniped again. Giving up this round.");
          break;
        }
        logStatus(client, "Retrying", `Sniped — retrying immediately (attempt ${retryAttempts})`);
        continue;
      }

      await channel.send(`${next}`);
      logStatus(client, "Counting", `Sent ${next}`);
      break;
    }
  }
}

// === Utilities ===
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}
function logStatus(client, status, reason) {
  console.log(`[${client.user.username}] [${status}] ${reason}`);
}
