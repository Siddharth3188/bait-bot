import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { registerCommandHandler } from './handlers/commandHandler.js';
import { registerReadyEvent } from './events/ready.js';
import { registerVoiceRecordingNotice } from './events/voiceRecordingNotice.js';

const token = process.env.DISCORD_TOKEN;
if (!token) {
  throw new Error('Missing DISCORD_TOKEN. Copy .env.example to .env and add your bot token.');
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});
registerReadyEvent(client);
registerCommandHandler(client);
registerVoiceRecordingNotice(client);

client.login(token).catch((error: unknown) => {
  console.error('[Bait Bot] Failed to log in:', error);
  process.exitCode = 1;
});
