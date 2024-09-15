import { channelMention, Client, userMention } from "discord.js";
import { getAllOfficersMembers, getAllRaidersMembers, getDiscordChannel } from "./discord";
import { fetchRaidHelperEventSignUps, type PostedRaidHelperEvent } from "./raid-helper";

export function getNextRaidInTwoDays(listOfRaids: PostedRaidHelperEvent[]) {
  return listOfRaids.find(rhEvent => {
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

export async function tagMissingSignees(client: Client, nextRaid: PostedRaidHelperEvent) {
  try {
    const guildRaiders = await getAllRaidersMembers(client);
    const guildOfficers = await getAllOfficersMembers(client);
    const rhEventDiscordChannel = await getDiscordChannel(client, nextRaid.channelId);

    // Check if raid helper channel is sendable
    if (!rhEventDiscordChannel || !rhEventDiscordChannel.isSendable()) {
      throw Error('Could not find raid helper channel or send message to it');
    }

    const rhSignUps = await fetchRaidHelperEventSignUps(nextRaid.id);

    const nonSignees = guildRaiders.filter(raider => !rhSignUps.find(signee => signee.userId === raider.id));
    const nextRaidfrenchHumanReadableDate = new Date(nextRaid.startTime * 1000).toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    if (!nonSignees.size) {
      for (const [, officer] of guildOfficers) {
        await officer.send(`Bonjour,\n\nla police des logs vient de détecter que tous les raiders sont inscrits sur le raid:\n${channelMention(nextRaid.channelId)}\n**Prévu pour le ${nextRaidfrenchHumanReadableDate}**.\n\nMerci de bien vouloir vérifier que la composition est postée :)`);
      };
      return;
    }

    const nonSigneesMentions = nonSignees.map(raider => `- ${userMention(raider.id)}`).join('\n');

    for (const [,officer] of guildOfficers) {
      await officer.send(`Bonjour,\n\nla police des logs vient de détecter que les raiders suivants ne sont pas inscrits sur le raid:\n${channelMention(nextRaid.channelId)}\n**Prévu pour le ${nextRaidfrenchHumanReadableDate}**:\n\n${nonSigneesMentions}\n\nMerci de bien vouloir vérifier que la composition est postée :)`);
    }


    await rhEventDiscordChannel.send(`Bonjour les raideurs !\nLa police des logs vient de détecter que les raiders suivants ne sont pas inscrits sur le raid:\n${nonSigneesMentions}\nMerci de bien vouloir nous donner votre dispo sur le raid-helper pour faciliter l'organisation du raid :)`);
  } catch (e) {
    if (e instanceof Error) {
      throw Error(`Error while tagging missing signees: ${e.message}`);
    }
    throw Error('Error while tagging missing signees');
  }
}