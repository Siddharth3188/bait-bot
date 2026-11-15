import { Events, type Client } from 'discord.js';
import { getActiveRecording, hasRecordingConsent } from '../services/recordingService.js';

export function registerVoiceRecordingNotice(client: Client): void {
  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    if (!newState.guild || !newState.channelId || oldState.channelId === newState.channelId) return;
    if (newState.member?.user.bot) return;

    const session = getActiveRecording(newState.guild.id);
    if (!session || session.voiceChannelId !== newState.channelId) return;
    if (hasRecordingConsent(newState.guild.id, newState.id)) return;

    const textChannel = newState.guild.channels.cache.get(session.textChannelId);
    if (!textChannel?.isTextBased() || !('send' in textChannel)) return;

    await textChannel.send({
      content: `ℹ️ <@${newState.id}> joined the voice channel while a recording session is active. Bait Bot will **not** record them unless they explicitly opt in with **/record consent enabled:true**.`,
      allowedMentions: { users: [] },
    }).catch((error: unknown) => {
      console.warn('[Bait Bot] Could not post the voice recording join notice:', error);
    });
  });
}
