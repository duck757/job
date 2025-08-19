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

// === Account Configs ===
// Account 1
const ACCOUNT1 = {
  TOKEN: process.env.DISCORD_TOKEN_1,
  CHANNEL_ID: process.env.CHANNEL_ID_1,
  ALLOWED_IDS: [
    "651755637499232256",
    "981272700351828050",
    "518862912392003584",
    "699926664188002354"
  ]
};

// Account 2
const ACCOUNT2 = {
  TOKEN: process.env.DISCORD_TOKEN_2,
  CHANNEL_ID: process.env.CHANNEL_ID_2,
  ALLOWED_IDS: [
    "224533919415009290",
    "1153364065033408593",
    "1284481288589283331"
    // add more IDs for account 2 if needed
  ]
};

// === Start both accounts ===
[ACCOUNT1, ACCOUNT2].forEach((config, idx) => {
  if (!config.TOKEN) {
    console.log(`⚠️ Account ${idx + 1} TOKEN missing, skipping`);
    return;
  }
  startBot(config, idx + 1);
});

function startBot({ TOKEN, CHANNEL_ID, ALLOWED_IDS }, accountNum) {
  const client = new Client();

  process.on("unhandledRejection", (err) => {
    console.error(`[Acc${accountNum}] UnhandledRejection:`, err);
  });
  process.on("uncaughtException", (err) => {
    console.error(`[Acc${accountNum}] UncaughtException:`, err);
  });

  client.on("ready", () => {
    console.log(`[Acc${accountNum} Login] Logged in as ${client.user?.username}`);
    startRandomCountingLoop(client, CHANNEL_ID, ALLOWED_IDS, accountNum).catch(
      (err) => {
        console.error(`[Acc${accountNum}] Counting loop error:`, err);
      }
    );
  });

  client.login(TOKEN).catch((err) => {
    console.error(`[Acc${accountNum}] Discord login failed:`, err);
  });
}

async function startRandomCountingLoop(client, CHANNEL_ID, ALLOWED_IDS, accountNum) {
  const channel = await client.channels.fetch(CHANNEL_ID);
  let streak = 0;

  while (true) {
    const waitTime = randInt(1, 3) * 60 * 1000;
    logStatus(accountNum, "Sleeping", `Waiting ${Math.floor(waitTime / 60000)} mins`);
    await sleep(waitTime);

    let retryAttempts = 0;

    while (retryAttempts <= 2) {
      const latest = (await channel.messages.fetch({ limit: 1 })).first();
      const latestNumber = parseInt(latest?.content?.trim?.() ?? "");

      if (!latest || isNaN(latestNumber)) {
        logStatus(accountNum, "Skipping", "Latest message is not a number");
        break;
      }

      const authorId = latest.author?.id;
      const authorTag = latest.author?.tag;

      if (!authorId) {
        logStatus(accountNum, "Skipping", "Latest message author not available");
        break;
      }

      if (authorId === client.user.id) {
        logStatus(accountNum, "Skipping", "Last message was from self — solo not allowed");
        break;
      }

      if (!ALLOWED_IDS.includes(authorId)) {
        const name = authorTag || authorId;
        logStatus(accountNum, "Skipping", `Last number sent by ${name} not in allowed list`);
        break;
      }

      // === 4-in-1 Skip Logic ===
      let shouldSkip = false;

      if (Math.random() < 0.2) {
        logStatus(accountNum, "Skipping", "Random skip (20% chance)");
        shouldSkip = true;
      }

      const skipChance = waitTime < 3 * 60 * 1000 ? 0.4 : 0.1;
      if (!shouldSkip && Math.random() < skipChance) {
        logStatus(accountNum, "Skipping", "Time-weighted skip");
        shouldSkip = true;
      }

      if (!shouldSkip && streak >= 3 && Math.random() < 0.5) {
        logStatus(accountNum, "Skipping", "Breaking streak to look human");
        streak = 0;
        shouldSkip = true;
      }

      if (!shouldSkip && Math.random() < 0.05) {
        logStatus(accountNum, "Skipping", "Taking a long rest (extra wait)");
        await sleep(randInt(5, 10) * 60 * 1000);
        shouldSkip = true;
      }

      if (shouldSkip) {
        break;
      }

      // === Normal counting flow ===
      const next = latestNumber + 1;

      await channel.sendTyping();
      await sleep(randInt(1000, 3000));

      const confirm = (await channel.messages.fetch({ limit: 1 })).first();
      const confirmNum = parseInt(confirm?.content?.trim?.() ?? "");

      if (!confirm || confirm.id !== latest.id || confirmNum !== latestNumber) {
        retryAttempts++;
        if (retryAttempts > 2) {
          logStatus(accountNum, "Canceled", "Sniped again. Giving up this round.");
          break;
        }
        logStatus(accountNum, "Retrying", `Sniped — retrying (attempt ${retryAttempts})`);
        continue;
      }

      await channel.send(`${next}`);
      streak++;
      logStatus(accountNum, "Counting", `Sent ${next}`);
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

function logStatus(acc, status, reason) {
  console.log(`[Acc${acc}] [${new Date().toISOString()}] [${status}] ${reason}`);
}
