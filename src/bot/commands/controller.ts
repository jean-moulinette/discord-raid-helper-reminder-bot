import { CacheType, ChatInputCommandInteraction, Client } from 'discord.js';
import { COMMANDS_IDENTIFIERS } from './consts';
import { raidHelperDeleteHere, tagMissingSigneesHere } from './@commands';

export async function commandController(
  interaction: ChatInputCommandInteraction<CacheType>,
  client: Client,
) {
  switch (interaction.commandName) {
    case COMMANDS_IDENTIFIERS.RH_DELETE_HERE:
      await raidHelperDeleteHere(interaction);
      break;
    case COMMANDS_IDENTIFIERS.TAG_MISSING_SIGNEES:
      await tagMissingSigneesHere(interaction, client);
      break;
    default:
      await interaction.editReply('Commande non trouvée.');
      break;
  }
}
