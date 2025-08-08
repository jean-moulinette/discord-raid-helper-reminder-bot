import { CacheType, ChatInputCommandInteraction } from 'discord.js';
import { COMMANDS_IDENTIFIERS } from '../consts';
import raidHelperDeleteHere from './raid-helper-delete-here';

export async function commandController(interaction: ChatInputCommandInteraction<CacheType>) {
  switch (interaction.commandName) {
    case COMMANDS_IDENTIFIERS.RH_DELETE_HERE:
      await raidHelperDeleteHere(interaction);
      break;
    default:
      await interaction.editReply('Commande non trouvée.');
      break;
  }
}
