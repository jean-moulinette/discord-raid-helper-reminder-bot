import dotenv from 'dotenv';
import { Client } from 'discord.js';
import { testServicesConnection } from './helpers/services-check';
import { getDiscordClient, onDiscordClientError } from './helpers/discord';
import { startBot } from './bot';

dotenv.config();

main();

async function main() {
  const client = getDiscordClient();
  client.once('ready', startBot).once('error', onDiscordClientError);
  try {
    await client.login(process.env.DISCORD_TOKEN);
  } catch (e) {
    if (e instanceof Error) {
      console.error('Error while logging in to discord client:', e.message);
    } else {
      console.error('Error while logging in to discord client:', e);
    }
    console.error(
      'Killing bot due to failed login, make sure your DISCORD_TOKEN is correct in .env file',
    );
    killBot();
  }
  await healthCheck(client);
}

async function healthCheck(client: Client) {
  try {
    await testServicesConnection(client);
  } catch (e) {
    console.error('Killing bot due to failed health check, check logs for more info');
    killBot();
  }
  console.log('\nAll services are up and running');
}

function killBot() {
  process.exit(1);
}
