import { channelMention, Client, roleMention, userMention } from "discord.js";
import {
  getAllOfficersMembers,
  getAllRaidersMembers,
  getDiscordChannel,
  getDiscordRoleByName,
} from "./discord";
import {
  createRaidHelperEvent,
  deleteRaidHelperEvent,
  fetchRaidHelperEventSignUps,
  fetchRaidHelperPostedEvents,
  type PostedRaidHelperEvent,
} from "./raid-helper";

export function getNextRaidInTwoDays(listOfRaids: PostedRaidHelperEvent[]) {
  return listOfRaids.find((rhEvent) => {
    const raidDate = new Date(rhEvent.startTime * 1000);
    const today = new Date();

    // Calculate the start of the window 2 days from now (00:00 of that day)
    const startOfTwoDaysFromNow = new Date(today);
    startOfTwoDaysFromNow.setDate(today.getDate() + 2);
    startOfTwoDaysFromNow.setHours(0, 0, 0, 0);

    // Calculate the end of the window 2 days from now (23:59:59 of that day)
    const endOfTwoDaysFromNow = new Date(today);
    endOfTwoDaysFromNow.setDate(today.getDate() + 2);
    endOfTwoDaysFromNow.setHours(23, 59, 59, 999);

    // Check if the raid date falls within the "2 days from now" window
    return raidDate >= startOfTwoDaysFromNow && raidDate <= endOfTwoDaysFromNow;
  });
}

export async function tagMissingSignees(
  client: Client,
  nextRaid: PostedRaidHelperEvent
) {
  try {
    const guildRaiders = await getAllRaidersMembers(client);
    const guildOfficers = await getAllOfficersMembers(client);
    const rhEventDiscordChannel = await getDiscordChannel(
      client,
      nextRaid.channelId
    );

    // Check if raid helper channel is sendable
    if (!rhEventDiscordChannel || !rhEventDiscordChannel.isSendable()) {
      throw Error("Could not find raid helper channel or send message to it");
    }

    const rhSignUps = await fetchRaidHelperEventSignUps(nextRaid.id);

    const nonSignees = guildRaiders.filter(
      (raider) => !rhSignUps.find((signee) => signee.userId === raider.id)
    );
    const nextRaidfrenchHumanReadableDate = new Date(
      nextRaid.startTime * 1000
    ).toLocaleDateString("fr-FR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    if (!nonSignees.size) {
      for (const [, officer] of guildOfficers) {
        await officer.send(
          `Bonjour,\n\nla police des logs vient de détecter que tous les raiders sont inscrits sur le raid:\n${channelMention(
            nextRaid.channelId
          )}\n**Prévu pour le ${nextRaidfrenchHumanReadableDate}**.\n\nMerci de bien vouloir vérifier que la composition est postée :)`
        );
      }
      return;
    }

    const nonSigneesMentions = nonSignees
      .map((raider) => `- ${userMention(raider.id)}`)
      .join("\n");

    for (const [, officer] of guildOfficers) {
      await officer.send(
        `Bonjour,\n\nla police des logs vient de détecter que les raiders suivants ne sont pas inscrits sur le raid:\n${channelMention(
          nextRaid.channelId
        )}\n**Prévu pour le ${nextRaidfrenchHumanReadableDate}**:\n\n${nonSigneesMentions}\n\nMerci de bien vouloir vérifier que la composition est postée :)`
      );
    }

    await rhEventDiscordChannel.send(
      `Bonjour les raideurs !\nLa police des logs vient de détecter que les raiders suivants ne sont pas inscrits sur le raid:\n${nonSigneesMentions}\nMerci de bien vouloir nous donner votre dispo sur le raid-helper pour faciliter l'organisation du raid :)`
    );
  } catch (e) {
    if (e instanceof Error) {
      throw Error(`Error while tagging missing signees: ${e.message}`);
    }
    throw Error("Error while tagging missing signees");
  }
}

export async function removeFirstExpiredRaidHelper() {
  try {
    const latestRhEvents = await fetchRaidHelperPostedEvents();
    let channelIdToRecreateRh = null;
    let removedEventStartTime = null;

    if (!latestRhEvents.length) {
      console.log("No raid helpers found");
      return;
    }

    // Itterate over all raid helpers and delete the one that just ended
    for (const rhEvent of latestRhEvents) {
      const { endTime, startTime, id, title, channelId } = rhEvent;
      const rhEventEndTime = new Date(endTime * 1000);
      const currentTime = new Date();

      // if rhEvent is already over, delete it
      if (rhEventEndTime < currentTime) {
        await deleteRaidHelperEvent(id);
        removedEventStartTime = startTime;
        channelIdToRecreateRh = channelId;
        const humanDate = new Date(startTime * 1000).toLocaleDateString(
          "fr-FR",
          {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          }
        );
        console.log(`Deleted raid helper event: ${title} - ${humanDate}`);
        break;
      }
    }

    return { channelIdToRecreateRh, removedEventStartTime };
  } catch (e) {
    if (e instanceof Error) {
      console.error("Error removing first expired raid helper:", e.message);
    }
    throw Error("Error removing first expired raid helper");
  }
}

export async function recreateNextWeekRaidHelper(
  channelIdToRecreateRh: string,
  removedEventStartTime: number
) {
  try {
    const removedEventStartTimeMs = removedEventStartTime * 1000;
    const removedRaidDate = new Date(removedEventStartTimeMs);

    const raidDayOfTheWeek = removedRaidDate.getDay();
    const today = new Date();

    // Calculate how many days until the **next** occurrence of the raid day
    let daysUntilNextRaidDay = (7 + raidDayOfTheWeek - today.getDay()) % 7;

    // If the raid was on Monday and today is Tuesday (after midnight), schedule for next Monday
    if (daysUntilNextRaidDay === 0) {
      daysUntilNextRaidDay = 7; // Move to the same day next week
    }

    // Create a new Date object for next week's same day
    const nextRaidDate = new Date(today);
    nextRaidDate.setDate(today.getDate() + daysUntilNextRaidDay);

    // Set the hours and minutes for the new raid date (from .env or defaults)
    nextRaidDate.setHours(
      Number(process.env.RAID_HOUR_START as string),
      Number(process.env.RAID_MINUTE_START as string),
      0,
      0
    ); // Set hours and minutes

    const nextRaidDateUnix = String(nextRaidDate.getTime() / 1000);

    await createRaidHelperEvent(channelIdToRecreateRh, nextRaidDateUnix);
    console.log(
      "Next raid created on:",
      nextRaidDate.toLocaleString("fr-FR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    );

    return nextRaidDate;
  } catch (e) {
    if (e instanceof Error) {
      throw Error(`Error recreating next week raid helper: ${e.message}`);
    }
    throw Error("Error recreating next week raid helper");
  }
}

export async function recreateRaidHelperChannelThread(
  client: Client,
  channelIdToRecreateRh: string,
  raidDate: Date
) {
  try {
    const channel = await getDiscordChannel(client, channelIdToRecreateRh);

    if (!channel) {
      throw Error("Channel not found");
    }

    if (!channel.isSendable()) {
      throw Error("Channel is not a text channel");
    }

    const channelMessages = await channel.messages.fetch();
    const raidHelperMessage = channelMessages.find(
      async (message) => message.author.id === process.env.RAID_HELPER_ID
    );

    if (!raidHelperMessage) {
      throw Error("Raid helper message not found");
    }

    const thread = await raidHelperMessage.startThread({
      name: raidDate.toLocaleString("fr-FR", {
        day: "numeric",
        year: "numeric",
        month: "numeric",
      }),
    });

    const raiderRole = await getDiscordRoleByName(
      client,
      process.env.RAIDER_ROLE_NAME as string
    );

    await thread.send(roleMention(raiderRole.id));
  } catch (e) {
    if (e instanceof Error) {
      console.error("Error recreating raid helper channel thread:", e.message);
    }
    throw Error("Error recreating raid helper channel thread");
  }
}
