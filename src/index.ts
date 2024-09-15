import dotenv from 'dotenv'
import cron from 'node-cron';
import { Client, GatewayIntentBits, Partials } from 'discord.js'
import { getNextRaidInTwoDays, recreateNextWeekRaidHelper, recreateRaidHelperChannelThread, removeFirstExpiredRaidHelper, tagMissingSignees } from './helpers/raids';
import { CRON_SCHEDULE_EVERY_DAYS_AT_6PM, CROM_SCHEDULE_EVERY_DAYS_AT_MIDNIGHT } from './consts'
import { fetchRaidHelperPostedEvents, PostedRaidHelperEvent } from './helpers/raid-helper';

dotenv.config()

const ACTIVE_RAID_HELPERS: PostedRaidHelperEvent[] = [];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User
  ],
});

client.once('ready', () => {
  if (!client.user) {
    throw Error('No client user');
  }

  console.log(`Logged in as ${client.user.tag}!`);

  // Schedule job to notify about missing signees in raid helper
  cron.schedule(CRON_SCHEDULE_EVERY_DAYS_AT_6PM, () => {
    console.log('Running log police watch job');
    logPoliceWatch();
  });

  // Schedule job to clean up raid helpers channel
  cron.schedule(CROM_SCHEDULE_EVERY_DAYS_AT_MIDNIGHT, () => {
    console.log('Running raid-helper cleanup job');
    cleanUpRaidHelpersChannel();
  });

  cleanUpRaidHelpersChannel();
});

client.login(process.env.DISCORD_TOKEN);

async function logPoliceWatch() {
  try {
    // Update bot memory with active raid helpers
    await hydrateActiveRaidHelpers();


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
  }
}

async function cleanUpRaidHelpersChannel() {
  try {
    const result = await removeFirstExpiredRaidHelper();
  
    if (!result || !result.channelIdToRecreateRh || !result.removedEventStartTime) {
      console.log('No raid helpers found to recreate');
      return;
    }
  
    const { channelIdToRecreateRh, removedEventStartTime } = result;
  
    const nextRaidDate = await recreateNextWeekRaidHelper(channelIdToRecreateRh, removedEventStartTime);
  
    await recreateRaidHelperChannelThread(client, channelIdToRecreateRh, nextRaidDate);
  
    console.log('Raid helpers cleanup complete');
  } catch (e) {
    if (e instanceof Error) {
      console.error('Error in cleanUpRaidHelpersChannel:', e.message);
    }
  }
}

async function hydrateActiveRaidHelpers() {
  let latestRhEvents: PostedRaidHelperEvent[] = [];
  try {
    latestRhEvents = await fetchRaidHelperPostedEvents();
  } catch (e) {
      throw Error('Error while hydrating active raid helpers from Raid-Helper:');
  }

  if (!latestRhEvents.length) {
    console.log('No raid helpers found');
    return;
  }

  // Remove inactive raid helpers from memory
  ACTIVE_RAID_HELPERS.forEach(rhEvent => {
    const isEventActive = latestRhEvents.find(event => event.id === rhEvent.id);
    if (!isEventActive) {
      ACTIVE_RAID_HELPERS.splice(ACTIVE_RAID_HELPERS.indexOf(rhEvent), 1);
    }
  });

  // Add new active raid helpers to memory
  latestRhEvents.forEach(rhEvent => {
    if (!ACTIVE_RAID_HELPERS.find(event => event.id === rhEvent.id)) {
      ACTIVE_RAID_HELPERS.push(rhEvent);
    }
  });
}
