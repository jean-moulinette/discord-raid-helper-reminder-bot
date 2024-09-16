import { Client, GatewayIntentBits, Partials } from "discord.js";

export function getDiscordClient() {
  return new Client({
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
      Partials.User,
    ],
  });
}

export function onDiscordClientError(error: Error) {
  console.error("Discord client error:", error);
  throw error;
}
export async function getGuild(client: Client) {
  try {
    const guild = client.guilds.fetch(process.env.GUILD_ID as string);

    if (!guild) {
      throw Error("Cannot fetch your discord server, verify your GUILD_ID");
    }

    return guild;
  } catch (e) {
    if (e instanceof Error) {
      throw Error(`Error fetching guild ${e.message}`);
    }
    throw Error("Error fetching guild");
  }
}

export async function getAllRaidersMembers(client: Client) {
  try {
    const guild = await getGuild(client);
    await guild.members.fetch();

    const guildRaiderRole = guild.roles.cache.find(
      ({ name }) => name === (process.env.RAIDER_ROLE_NAME as string)
    );

    if (!guildRaiderRole) {
      throw Error(
        "Raider role not found in server, make sure the role you configured for the bot, is matching with the raider role text you got in your discord server"
      );
    }

    const raiderMembers = guildRaiderRole.members.filter(
      (member) => !member.user.bot
    );

    return raiderMembers;
  } catch (e) {
    if (e instanceof Error) {
      throw Error(`Error fetching raiders members ${e.message}`);
    }
    throw Error("Error fetching raiders members");
  }
}

export async function getAllOfficersMembers(client: Client) {
  try {
    const guild = await getGuild(client);
    await guild.members.fetch();

    const officersRole = guild.roles.cache.find(
      ({ name }) => name === (process.env.OFFICER_ROLE_NAME as string)
    );

    if (!officersRole) {
      throw Error(
        "Officer role not found in server, make sure the role you configured for the bot, is matching with the officer role text you got in your discord server"
      );
    }

    const officersMembers = officersRole.members.filter(
      (member) => !member.user.bot
    );

    return officersMembers;
  } catch (e) {
    if (e instanceof Error) {
      throw Error(`Error fetching officers members ${e.message}`);
    }
    throw Error("Error fetching officers members");
  }
}

export async function getRaidHelpersChannels(client: Client) {
  try {
    const guild = await getGuild(client);

    const channels = await guild.channels.fetch();
    const raidChannels = channels?.filter(
      (channel) =>
        channel?.parentId === (process.env.RAID_CATEGORY_ID as string)
    );

    if (!raidChannels.size) {
      throw Error(
        "Could not find any channel for the raid category ID you configured"
      );
    }

    return raidChannels;
  } catch (e) {
    if (e instanceof Error) {
      throw Error(`Error fetching raid channels ${e.message}`);
    }
    throw Error("Error fetching raid channels");
  }
}

export async function getDiscordChannel(client: Client, channelId: string) {
  try {
    return await client.channels.cache.get(channelId);
  } catch (e) {
    if (e instanceof Error) {
      throw Error(`Error fetching channel ${e.message}`);
    }
    throw Error("Error fetching channel");
  }
}

export async function getDiscordRoleByName(client: Client, roleName: string) {
  try {
    const guild = await getGuild(client);
    const role = guild.roles.cache.find(({ name }) => name === roleName);

    if (!role) {
      throw Error(`Could not find role with name ${roleName}`);
    }

    return role;
  } catch (e) {
    if (e instanceof Error) {
      throw Error(`Error fetching role ${e.message}`);
    }
    throw Error("Error fetching role");
  }
}
