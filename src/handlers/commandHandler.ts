import type { Client, ChatInputCommandInteraction } from 'discord.js';
import type { BotCommand } from '../types/command.js';
import { roastCommand } from '../commands/roast.js';
import { duoCommand } from '../commands/duo.js';
import { groupCommand } from '../commands/group.js';

const commands = [roastCommand, duoCommand, groupCommand];
const commandMap = new Map(commands.map((command) => [command.data.name, command]));

export function getCommands(): BotCommand[] {
  return commands;
}

export function registerCommandHandler(client: Client): void {
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    await executeCommand(interaction);
  });
}

async function executeCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const command = commandMap.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`[Bait Bot] Command /${interaction.commandName} failed:`, error);
    const message = '💥 Bait Bot tripped over its own punchline. Try again in a moment.';
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: message, ephemeral: true }).catch(() => undefined);
    } else {
      await interaction.reply({ content: message, ephemeral: true }).catch(() => undefined);
    }
  }
}
