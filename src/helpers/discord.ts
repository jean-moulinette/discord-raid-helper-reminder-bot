import { Client } from "discord.js";

export async function getGuild(client: Client) {
  try {
    const guild = client.guilds.fetch(process.env.GUILD_ID as string);
  
    if (!guild) {
      throw Error('Cannot fetch your discord server, verify your GUILD_ID');
    }
  
    return guild;
  } catch (e) {
    if (e instanceof Error) {
      throw Error(`Error fetching guild ${e.message}`);
    }
    throw Error('Error fetching guild');
  }
}

export async function getAllRaidersMembers(client: Client) {
  try {
    const guild = await getGuild(client);
    await guild.members.fetch();
  
    const guildRaiderRole = guild.roles.cache.find(({ name }) => name === process.env.RAIDER_ROLE_NAME as string);
  
    if (!guildRaiderRole) {
      throw Error('Raider role not found in server, make sure the role you configured for the bot, is matching with the raider role text you got in your discord server');
    }
  
    const raiderMembers = guildRaiderRole.members.filter(member => !member.user.bot);
  
    return raiderMembers;
  } catch (e) {
    if (e instanceof Error) {
      throw Error(`Error fetching raiders members ${e.message}`);
    }
    throw Error('Error fetching raiders members');
  }
}

export async function getAllOfficersMembers(client: Client) {
  try {
    const guild = await getGuild(client);
    await guild.members.fetch();
  
    const officersRole = guild.roles.cache.find(({ name }) => name === process.env.OFFICER_ROLE_NAME as string);
  
    if (!officersRole) {
      throw Error('Officer role not found in server, make sure the role you configured for the bot, is matching with the officer role text you got in your discord server');
    }
  
    const officersMembers = officersRole.members.filter(member => !member.user.bot);
  
    return officersMembers;
  } catch (e) {
    if (e instanceof Error) {
      throw Error(`Error fetching officers members ${e.message}`);
    }
    throw Error('Error fetching officers members');
  }
}

export async function getRaidHelpersChannels(client: Client) {
  try {
    const guild = await getGuild(client);
  
    const channels = await guild.channels.fetch();
    const raidChannels = channels?.filter(
      channel => channel?.parentId === process.env.RAID_CATEGORY_ID as string
    );
  
    if (!raidChannels.size) {
      throw Error('Could not find any channel for the raid category ID you configured');
    }
  
    return raidChannels;
  } catch (e) {
    if (e instanceof Error) {
      throw Error(`Error fetching raid channels ${e.message}`);
    }
    throw Error('Error fetching raid channels');
  }
}

export async function getDiscordChannel(client: Client, channelId: string) {
  try {
    const guild = await getGuild(client);
    const channel = await client.channels.cache.get(channelId);
  
    return channel;
  } catch (e) {
    if (e instanceof Error) {
      throw Error(`Error fetching channel ${e.message}`);
    }
    throw Error('Error fetching channel');
  }
}
