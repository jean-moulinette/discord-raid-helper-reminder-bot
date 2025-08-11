import type { Client } from 'discord.js';
import { fetchRaidHelperPostedEvents } from '../helpers/raid-helper';
import {
  getNextRaidInTwoDays,
  getNextTwoMainRaids,
  isRaidHelperExpired,
  pingOfficersWithBotFailure,
  recreateNextWeekRaidHelper,
  recreateRaidHelperChannelThread,
  removeFirstExpiredRaidHelper,
  tagMissingSignees,
} from '../helpers/raids';
import {
  OFFICERS_ERROR_MESSAGE_RAID_HELPER_DOWN_RAID_OF_WEEK,
  HYDRATING_ACTIVE_RAIDS_ERROR,
  OFFICERS_ERROR_MESSAGE_RAID_HELPER_DOWN_RAID_IN_TWO_DAYS,
} from './consts';
import { getDiscordChannel } from '../helpers/discord';
import { generateAzerothNews } from '../helpers/ai';
import type { PostedRaidHelperEvent } from '../helpers/raid-helper.types';

const ACTIVE_RAID_HELPERS: PostedRaidHelperEvent[] = [];

export async function logPoliceForMainRaidsOfTheWeek(client: Client) {
  try {
    await hydrateActiveRaidHelpers();
  } catch (error) {
    console.error('Error in logPoliceForMainRaidsOfTheWeek:', error);

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
      console.log('No main raids found for the week. Exiting...');
      return;
    }

    nextTwoMainRaids.forEach(async (raid) => {
      await tagMissingSignees(client, raid);
    });
  } catch (e) {
    if (e instanceof Error) {
      console.error('Error in logPoliceForMainRaidsOfTheWeek:', e.message);
    }
    await pingOfficersWithBotFailure(
      client,
      "Vérification des membres inscrits pour les raids principaux de la semaine et notification dans le fil RH des membres ayant oublié de s'inscrire",
    );
  }
}

export async function logPoliceWatchForRaidInTwoDays(client: Client) {
  // Update bot memory with active raid helpers
  try {
    await hydrateActiveRaidHelpers();
  } catch (error) {
    console.error('Error in logPoliceWatchForRaidInTwoDays:', error);

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
      console.log('No raid found in 2 days. Exiting...');
      return;
    }

    // Tag missing signees in raid helper channel and send report to officers
    await tagMissingSignees(client, nextRaid);
  } catch (e) {
    if (e instanceof Error) {
      console.error('Error in logPoliceWatch:', e.message);
    }
    await pingOfficersWithBotFailure(
      client,
      "Vérification des membres inscrits pour le prochain raid et notification dans le fil RH des membres ayant oublié de s'inscrire",
    );
  }
}

export async function cleanUpRaidHelpersChannel(client: Client) {
  try {
    const result = await removeFirstExpiredRaidHelper(client);

    if (!result || !result.channelIdToRecreateRh || !result.removedEventStartTime) {
      console.log('No raid helpers found to recreate');
      return;
    }

    const { channelIdToRecreateRh, removedEventStartTime, raidHelperTitleToRecreate } = result;

    const nextRaidDate = await recreateNextWeekRaidHelper(
      channelIdToRecreateRh,
      removedEventStartTime,
      raidHelperTitleToRecreate,
    );

    await recreateRaidHelperChannelThread(client, channelIdToRecreateRh, nextRaidDate);

    console.log('Raid helpers cleanup complete');
  } catch (e) {
    if (e instanceof Error) {
      console.error('Error in cleanUpRaidHelpersChannel:', e.message);
    }

    await pingOfficersWithBotFailure(
      client,
      'Suppression du dernier raid helper expiré et création de celui de la semaine prochaine.',
    );
  }
}

async function hydrateActiveRaidHelpers() {
  let latestRhEvents: PostedRaidHelperEvent[] = [];
  try {
    latestRhEvents = await fetchRaidHelperPostedEvents();
  } catch (e) {
    console.error('Fetching all posted events from Raid-Helper failed. Exiting...');
    throw new Error(HYDRATING_ACTIVE_RAIDS_ERROR);
  }

  if (!latestRhEvents.length) {
    console.log('No raid helpers found');
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

export async function postAzerothNews(client: Client) {
  if (!process.env.AZEROTH_NEWS_CHANNEL_ID || !process.env.PERPLEXITY_API_KEY) {
    return;
  }

  try {
    const newsChannel = await getDiscordChannel(client, process.env.AZEROTH_NEWS_CHANNEL_ID);
    const newFromAi = await generateAzerothNews();

    if (!newsChannel || !newsChannel.isSendable()) {
      console.error('Azeroth news channel not found or not sendable');
      return;
    }

    await newsChannel.send(newFromAi.news);

    if (newFromAi.newsSources.length) {
      await newsChannel.send(newFromAi.newsSources);
    }
  } catch (error) {
    console.error('Error while posting discord news channel:', error);
    return;
  }
}
