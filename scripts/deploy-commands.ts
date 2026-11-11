import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { getCommands } from '../src/handlers/commandHandler.js';

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId) {
  throw new Error('DISCORD_TOKEN and DISCORD_CLIENT_ID are required to deploy slash commands.');
}

const rest = new REST({ version: '10' }).setToken(token);
const body = getCommands().map((command) => command.data.toJSON());

if (guildId) {
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
  console.log(`✅ Registered ${body.length} Bait Bot commands in test server ${guildId}.`);
} else {
  await rest.put(Routes.applicationCommands(clientId), { body });
  console.log(`✅ Registered ${body.length} global Bait Bot commands. Global updates can take time to appear.`);
}
