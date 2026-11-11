import { Events, type Client } from 'discord.js';

export function registerReadyEvent(client: Client): void {
  client.once(Events.ClientReady, (readyClient) => {
    console.log(`🤖 Bait Bot is online as ${readyClient.user.tag}`);
    console.log(`🎭 Serving ${readyClient.guilds.cache.size} server(s).`);
  });
}
