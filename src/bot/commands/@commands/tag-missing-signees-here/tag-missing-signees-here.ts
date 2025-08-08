import type { CacheType, ChatInputCommandInteraction, Client } from 'discord.js';
import { fetchRaidHelperPostedEvents } from '../../../../helpers/raid-helper';
import { tagMissingSignees } from '../../../../helpers/raids';

async function tagMissingSigneesHere(
  interaction: ChatInputCommandInteraction<CacheType>,
  client: Client,
) {
  const { channel } = interaction;

  if (!channel) {
    await interaction.editReply("Impossible d'identifier le salon.");
    return;
  }

  // Find the RH event in this channel
  const events = await fetchRaidHelperPostedEvents();
  const raidEventsInThisChannel = events
    .filter((e) => e.channelId === channel.id)
    .sort((a, b) => b.startTime - a.startTime);

  if (raidEventsInThisChannel.length === 0) {
    await interaction.editReply('Aucun Raid-Helper actif trouvé pour ce salon.');
    return;
  }

  if (raidEventsInThisChannel.length > 1) {
    await interaction.editReply(
      'Plusieurs Raid-Helper actifs trouvés pour ce salon. Impossible de déterminer lequel est actif.',
    );
    return;
  }

  const raidEvent = raidEventsInThisChannel[0];

  try {
    await tagMissingSignees(client, raidEvent);

    await interaction.editReply(
      'Notification des membres ayant oublié de notifier leur présence au Raid-Helper effectuée.',
    );
  } catch (e) {
    if (e instanceof Error) {
      await interaction.editReply(
        `Erreur lors de la notification des membres ayant oublié de notifier leur présence au Raid-Helper: ${e.message}. Veuillez réessayer plus tard.`,
      );
    } else {
      await interaction.editReply('Une erreur inattendue est survenue.');
    }
  }
}

export default tagMissingSigneesHere;
