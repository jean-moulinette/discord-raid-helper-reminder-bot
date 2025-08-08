import { type Client } from 'discord.js';
import { fetchRaidHelperPostedEvents } from './raid-helper';
import { getGuild } from './discord';

export async function testServicesConnection(client: Client) {
  try {
    await fetchRaidHelperPostedEvents();
  } catch (e) {
    console.error('Error when testing raid helper API connection:');
    console.error(
      'Make sure you passed a valid API key in the .env file for RAID_HELPER_API_KEY or a valid ID in GUILD_ID',
    );
    console.error(e);
    throw e;
  }

  try {
    await getGuild(client);
  } catch (e) {
    console.error('Error when testing discord API connection:');
    console.error(e);
    throw e;
  }

  return true;
}
