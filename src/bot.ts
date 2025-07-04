import cron from "node-cron";
import { type Client } from "discord.js";
import {
  fetchRaidHelperPostedEvents,
  type PostedRaidHelperEvent,
} from "./helpers/raid-helper";
import {
  CRON_SCHEDULE_EVERY_DAYS_AT_6PM,
  CRON_SCHEDULE_EVERY_DAYS_AT_MIDNIGHT,
  CRON_SCHEDULE_EVERY_DAYS_AT_NOON,
  CRON_SCHEDULE_EVERYTUESDAY_AT_6PM_AND_1_MINUTE,
  HYDRATING_ACTIVE_RAIDS_ERROR,
  OFFICERS_ERROR_MESSAGE_RAID_HELPER_DOWN_RAID_IN_TWO_DAYS,
  OFFICERS_ERROR_MESSAGE_RAID_HELPER_DOWN_RAID_OF_WEEK,
} from "./consts";
import {
  getNextRaidInTwoDays,
  getNextTwoMainRaids,
  isRaidHelperExpired,
  pingOfficersWithBotFailure,
  recreateNextWeekRaidHelper,
  recreateRaidHelperChannelThread,
  removeFirstExpiredRaidHelper,
  tagMissingSignees,
} from "./helpers/raids";
import { generateAzerothNews } from "./helpers/ai";
import { getDiscordChannel } from "./helpers/discord";

const ACTIVE_RAID_HELPERS: PostedRaidHelperEvent[] = [];

export function startBot(client: Client) {
  if (!client.user) {
    throw Error("No client user");
  }

  console.log(`Bot successfully logged in as "${client.user.displayName}"!`);

  // Schedule job to notify about missing signees in raid helper for next raid occurins in 2 days
  cron.schedule(CRON_SCHEDULE_EVERY_DAYS_AT_6PM, () => {
    console.log("Running log police watch job");
    logPoliceWatchForRaidInTwoDays(client);
  });

  // Schedule job to clean up raid helpers channel
  cron.schedule(CRON_SCHEDULE_EVERY_DAYS_AT_MIDNIGHT, () => {
    console.log("Running raid-helper cleanup job");
    cleanUpRaidHelpersChannel(client);
  });

  // Sechedule job to notify about main raids of the week
  cron.schedule(CRON_SCHEDULE_EVERYTUESDAY_AT_6PM_AND_1_MINUTE, () => {
    console.log("Running log police for main raids of the week job");
    logPoliceForMainRaidsOfTheWeek(client);
  });

  // Schedule job to generate Azeroth news
  if (process.env.AZEROTH_NEWS_CHANNEL_ID && process.env.PERPLEXITY_API_KEY) {
    cron.schedule(CRON_SCHEDULE_EVERY_DAYS_AT_NOON, () => {
      console.log("Running Azeroth news generator job");
      postAzerothNews(client);
    });
  }

  console.log("\nScheduled jobs successfully started\n");
  console.log("- Missing signs ups for main raids of the week will be notified at 06:00pm every tuesday");
  console.log("- Missing signs ups for optional raids will be notified at 06:00pm every day starting from 2 days before the raid");
  console.log("- Raid helpers cleanup will be done at 00:05am every day");
}

async function logPoliceForMainRaidsOfTheWeek(client: Client) {

  try {
    await hydrateActiveRaidHelpers();
  } catch (error) {
    console.error("Error in logPoliceForMainRaidsOfTheWeek:", error);

    if (error instanceof Error && error.message === HYDRATING_ACTIVE_RAIDS_ERROR) {
      await pingOfficersWithBotFailure(
        client,
        OFFICERS_ERROR_MESSAGE_RAID_HELPER_DOWN_RAID_OF_WEEK,
      );
    }
    return;
  }

  try {
    const nextTwoMainRaids = getNextTwoMainRaids(ACTIVE_RAID_HELPERS);

    if (!nextTwoMainRaids.length) {
      console.log("No main raids found for the week. Exiting...");
      return;
    }

    nextTwoMainRaids.forEach(async (raid) => {
      await tagMissingSignees(client, raid);
    });
  } catch (e) {
    if (e instanceof Error) {
      console.error("Error in logPoliceForMainRaidsOfTheWeek:", e.message);
    }
    await pingOfficersWithBotFailure(
      client,
      "Vérification des membres inscrits pour les raids principaux de la semaine et notification dans le fil RH des membres ayant oublié de s'inscrire"
    );
  }
}

async function logPoliceWatchForRaidInTwoDays(client: Client) {
  // Update bot memory with active raid helpers
  try {
    await hydrateActiveRaidHelpers();
  } catch (error) {
    console.error("Error in logPoliceWatchForRaidInTwoDays:", error);

    if (error instanceof Error && error.message === HYDRATING_ACTIVE_RAIDS_ERROR) {
      await pingOfficersWithBotFailure(
        client,
        OFFICERS_ERROR_MESSAGE_RAID_HELPER_DOWN_RAID_IN_TWO_DAYS,
      );
    }
    return;
  }

  try {
    // Find raid that will happen in 2 days from start time in unix timestamp
    const nextRaid = getNextRaidInTwoDays(ACTIVE_RAID_HELPERS);

    if (!nextRaid) {
      console.log("No raid found in 2 days. Exiting...");
      return;
    }

    const { startTime } = nextRaid;
    const raidDate = new Date(startTime * 1000);

    // If next raid is on monday, we need to check tag missing signees for the next raid
    if (raidDate.getDay() === 1) {
      // Tag missing signees in raid helper channel and send report to officers
      await tagMissingSignees(client, nextRaid);
    }
  } catch (e) {
    if (e instanceof Error) {
      console.error("Error in logPoliceWatch:", e.message);
    }
    await pingOfficersWithBotFailure(
      client,
      "Vérification des membres inscrits pour le prochain raid et notification dans le fil RH des membres ayant oublié de s'inscrire"
    );
  }
}

async function cleanUpRaidHelpersChannel(client: Client) {
  try {
    const result = await removeFirstExpiredRaidHelper(client);

    if (
      !result ||
      !result.channelIdToRecreateRh ||
      !result.removedEventStartTime
    ) {
      console.log("No raid helpers found to recreate");
      return;
    }

    const { channelIdToRecreateRh, removedEventStartTime, raidHelperTitleToRecreate } = result;

    const nextRaidDate = await recreateNextWeekRaidHelper(
      channelIdToRecreateRh,
      removedEventStartTime,
      raidHelperTitleToRecreate,
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

    await pingOfficersWithBotFailure(
      client,
      "Suppréssion du dernier raid helper expiré et création de celui de la semaine prochaine."
    );
  }
}

async function hydrateActiveRaidHelpers() {
  let latestRhEvents: PostedRaidHelperEvent[] = [];
  try {
    latestRhEvents = await fetchRaidHelperPostedEvents();
  } catch (e) {
    console.error('Fetching raid helpers failed. Retrying in 1 minute...');

    // Retry after 1 minute if the first attempt fails
    try {
      await new Promise<void>((resolve, reject) => {
        setTimeout(async () => {
          try {
            latestRhEvents = await fetchRaidHelperPostedEvents();
            resolve();
          } catch (e) {
            reject();
          }
        }, 60000);
      });
    } catch (e) {
      console.error('Second attempt to fetch raid helpers failed. Exiting...');
      throw new Error(HYDRATING_ACTIVE_RAIDS_ERROR);
    }
  }


  if (!latestRhEvents.length) {
    console.log("No raid helpers found");
    return;
  }

  // Refresh raid helpers in memory
  ACTIVE_RAID_HELPERS.length = 0;
  latestRhEvents.forEach((rhEvent) => {
    if (!isRaidHelperExpired(rhEvent)) {
      ACTIVE_RAID_HELPERS.push(rhEvent);
    }
  });
}

const postAzerothNews = async (client: Client) => {
  if (!process.env.AZEROTH_NEWS_CHANNEL_ID || !process.env.PERPLEXITY_API_KEY) {
    return;
  }


  try {
    const newsChannel = await getDiscordChannel(client, process.env.AZEROTH_NEWS_CHANNEL_ID);
    const newFromAi = await generateAzerothNews();

    if (!newsChannel || !newsChannel.isSendable()) {
      console.error("Azeroth news channel not found or not sendable");
      return;
    }

    await newsChannel.send(newFromAi.news);

    if (newFromAi.newsSources.length) {
      await newsChannel.send(newFromAi.newsSources);
    }

  } catch (error) {
    console.error("Error while posting discord news channel:", error);
    return;
  }
}

