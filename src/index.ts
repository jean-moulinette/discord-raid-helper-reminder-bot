import dotenv from "dotenv";
import cron from "node-cron";
import { Client, GatewayIntentBits, Partials } from "discord.js";
import {
  getNextRaidInTwoDays,
  recreateNextWeekRaidHelper,
  recreateRaidHelperChannelThread,
  removeFirstExpiredRaidHelper,
  tagMissingSignees,
} from "./helpers/raids";
import {
  CRON_SCHEDULE_EVERY_DAYS_AT_6PM,
  CRON_SCHEDULE_EVERY_DAYS_AT_MIDNIGHT,
} from "./consts";
import {
  fetchRaidHelperPostedEvents,
  PostedRaidHelperEvent,
} from "./helpers/raid-helper";
import { testServicesConnection } from "./helpers/services-check";
import { getDiscordClient, onDiscordClientError } from "./helpers/discord";

dotenv.config();

const ACTIVE_RAID_HELPERS: PostedRaidHelperEvent[] = [];

main();

async function main() {
  const client = getDiscordClient();
  client
    .once("ready", onDiscordClientReady)
    .once("error", onDiscordClientError);
  try {
    await client.login(process.env.DISCORD_TOKEN);
  } catch (e) {
    if (e instanceof Error) {
      console.error("Error while logging in to discord client:", e.message);
    } else {
      console.error("Error while logging in to discord client:", e);
    }
    console.error(
      "Killing bot due to failed login, make sure your DISCORD_TOKEN is correct in .env file"
    );
    killBot();
  }
  await healthCheck(client);
}

function onDiscordClientReady(client: Client) {
  if (!client.user) {
    throw Error("No client user");
  }

  console.log(`Bot successfully logged in as "${client.user.displayName}"!`);

  // Schedule job to notify about missing signees in raid helper
  cron.schedule(CRON_SCHEDULE_EVERY_DAYS_AT_6PM, () => {
    console.log("Running log police watch job");
    logPoliceWatch(client);
  });

  // Schedule job to clean up raid helpers channel
  cron.schedule(CRON_SCHEDULE_EVERY_DAYS_AT_MIDNIGHT, () => {
    console.log("Running raid-helper cleanup job");
    cleanUpRaidHelpersChannel(client);
  });

  console.log("\n\nScheduled jobs successfully started\n");
  console.log("Missing signs ups will be notified at 06:00pm every day");
  console.log("Raid helpers cleanup will be done at 00:05am every day");
}

async function healthCheck(client: Client) {
  try {
    await testServicesConnection(client);
  } catch (e) {
    console.error(
      "Killing bot due to failed health check, check logs for more info"
    );
    killBot();
  }
  console.log("\nAll services are up and running");
}

function killBot() {
  process.exit(1);
}

async function logPoliceWatch(client: Client) {
  try {
    // Update bot memory with active raid helpers
    await hydrateActiveRaidHelpers();

    // Find raid that will happen in 2 days from start time in unix timestamp
    const nextRaid = getNextRaidInTwoDays(ACTIVE_RAID_HELPERS);

    if (!nextRaid) {
      console.log("No raid found in 2 days. Exiting...");
      return;
    }

    // Tag missing signees in raid helper channel and send report to officers
    await tagMissingSignees(client, nextRaid);
  } catch (e) {
    if (e instanceof Error) {
      console.error("Error in logPoliceWatch:", e.message);
    }
  }
}

async function cleanUpRaidHelpersChannel(client: Client) {
  try {
    const result = await removeFirstExpiredRaidHelper();

    if (
      !result ||
      !result.channelIdToRecreateRh ||
      !result.removedEventStartTime
    ) {
      console.log("No raid helpers found to recreate");
      return;
    }

    const { channelIdToRecreateRh, removedEventStartTime } = result;

    const nextRaidDate = await recreateNextWeekRaidHelper(
      channelIdToRecreateRh,
      removedEventStartTime
    );

    await recreateRaidHelperChannelThread(
      client,
      channelIdToRecreateRh,
      nextRaidDate
    );

    console.log("Raid helpers cleanup complete");
  } catch (e) {
    if (e instanceof Error) {
      console.error("Error in cleanUpRaidHelpersChannel:", e.message);
    }
  }
}

async function hydrateActiveRaidHelpers() {
  let latestRhEvents: PostedRaidHelperEvent[] = [];
  try {
    latestRhEvents = await fetchRaidHelperPostedEvents();
  } catch (e) {
    throw Error("Error while hydrating active raid helpers from Raid-Helper:");
  }

  if (!latestRhEvents.length) {
    console.log("No raid helpers found");
    return;
  }

  // Remove inactive raid helpers from memory
  ACTIVE_RAID_HELPERS.forEach((rhEvent) => {
    const isEventActive = latestRhEvents.find(
      (event) => event.id === rhEvent.id
    );
    if (!isEventActive) {
      ACTIVE_RAID_HELPERS.splice(ACTIVE_RAID_HELPERS.indexOf(rhEvent), 1);
    }
  });

  // Add new active raid helpers to memory
  latestRhEvents.forEach((rhEvent) => {
    if (!ACTIVE_RAID_HELPERS.find((event) => event.id === rhEvent.id)) {
      ACTIVE_RAID_HELPERS.push(rhEvent);
    }
  });
}
