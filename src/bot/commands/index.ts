import { type Client, ChannelType } from 'discord.js';
import { COMMANDS } from './consts';
import { memberIsOfficer } from '../../helpers/discord';
import { commandController } from './@commands/controller';

export async function registerApplicationCommands(client: Client) {
  if (!client.user) return;
  const guildId = process.env.GUILD_ID as string;
  const guild = await client.guilds.fetch(guildId);
  await guild.commands.set(COMMANDS.map((c) => c.toJSON()));
  console.log('Slash commands registered for guild:', guild.name);
}

export function attachInteractionHandlers(client: Client) {
  client.on('interactionCreate', async (interaction) => {
    try {
      const { guild, channel } = interaction;

      if (!interaction.isChatInputCommand()) return;

      if (!interaction.inGuild() || guild?.id !== process.env.GUILD_ID) {
        await interaction.reply({
          content: 'Cette commande doit être utilisée dans le serveur de la guilde.',
          ephemeral: true,
        });
        return;
      }

      if (!guild || !channel) {
        await interaction.reply({
          content: "Impossible d'identifier le serveur ou le salon.",
          ephemeral: true,
        });
        return;
      }

      // Only allow in text channels within the raid category
      if (
        channel.type !== ChannelType.GuildText ||
        channel.parentId !== process.env.RAID_CATEGORY_ID
      ) {
        await interaction.reply({
          content: 'Cette commande doit être utilisée dans un salon texte de raid.',
          ephemeral: true,
        });
        return;
      }

      // Only allow officers to use this command
      const member = await guild.members.fetch(interaction.user.id);
      if (!memberIsOfficer(member)) {
        await interaction.reply({
          content: 'Seuls les officiers peuvent utiliser cette commande.',
          ephemeral: true,
        });
        return;
      }

      // Defer the reply to instruct let the user know the command is being processed
      await interaction.deferReply({ ephemeral: true });

      // Register the command controller to handle the commands
      commandController(interaction);
    } catch (error) {
      try {
        if (interaction.isRepliable()) {
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply(
              "Une erreur est survenue lors de l'exécution de la commande.",
            );
          } else {
            await interaction.reply({
              content: "Une erreur est survenue lors de l'exécution de la commande.",
              ephemeral: true,
            });
          }
        }
      } catch {}
      console.error('Command handler error:', error);
    }
  });
}
