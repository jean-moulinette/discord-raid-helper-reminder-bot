import {
  ChannelType,
  type CacheType,
  type ChatInputCommandInteraction,
  type Client,
} from 'discord.js';
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
  const events = await fetchRaidHelperPostedEvents(async () => {
    await interaction.editReply(
      'Les serveurs Raid-Helper mettent un peu de temps à répondre pour trouver le raid actif. Nouvelle tentative dans 1 minute, ne quittez pas.',
    );
  });
  const raidEventsInThisChannel = events
    .filter((rhEvent) => {
      if (channel.type === ChannelType.GuildText) {
        return rhEvent.channelId === channel.id;
      }
      // If command is used in a thread, we need to check the parentId
      if (channel.type === ChannelType.PublicThread || channel.type === ChannelType.PrivateThread) {
        return rhEvent.channelId === channel.parentId;
      }
      return false;
    })
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
    await tagMissingSignees({
      client,
      nextRaid: raidEvent,
      onRaidHelperHandlingRetry: async () => {
        await interaction.editReply(
          `Les serveurs Raid-Helper mettent un peu de temps à répondre pour récupérer les inscris sur le raid ${raidEvent.title}. Nouvelle tentative dans 1 minute, ne quittez pas.`,
        );
      },
    });

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
