import cron from 'node-cron';
import type { Client } from 'discord.js';
import {
  CRON_SCHEDULE_EVERY_DAYS_AT_6PM,
  CRON_SCHEDULE_EVERY_DAYS_AT_MIDNIGHT,
  CRON_SCHEDULE_EVERY_DAYS_AT_NOON,
  CRON_SCHEDULE_EVERYTUESDAY_AT_6PM_AND_1_MINUTE,
} from './consts';
import {
  cleanUpRaidHelpersChannel,
  logPoliceForMainRaidsOfTheWeek,
  logPoliceWatchForRaidInTwoDays,
  postAzerothNews,
} from './tasks';
export function startBot(client: Client) {
  if (!client.user) {
    throw Error('No client user');
  }

  console.log(`Bot successfully logged in as "${client.user.displayName}"!`);

  // Schedule job to notify about missing signees in raid helper for next raid occurins in 2 days
  cron.schedule(CRON_SCHEDULE_EVERY_DAYS_AT_6PM, () => {
    console.log('Running log police watch job');
    logPoliceWatchForRaidInTwoDays(client);
  });

  // Schedule job to clean up raid helpers channel
  cron.schedule(CRON_SCHEDULE_EVERY_DAYS_AT_MIDNIGHT, () => {
    console.log('Running raid-helper cleanup job');
    cleanUpRaidHelpersChannel(client);
  });

  // Sechedule job to notify about main raids of the week
  cron.schedule(CRON_SCHEDULE_EVERYTUESDAY_AT_6PM_AND_1_MINUTE, () => {
    console.log('Running log police for main raids of the week job');
    logPoliceForMainRaidsOfTheWeek(client);
  });

  // Schedule job to generate Azeroth news
  if (process.env.AZEROTH_NEWS_CHANNEL_ID && process.env.PERPLEXITY_API_KEY) {
    cron.schedule(CRON_SCHEDULE_EVERY_DAYS_AT_NOON, () => {
      console.log('Running Azeroth news generator job');
      postAzerothNews(client);
    });
  }

  console.log('\nScheduled jobs successfully started\n');
  console.log(
    '- Missing signs ups for main raids of the week will be notified at 06:00pm every tuesday',
  );
  console.log(
    '- Missing signs ups for optional raids will be notified at 06:00pm every day starting from 2 days before the raid',
  );
  console.log('- Raid helpers cleanup will be done at 00:05am every day');
}
