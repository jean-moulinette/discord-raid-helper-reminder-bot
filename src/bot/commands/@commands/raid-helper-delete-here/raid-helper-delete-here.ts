import {
  ActionRowBuilder,
  CacheType,
  ChatInputCommandInteraction,
  ComponentType,
  Interaction,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import {
  fetchRaidHelperPostedEvents,
  deleteRaidHelperEvent,
} from '../../../../helpers/raid-helper';

async function raidHelperDeleteHere(interaction: ChatInputCommandInteraction<CacheType>) {
  const { channel } = interaction;

  if (!channel) {
    await interaction.editReply("Impossible d'identifier le salon.");
    return;
  }

  // Find the RH event in this channel
  const events = await fetchRaidHelperPostedEvents();
  const inThisChannel = events
    .filter((e) => e.channelId === channel.id)
    .sort((a, b) => b.startTime - a.startTime);

  if (!inThisChannel.length) {
    await interaction.editReply('Aucun Raid-Helper actif trouvé pour ce salon.');
    return;
  }

  // If multiple events, ask the user to select the one to delete
  if (inThisChannel.length > 1) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('rh-delete-here-select')
      .setPlaceholder('Sélectionnez le Raid-Helper à supprimer')
      .addOptions(
        inThisChannel.map((e) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(e.title)
            .setDescription(`Date: ${new Date(e.startTime * 1000).toLocaleString('fr-FR')}`)
            .setValue(e.id),
        ),
      );
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
    const userSelectionMenu = await interaction.editReply({
      content:
        'Plusieurs Raid-Helper actifs trouvés pour ce salon. Veuillez sélectionner le Raid-Helper à supprimer.',
      components: [row],
    });

    try {
      const selectInteraction = await userSelectionMenu.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        time: 30_000,
        filter: (i) => i.user.id === interaction.user.id && i.customId === 'rh-delete-here-select',
      });

      const selectedEventId = selectInteraction.values[0];
      await selectInteraction.deferUpdate();
      const selectedEvent = inThisChannel.find((e) => e.id === selectedEventId);
      if (!selectedEvent) {
        await interaction.editReply({
          content: 'Événement non trouvé. Réessayez la commande.',
          components: [],
        });
        return;
      }

      try {
        await deleteRaidHelperEvent(selectedEvent.id);
        await interaction.editReply({
          content: `Raid-Helper supprimé pour ce salon: "${selectedEvent.title}" (début: ${new Date(
            selectedEvent.startTime * 1000,
          ).toLocaleString('fr-FR')}).`,
          components: [],
        });
      } catch (e) {
        if (e instanceof Error) {
          await interaction.editReply({
            content: `Suppression via Raid-Helper impossible: ${e.message}. Essayez plus tard.`,
            components: [],
          });
        }
        return;
      }
    } catch {
      await interaction.editReply({
        content: 'Sélection expirée. Réessayez la commande.',
        components: [],
      });
    }

    return;
  }

  const eventToDelete = inThisChannel[0];

  try {
    await deleteRaidHelperEvent(eventToDelete.id);
  } catch (e) {
    if (e instanceof Error) {
      await interaction.editReply(
        `Suppression via Raid-Helper impossible: ${e.message}. Essayez plus tard.`,
      );
      return;
    }
    await interaction.editReply('Suppression via Raid-Helper impossible.');
    return;
  }

  // Best-effort: remove the discord message if still present
  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    const rhMessage = messages.get(eventToDelete.id);
    if (rhMessage && rhMessage.deletable) {
      await rhMessage.delete();
    }
  } catch {}

  await interaction.editReply(
    `Raid-Helper supprimé pour ce salon: "${eventToDelete.title}" (début: ${new Date(
      eventToDelete.startTime * 1000,
    ).toLocaleString('fr-FR')}).`,
  );
}

export default raidHelperDeleteHere;
