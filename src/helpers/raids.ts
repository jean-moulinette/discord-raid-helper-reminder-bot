import { channelMention, ChannelType, Client, roleMention, userMention } from 'discord.js';
import {
  getAllAbsentPlayers,
  getAllOfficersMembers,
  getAllRaidersMembers,
  getDiscordChannel,
  getDiscordRoleByName,
  getRaidLeaderUser,
} from './discord';
import {
  createRaidHelperEvent,
  deleteRaidHelperEvent,
  fetchRaidHelperEventSignUps,
  fetchRaidHelperPostedEvents,
  type PostedRaidHelperEvent,
} from './raid-helper';

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

/**
 * Get the next two main raids from the list of raids
 * @param listOfRaids - The list of raids to get the next two main raids from
 * @returns The next two main raids which are on monday or thursday
 */
export function getNextTwoMainRaids(listOfRaids: PostedRaidHelperEvent[]) {
  const twoNextRaids = listOfRaids
    .filter((rhEvent) => {
      const raidDayOfTheWeek = new Date(rhEvent.startTime * 1000).getDay();
      const isRaidExpired = isRaidHelperExpired(rhEvent);
      const isMainRaid = raidDayOfTheWeek === 1 || raidDayOfTheWeek === 4;

      return isMainRaid && !isRaidExpired;
    })
    .sort((a, b) => a.startTime - b.startTime)
    .slice(0, 2);

  return twoNextRaids;
}

export async function tagMissingSignees(client: Client, nextRaid: PostedRaidHelperEvent) {
  try {
    const guildRaiders = await getAllRaidersMembers(client, true);
    const guildOfficers = await getAllOfficersMembers(client, true);
    const absentPlayers = await getAllAbsentPlayers(client);
    const rhEventDiscordChannel = await getDiscordChannel(client, nextRaid.channelId);

    // Check if raid helper channel is sendable
    if (!rhEventDiscordChannel || !rhEventDiscordChannel.isSendable()) {
      throw Error('Could not find raid helper channel or send message to it');
    }

    const rhEventDiscordMessage = await rhEventDiscordChannel.messages.fetch(nextRaid.id);
    const rhSignUps = await fetchRaidHelperEventSignUps(nextRaid.id);
    const rhDiscordThread = rhEventDiscordMessage.thread;

    if (!rhDiscordThread || !rhDiscordThread.isSendable()) {
      throw Error('Could not find raid helper thread or send message to it');
    }

    const nonSignees = guildRaiders.filter(
      (raider) => !rhSignUps.find((signee) => signee.userId === raider.id),
    );
    const nextRaidfrenchHumanReadableDate = new Date(nextRaid.startTime * 1000).toLocaleDateString(
      'fr-FR',
      {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      },
    );

    const absentPlayersMentions =
      absentPlayers.size &&
      absentPlayers.map((absentPlayer) => `- ${userMention(absentPlayer.id)}`).join('\n');
    const absentPlayersReport =
      absentPlayersMentions &&
      `Les joueurs suivants ont signalé leurs absence:\n\n${absentPlayersMentions}\n\nPensez à retirer leur rôle "Absent" si ils ne le sont plus.`;

    if (!nonSignees.size) {
      for (const [, officer] of guildOfficers) {
        await officer.send(
          `Bonjour,\n\nla police des logs vient de détecter que tous les raiders sont inscrits sur le raid:\n${channelMention(
            nextRaid.channelId,
          )}\n**Prévu pour le ${nextRaidfrenchHumanReadableDate}**.\n\nMerci de bien vouloir vérifier que la composition est postée :)`,
        );
        if (absentPlayersReport) {
          await officer.send(absentPlayersReport);
        }
      }
      return;
    }

    const nonSigneesMentions = nonSignees.map((raider) => `- ${userMention(raider.id)}`).join('\n');

    for (const [, officer] of guildOfficers) {
      await officer.send(
        `Bonjour,\n\nla police des logs vient de détecter que les raiders suivants ne sont pas inscrits sur le raid:\n${channelMention(
          nextRaid.channelId,
        )}\n**Prévu pour le ${nextRaidfrenchHumanReadableDate}**:\n\n${nonSigneesMentions}\n\nMerci de bien vouloir vérifier que la composition est postée :)`,
      );

      if (absentPlayersReport) {
        await officer.send(absentPlayersReport);
      }
    }

    await rhDiscordThread.send(
      `Bonjour les raideurs !\nLa police des logs vient de détecter que les raiders suivants ne sont pas inscrits sur le raid:\n${nonSigneesMentions}\nMerci de bien vouloir nous donner votre dispo sur le raid-helper pour faciliter l'organisation du raid :)`,
    );
  } catch (e) {
    if (e instanceof Error) {
      throw Error(`Error while tagging missing signees: ${e.message}`);
    }
    throw Error('Error while tagging missing signees');
  }
}

export async function removeFirstExpiredRaidHelper(client: Client) {
  try {
    const latestRhEvents = await fetchRaidHelperPostedEvents();
    let channelIdToRecreateRh = null;
    let removedEventStartTime = null;
    let raidHelperTitleToRecreate = undefined;

    if (!latestRhEvents.length) {
      console.log('No raid helpers found');
      return;
    }

    // Itterate over all raid helpers and delete the one that just ended
    for (const rhEvent of latestRhEvents) {
      const { startTime, id, title, channelId } = rhEvent;
      let discordChannel = null;

      try {
        discordChannel = await getDiscordChannel(client, channelId);
      } catch (e) {
        if (e instanceof Error) {
          console.error(
            `Error fetching discord channel for raid helper event: ${title}`,
            e.message,
          );

          if (e.message === 'Error fetching channel Unknown Channel') {
            console.log(`Deleting raid helper event because channel not found: ${title}`);
            try {
              await deleteRaidHelperEvent(id);
              await pingRaidLeaderWithMessage(
                client,
                `Le raid helper ${title} a été supprimé car le channel discord associé n'existe pas ou plus.`,
              );
            } catch (e) {
              if (e instanceof Error) {
                console.error(
                  `Error deleting raid helper event because channel not found: ${title}`,
                  e.message,
                );
              }
            }
            continue;
          }
        }
        continue;
      }

      if (!discordChannel) {
        console.error(`Raid helper discord event channel not found for event: ${title}`);
        continue;
      }
      if (
        discordChannel.type === ChannelType.GuildText &&
        discordChannel.parentId !== process.env.RAID_CATEGORY_ID
      ) {
        console.log(
          `Deleting raid helper event because channel not in raid category : ${discordChannel.name}`,
        );
        try {
          await deleteRaidHelperEvent(id);
          await pingRaidLeaderWithMessage(
            client,
            `Le raid helper ${title} a été supprimé car il n'était pas dans la catégorie raid du discord.`,
          );
        } catch (e) {
          if (e instanceof Error) {
            console.error(
              `Error deleting raid helper event because channel not in raid category: ${title}`,
              e.message,
            );
          }
        }
        continue;
      }

      // if rhEvent is already over, delete it
      if (isRaidHelperExpired(rhEvent)) {
        await deleteRaidHelperEvent(id);
        raidHelperTitleToRecreate = title;
        removedEventStartTime = startTime;
        channelIdToRecreateRh = channelId;
        const humanDate = new Date(startTime * 1000).toLocaleDateString('fr-FR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        console.log(`Deleted raid helper event: ${title} - ${humanDate}`);
        break;
      }
    }

    return { channelIdToRecreateRh, removedEventStartTime, raidHelperTitleToRecreate };
  } catch (e) {
    if (e instanceof Error) {
      console.error('Error removing first expired raid helper:', e.message);
    }
    throw Error('Error removing first expired raid helper');
  }
}

export function isRaidHelperExpired(rhEvent: PostedRaidHelperEvent) {
  const rhEventEndTime = new Date(rhEvent.endTime * 1000);
  const currentTime = new Date();
  return rhEventEndTime < currentTime;
}

export async function recreateNextWeekRaidHelper(
  channelIdToRecreateRh: string,
  removedEventStartTime: number,
  raidHelperTitleToRecreate?: string,
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
      0,
    ); // Set hours and minutes

    const nextRaidDateUnix = String(nextRaidDate.getTime() / 1000);

    await createRaidHelperEvent(channelIdToRecreateRh, nextRaidDateUnix, raidHelperTitleToRecreate);
    console.log(
      'Next raid created on:',
      nextRaidDate.toLocaleString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    );

    return nextRaidDate;
  } catch (e) {
    if (e instanceof Error) {
      throw Error(`Error recreating next week raid helper: ${e.message}`);
    }
    throw Error('Error recreating next week raid helper');
  }
}

export async function recreateRaidHelperChannelThread(
  client: Client,
  channelIdToRecreateRh: string,
  raidDate: Date,
) {
  try {
    const channel = await getDiscordChannel(client, channelIdToRecreateRh);

    if (!channel) {
      throw Error('Channel not found');
    }

    if (!channel.isSendable()) {
      throw Error('Channel is not a text channel');
    }

    const channelMessages = await channel.messages.fetch();
    const raidHelperMessage = channelMessages.find(
      async (message) => message.author.id === process.env.RAID_HELPER_ID,
    );

    if (!raidHelperMessage) {
      throw Error('Raid helper message not found');
    }

    const thread = await raidHelperMessage.startThread({
      name: raidDate.toLocaleString('fr-FR', {
        day: 'numeric',
        year: 'numeric',
        month: 'numeric',
      }),
    });

    const raiderRole = await getDiscordRoleByName(client, process.env.RAIDER_ROLE_NAME as string);

    await thread.send(roleMention(raiderRole.id));
  } catch (e) {
    if (e instanceof Error) {
      console.error('Error recreating raid helper channel thread:', e.message);
    }
    throw Error('Error recreating raid helper channel thread');
  }
}

export async function pingOfficersWithBotFailure(client: Client, failedTaskDescription: string) {
  try {
    const guildOfficers = await getAllOfficersMembers(client, true);
    for (const [, officer] of guildOfficers) {
      await officer.send(
        `Bonjour officier,\n\nJe viens de rencontrer un problème technique sur le job suivant:\n${failedTaskDescription}\n\nIl est possible que le job ce soit arrêté en plein milieu, merci de vérifier ce qu'il s'est passé sur le discord et de finir à la main.\n\nN'oubliez pas de ping Natema pour lui signaler ce problème :).`,
      );
    }
  } catch (e) {
    if (e instanceof Error) {
      console.error('Error in pingOfficersWithBotFailure:', e.message);
    }
  }
}

export async function pingOfficersWithMessage(client: Client, message: string) {
  try {
    const guildOfficers = await getAllOfficersMembers(client, true);
    for (const [, officer] of guildOfficers) {
      await officer.send(message);
    }
  } catch (e) {
    if (e instanceof Error) {
      console.error('Error in pingOfficersWithMessage:', e.message);
    }
  }
}

export async function pingRaidLeaderWithMessage(client: Client, message: string) {
  try {
    const raidLeader = await getRaidLeaderUser(client);

    await raidLeader.send(message);
  } catch (e) {
    if (e instanceof Error) {
      console.error('Error in pingRaidLeaderWithMessage:', e.message);
    }
  }
}
