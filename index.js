require("dotenv").config();

const express = require("express");
const app = express();
app.get("/healthz", (_, res) => res.send("OK"));
app.listen(process.env.PORT || 3000, () => {
  console.log(`✅ KeepAlive running on port ${process.env.PORT || 3000}`);
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
  "699926664188002354",
  "1284481288589283331"
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
  let streak = 0; // ✅ streak tracker for skip logic

  while (true) {
    const waitTime = randInt(1, 7) * 60 * 1000; // 1-7 minutes
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

      const authorId = latest.author?.id;
      const authorTag = latest.author?.tag;

      if (!authorId) {
        logStatus("Skipping", "Latest message author not available");
        break;
      }

      if (authorId === client.user.id) {
        logStatus("Skipping", "Last message was from self — solo not allowed");
        break;
      }

      if (!ALLOWED_IDS.includes(authorId)) {
        const name = authorTag || authorId;
        logStatus("Skipping", `Last number sent by ${name} not in allowed list`);
        break;
      }

      // ✅ 4-in-1 Skip Logic (random, time-weighted, streak-breaker, long rest)
      let shouldSkip = false;

      // 1) Random skip (20%)
      if (Math.random() < 0.2) {
        logStatus("Skipping", "Random skip (20% chance)");
        shouldSkip = true;
      }

      // 2) Time-weighted skip (40% if wait < 3 mins, else 10%)
      const skipChance = waitTime < 3 * 60 * 1000 ? 0.4 : 0.1;
      if (!shouldSkip && Math.random() < skipChance) {
        logStatus("Skipping", "Time-weighted skip");
        shouldSkip = true;
      }

      // 3) Streak breaker (after 3+ counts, 50% chance to skip)
      if (!shouldSkip && streak >= 3 && Math.random() < 0.5) {
        logStatus("Skipping", "Breaking streak to look human");
        streak = 0;
        shouldSkip = true;
      }

      // 4) Long rest skip (5% chance, 5–10 min extra wait)
      if (!shouldSkip && Math.random() < 0.05) {
        logStatus("Skipping", "Taking a long rest (extra wait)");
        await sleep(randInt(5, 10) * 60 * 1000);
        shouldSkip = true;
      }

      if (shouldSkip) {
        break; // skip this round
      }

      // === Normal counting flow ===
      const next = latestNumber + 1;

      await channel.sendTyping();
      await sleep(randInt(1000, 3000)); // Human-like delay

      const confirm = (await channel.messages.fetch({ limit: 1 })).first();
      const confirmNum = parseInt(confirm?.content?.trim?.() ?? "");

      if (!confirm || confirm.id !== latest.id || confirmNum !== latestNumber) {
        retryAttempts++;
        if (retryAttempts > 2) {
          logStatus("Canceled", "Sniped again. Giving up this round.");
          break;
        }

        logStatus(
          "Retrying",
          `Sniped — retrying immediately (attempt ${retryAttempts})`
        );
        continue;
      }

      await channel.send(`${next}`);
      streak++;
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
  console.log(`[${new Date().toISOString()}] [${status}] ${reason}`);
}

// Safe login: log failure but keep process alive for debugging
client.login(TOKEN).catch((err) => {
  console.error("Discord login failed:", err);
});
