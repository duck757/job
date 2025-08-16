require("dotenv").config();

const express = require("express");
const app = express();
app.get("/healthz", (_, res) => res.send("OK"));
app.listen(process.env.PORT || 3000, () => {
  console.log(`âœ… KeepAlive running on port ${process.env.PORT || 3000}`);
});

const { fetch } = require("undici");
const SELF_URL = process.env.SELF_URL;
setInterval(() => {
  if (SELF_URL) fetch(SELF_URL).catch(() => {});
}, 270000); // every 4.5 minutes

const { Client } = require("discord.js-selfbot-v13");
const client = new Client();

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

// === ONLY NEW: allowed IDs list ===
const ALLOWED_IDS = [
  "651755637499232256",
  "981272700351828050",
  "518862912392003584",
  "699926664188002354"
];
// ===================================

// Minimal error logging so the process doesn't exit silently on Render
process.on("unhandledRejection", (err) => {
  console.error("UnhandledRejection:", err);
});
process.on("uncaughtException", (err) => {
  console.error("UncaughtException:", err);
});

client.on("ready", () => {
  console.log(`[Login] Logged in as ${client.user?.username}`);
  startRandomCountingLoop().catch((err) => {
    console.error("Counting loop error:", err);
  });
});

async function startRandomCountingLoop() {
  const channel = await client.channels.fetch(CHANNEL_ID);

  while (true) {
    const waitTime = randInt(1, 6) * 60 * 1000; // 1-7 minutes as you set
    logStatus("Sleeping", `Waiting ${Math.floor(waitTime / 60000)} mins`);
    await sleep(waitTime);

    let retryAttempts = 0;

    while (retryAttempts <= 2) {
      const latest = (await channel.messages.fetch({ limit: 1 })).first();
      const latestNumber = parseInt(latest?.content?.trim?.() ?? "");

      if (!latest || isNaN(latestNumber)) {
        logStatus("Skipping", "Latest message is not a number");
        break;
      }

      // safe author access
      const authorId = latest.author?.id;
      const authorTag = latest.author?.tag;

      if (!authorId) {
        logStatus("Skipping", "Latest message author not available");
        break;
      }

      // keep your original self-check first (unchanged behavior)
      if (authorId === client.user.id) {
        logStatus("Skipping", "Last message was from self â€” solo not allowed");
        break;
      }

      // âœ… NEW: Only proceed if last author is in allowed list
      if (!ALLOWED_IDS.includes(authorId)) {
        const name = authorTag || authorId;
        logStatus("Skipping", `Last number sent by ${name} not in allowed list`);
        break;
      }

      const next = latestNumber + 1;

      await channel.sendTyping();
      await sleep(randInt(1000, 3000)); // Human-like delay

      const confirm = (await channel.messages.fetch({ limit: 1 })).first();
      const confirmNum = parseInt(confirm?.content?.trim?.() ?? "");

      if (
        !confirm ||
        confirm.id !== latest.id ||
        confirmNum !== latestNumber
      ) {
        retryAttempts++;
        if (retryAttempts > 2) {
          logStatus("Canceled", "Sniped again. Giving up this round.");
          break;
        }

        logStatus("Retrying", `Sniped â€” retrying immediately (attempt ${retryAttempts})`);
        continue;
      }

      await channel.send(`${next}`);
      logStatus("Counting", `Sent ${next}`);
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

function logStatus(status, reason) {
  console.log(`[${status}] ${reason}`);
}

// Safe login: log failure but keep process alive for debugging
client.login(TOKEN).catch((err) => {
  console.error("Discord login failed:", err);
});