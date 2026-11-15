import {
  AttachmentBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import type { BotCommand } from '../types/command.js';
import {
  deleteRecording,
  getActiveRecording,
  getMissingConsents,
  getRecordingTracks,
  hasRecordingConsent,
  listRecordings,
  setRecordingConsent,
  startRecording,
  stopRecording,
} from '../services/recordingService.js';

export const recordCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('record')
    .setDescription('Consent-based voice recording controls.')
    .addSubcommand((subcommand) =>
      subcommand.setName('consent')
        .setDescription('Opt in or out of voice recording.')
        .addBooleanOption((option) =>
          option.setName('enabled').setDescription('True to opt in, false to opt out.').setRequired(true)))
    .addSubcommand((subcommand) =>
      subcommand.setName('start').setDescription('Start recording after every current speaker has opted in.'))
    .addSubcommand((subcommand) =>
      subcommand.setName('stop').setDescription('Stop the active recording session.'))
    .addSubcommand((subcommand) =>
      subcommand.setName('status').setDescription('Show the current recording status.'))
    .addSubcommand((subcommand) =>
      subcommand.setName('list').setDescription('List saved recordings on this Railway instance.'))
    .addSubcommand((subcommand) =>
      subcommand.setName('download')
        .setDescription('Download your own or an authorized speaker track from a session.')
        .addStringOption((option) => option.setName('session_id').setDescription('Session ID from /record list.').setRequired(true))
        .addUserOption((option) => option.setName('member').setDescription('Speaker whose audio track to download.').setRequired(true)))
    .addSubcommand((subcommand) =>
      subcommand.setName('delete')
        .setDescription('Delete a saved recording session.')
        .addStringOption((option) => option.setName('session_id').setDescription('Session ID from /record list.').setRequired(true))),
  async execute(interaction) {
    if (!interaction.inGuild() || !interaction.guild) {
      await interaction.reply({ content: 'Voice recording is available only inside a server.', ephemeral: true });
      return;
    }

    const guild = interaction.guild;
    const subcommand = interaction.options.getSubcommand();
    const canManage = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;

    if (subcommand === 'consent') {
      const enabled = interaction.options.getBoolean('enabled', true);
      setRecordingConsent(guild.id, interaction.user.id, enabled);
      await interaction.reply({
        content: enabled
          ? '✅ You have opted in. Bait Bot may record your voice only during a clearly announced session in this server.'
          : '🛑 You have opted out. Bait Bot will stop capturing your voice for any active session.',
        allowedMentions: { parse: [] },
      });
      return;
    }

    if (subcommand === 'start') {
      if (getActiveRecording(guild.id)) {
        await interaction.reply({ content: 'A recording is already active in this server.', ephemeral: true });
        return;
      }

      const voiceState = guild.voiceStates.cache.get(interaction.user.id);
      const voiceChannel = voiceState?.channel;
      if (!voiceChannel || !voiceChannel.isVoiceBased()) {
        await interaction.reply({ content: 'Join a voice channel first, then run /record start.', ephemeral: true });
        return;
      }

      const participants = [...voiceChannel.members.values()].map((member) => ({
        id: member.id,
        isBot: member.user.bot,
        displayName: member.displayName,
      }));
      const missing = getMissingConsents(guild.id, participants);
      if (missing.length > 0) {
        await interaction.reply({
          content: `⏸️ Recording has **not** started. These members still need to run **/record consent enabled:true**: ${missing.join(', ')}. No audio is being captured.`,
          ephemeral: false,
          allowedMentions: { parse: [] },
        });
        return;
      }

      await interaction.deferReply();
      try {
        const sessionId = await startRecording(
          guild,
          voiceChannel.id,
          interaction.channelId,
          interaction.user.id,
          participants.map(({ id, isBot }) => ({ id, isBot })),
        );
        await interaction.editReply({
          content: `🔴 **Recording is now active.** Session ID: \`${sessionId}\`

Bait Bot is recording only members who opted in. No spoken announcement is played. Anyone can opt out at any time with **/record consent enabled:false**. Audio is stored temporarily on this Railway instance.`,
          allowedMentions: { parse: [] },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown recording error.';
        await interaction.editReply(`⚠️ Recording could not start: ${message}`);
      }
      return;
    }

    if (subcommand === 'stop') {
      const active = getActiveRecording(guild.id);
      if (!active) {
        await interaction.reply({ content: 'There is no active recording in this server.', ephemeral: true });
        return;
      }
      if (active.ownerId !== interaction.user.id && !canManage) {
        await interaction.reply({ content: 'Only the person who started this session or a server manager can stop it.', ephemeral: true });
        return;
      }
      await interaction.deferReply();
      const stopped = await stopRecording(guild.id);
      await interaction.editReply(stopped
        ? `⏹️ Recording stopped. Session **${stopped.id}** saved ${stopped.files.length} audio segment(s).`
        : 'There is no active recording in this server.');
      return;
    }

    if (subcommand === 'status') {
      const active = getActiveRecording(guild.id);
      await interaction.reply({
        content: active
          ? `🔴 Recording active · Session \`${active.id}\` · Started ${new Date(active.startedAt).toLocaleString()} · ${active.participants.length} opted-in participant(s).`
          : '⚪ No recording is active in this server.',
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'list') {
      const recordings = await listRecordings(guild.id);
      if (recordings.length === 0) {
        await interaction.reply({ content: 'No saved recordings found on this Railway instance.', ephemeral: true });
        return;
      }
      const visible = recordings
        .filter((recording) => recording.ownerId === interaction.user.id || canManage)
        .slice(0, 10);
      if (visible.length === 0) {
        await interaction.reply({ content: 'You do not have permission to view saved recording sessions.', ephemeral: true });
        return;
      }
      const lines = visible.map((recording) =>
        `• \`${recording.id}\` · ${recording.status} · ${recording.files.length} audio segment(s) · ${new Date(recording.startedAt).toLocaleString()}`);
      await interaction.reply({ content: `**Saved recordings**\n${lines.join('\n')}\n\nUse /record download or /record delete with a session ID.`, ephemeral: true });
      return;
    }

    if (subcommand === 'download') {
      const sessionId = interaction.options.getString('session_id', true);
      const speaker = interaction.options.getUser('member', true);
      const recordings = await listRecordings(guild.id);
      const session = recordings.find((item) => item.id === sessionId);
      if (!session || (session.ownerId !== interaction.user.id && !canManage && speaker.id !== interaction.user.id)) {
        await interaction.reply({ content: 'Session not found or you are not authorized to download this speaker track.', ephemeral: true });
        return;
      }
      const tracks = await getRecordingTracks(guild.id, sessionId, speaker.id);
      if (tracks.length === 0) {
        await interaction.reply({ content: 'No saved audio segments were found for that speaker in this session.', ephemeral: true });
        return;
      }
      const attachments = tracks.slice(0, 10).map((filepath) => new AttachmentBuilder(filepath));
      await interaction.reply({
        content: `Audio segments for <@${speaker.id}> · session ${sessionId}. Only the first 10 segments are attached.`,
        files: attachments,
        ephemeral: true,
        allowedMentions: { users: [] },
      });
      return;
    }

    if (subcommand === 'delete') {
      const sessionId = interaction.options.getString('session_id', true);
      const recordings = await listRecordings(guild.id);
      const session = recordings.find((item) => item.id === sessionId);
      if (!session || (session.ownerId !== interaction.user.id && !canManage)) {
        await interaction.reply({ content: 'Session not found or you are not authorized to delete it.', ephemeral: true });
        return;
      }
      const deleted = await deleteRecording(guild.id, sessionId);
      await interaction.reply({
        content: deleted ? `🗑️ Session **${sessionId}** and its local audio files were deleted.` : 'That session could not be deleted. Active recordings cannot be deleted.',
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({ content: 'Unknown recording action.', ephemeral: true });
  },
};
