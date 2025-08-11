import { ChannelType, InteractionContextType, SlashCommandBuilder } from 'discord.js';

export const COMMANDS_IDENTIFIERS = {
  RH_DELETE_HERE: 'rh-delete-here',
  TAG_MISSING_SIGNEES: 'tag-missing-people',
};

const RH_DELETE_HERE_COMMAND = new SlashCommandBuilder()
  .setName(COMMANDS_IDENTIFIERS.RH_DELETE_HERE)
  .setDescription('Supprime le ou les Raid-Helper de ce channel discord')
  .setContexts(InteractionContextType.Guild);

const TAG_MISSING_SIGNEES_COMMAND = new SlashCommandBuilder()
  .setName(COMMANDS_IDENTIFIERS.TAG_MISSING_SIGNEES)
  .setDescription(
    "Tag dans le thread du Raid-Helper, les membres qui n'ont pas notifié leur présence",
  )
  .setContexts(InteractionContextType.Guild);

export const COMMANDS = [RH_DELETE_HERE_COMMAND, TAG_MISSING_SIGNEES_COMMAND];
export const ALLOWED_CHANNEL_TYPES_FOR_COMMANDS = [
  ChannelType.GuildText,
  ChannelType.PublicThread,
  ChannelType.PrivateThread,
];
