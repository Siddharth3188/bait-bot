import {
  EndBehaviorType,
  VoiceConnectionStatus,
  entersState,
  joinVoiceChannel,
  type VoiceConnection,
} from '@discordjs/voice';
import type { Guild } from 'discord.js';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { pipeline } from 'node:stream';
import prism from 'prism-media';

const RECORDINGS_DIR = join(process.cwd(), 'recordings');
const consents = new Map<string, Set<string>>();
const activeSessions = new Map<string, RecordingSession>();

interface RecordingManifest {
  id: string;
  guildId: string;
  ownerId: string;
  voiceChannelId: string;
  textChannelId: string;
  startedAt: string;
  endedAt: string | null;
  status: 'recording' | 'stopped';
  participants: string[];
  files: string[];
}

interface RecordingSession {
  manifest: RecordingManifest;
  folder: string;
  connection: VoiceConnection;
  activeStreams: Map<string, NodeJS.ReadableStream & { destroy: () => void }>;
  counters: Map<string, number>;
  pendingWrites: Promise<void>[];
}

export function hasRecordingConsent(guildId: string, userId: string): boolean {
  return consents.get(guildId)?.has(userId) ?? false;
}

export function setRecordingConsent(guildId: string, userId: string, enabled: boolean): void {
  const guildConsents = consents.get(guildId) ?? new Set<string>();
  if (enabled) {
    guildConsents.add(userId);
    consents.set(guildId, guildConsents);
    return;
  }

  guildConsents.delete(userId);
  const session = activeSessions.get(guildId);
  const stream = session?.activeStreams.get(userId);
  if (stream) {
    stream.destroy();
    session?.activeStreams.delete(userId);
  }
}

export function getMissingConsents(
  guildId: string,
  participants: Array<{ id: string; isBot: boolean; displayName: string }>,
): string[] {
  return participants
    .filter((participant) => !participant.isBot && !hasRecordingConsent(guildId, participant.id))
    .map((participant) => participant.displayName);
}

export async function startRecording(
  guild: Guild,
  voiceChannelId: string,
  textChannelId: string,
  ownerId: string,
  participants: Array<{ id: string; isBot: boolean }>,
): Promise<string> {
  if (activeSessions.has(guild.id)) {
    throw new Error('A recording session is already active in this server.');
  }

  const missing = participants.filter((participant) => !participant.isBot && !hasRecordingConsent(guild.id, participant.id));
  if (missing.length > 0) {
    throw new Error('Every person currently in the voice channel must opt in before recording can start.');
  }

  const id = Date.now().toString(36);
  const folder = join(RECORDINGS_DIR, guild.id, id);
  await mkdir(folder, { recursive: true });

  const connection = joinVoiceChannel({
    channelId: voiceChannelId,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: true,
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
  } catch (error) {
    connection.destroy();
    await rm(folder, { recursive: true, force: true });
    throw new Error('Bait Bot could not connect to the voice channel. Check its voice permissions and try again.', { cause: error });
  }

  const manifest: RecordingManifest = {
    id,
    guildId: guild.id,
    ownerId,
    voiceChannelId,
    textChannelId,
    startedAt: new Date().toISOString(),
    endedAt: null,
    status: 'recording',
    participants: participants.filter((participant) => !participant.isBot).map((participant) => participant.id),
    files: [],
  };

  const session: RecordingSession = {
    manifest,
    folder,
    connection,
    activeStreams: new Map(),
    counters: new Map(),
    pendingWrites: [],
  };

  activeSessions.set(guild.id, session);
  await writeManifest(session);

  connection.receiver.speaking.on('start', (userId) => {
    if (!hasRecordingConsent(guild.id, userId) || session.activeStreams.has(userId)) return;

    const stream = connection.receiver.subscribe(userId, {
      end: { behavior: EndBehaviorType.AfterSilence, duration: 1_000 },
    });
    const sequence = (session.counters.get(userId) ?? 0) + 1;
    session.counters.set(userId, sequence);
    const filename = `${userId}-${sequence}.ogg`;
    const filepath = join(folder, filename);
    const oggStream = new prism.opus.OggLogicalBitstream({
      opusHead: new prism.opus.OpusHead({ channelCount: 2, sampleRate: 48_000 }),
      pageSizeControl: { maxPackets: 10 },
    });

    session.activeStreams.set(userId, stream);
    const writeFinished = new Promise<void>((resolve) => {
      pipeline(stream, oggStream, createWriteStream(filepath), async (error) => {
        session.activeStreams.delete(userId);
        if (error) {
          console.warn('[Bait Bot] A speaker audio segment could not be saved:', error.message);
        } else {
          session.manifest.files.push(filename);
          await writeManifest(session).catch((writeError: unknown) => {
            console.error('[Bait Bot] Could not update recording manifest:', writeError);
          });
        }
        resolve();
      });
    });
    session.pendingWrites.push(writeFinished);
  });

  return id;
}

export async function stopRecording(guildId: string): Promise<RecordingManifest | null> {
  const session = activeSessions.get(guildId);
  if (!session) return null;

  activeSessions.delete(guildId);
  session.manifest.status = 'stopped';
  session.manifest.endedAt = new Date().toISOString();

  for (const stream of session.activeStreams.values()) stream.destroy();
  session.connection.destroy();

  await Promise.all(session.pendingWrites);
  await writeManifest(session);
  return session.manifest;
}

export function getActiveRecording(guildId: string): RecordingManifest | null {
  return activeSessions.get(guildId)?.manifest ?? null;
}

export async function listRecordings(guildId: string): Promise<RecordingManifest[]> {
  const guildFolder = join(RECORDINGS_DIR, guildId);
  try {
    const entries = await readdir(guildFolder, { withFileTypes: true });
    const manifests = await Promise.all(entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        try {
          const raw = await readFile(join(guildFolder, entry.name, 'session.json'), 'utf8');
          return JSON.parse(raw) as RecordingManifest;
        } catch {
          return null;
        }
      }));
    return manifests.filter((manifest): manifest is RecordingManifest => manifest !== null)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  } catch {
    return [];
  }
}

export async function getRecordingTracks(
  guildId: string,
  sessionId: string,
  userId: string,
): Promise<string[]> {
  const manifest = await readManifest(guildId, sessionId);
  if (!manifest || manifest.status !== 'stopped') return [];
  return manifest.files
    .filter((filename) => filename.startsWith(`${userId}-`) && filename.endsWith('.ogg'))
    .map((filename) => join(RECORDINGS_DIR, guildId, sessionId, filename));
}

export async function deleteRecording(guildId: string, sessionId: string): Promise<boolean> {
  if (!/^[a-z0-9]+$/i.test(sessionId) || activeSessions.has(guildId)) return false;
  const manifest = await readManifest(guildId, sessionId);
  if (!manifest || manifest.status !== 'stopped') return false;
  await rm(join(RECORDINGS_DIR, guildId, sessionId), { recursive: true, force: true });
  return true;
}

async function readManifest(guildId: string, sessionId: string): Promise<RecordingManifest | null> {
  if (!/^[a-z0-9]+$/i.test(sessionId)) return null;
  try {
    const raw = await readFile(join(RECORDINGS_DIR, guildId, sessionId, 'session.json'), 'utf8');
    return JSON.parse(raw) as RecordingManifest;
  } catch {
    return null;
  }
}

async function writeManifest(session: RecordingSession): Promise<void> {
  await writeFile(join(session.folder, 'session.json'), JSON.stringify(session.manifest, null, 2), 'utf8');
}
