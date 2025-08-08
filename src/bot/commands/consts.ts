import { InteractionContextType, SlashCommandBuilder } from 'discord.js';

export const COMMANDS_IDENTIFIERS = {
  RH_DELETE_HERE: 'rh-delete-here',
};

const RH_DELETE_HERE_COMMAND = new SlashCommandBuilder()
  .setName(COMMANDS_IDENTIFIERS.RH_DELETE_HERE)
  .setDescription('Supprime le Raid-Helper de ce salon (officiers uniquement)')
  .setContexts(InteractionContextType.Guild);

export const COMMANDS = [RH_DELETE_HERE_COMMAND];
