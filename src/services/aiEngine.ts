import OpenAI from 'openai';
import type { JokeKind } from '../data/jokeTemplates.js';

const apiKey = process.env.OPENAI_API_KEY;
const client = apiKey ? new OpenAI({ apiKey }) : null;

export function isAIAvailable(): boolean {
  return Boolean(client);
}

export async function generateAIJoke(kind: JokeKind, names: string[]): Promise<string> {
  if (!client) throw new Error('AI is not configured.');

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const subject = names.join(', ');
  const instruction = [
    'Write exactly one short, hilarious Discord joke.',
    'The requested style is chaotic, witty, absurd and playfully savage, but never genuinely cruel.',
    'Use the provided display names naturally. Do not invent personal facts about them.',
    'Do not target protected or sensitive traits, appearance, disability, identity, trauma, or real-life hardship.',
    'No slurs, sexual content, threats, or encouragement of harm.',
    'Keep it to one or two sentences and suitable for a mixed-age gaming community.',
    `Joke type: ${kind}. Members: ${subject}.`,
  ].join(' ');

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: 'You are Bait Bot, a chaotic but friendly Discord comedy bot.' },
      { role: 'user', content: instruction },
    ],
    temperature: 1.05,
    max_tokens: 110,
  });

  const joke = response.choices[0]?.message?.content?.trim();
  if (!joke) throw new Error('AI returned an empty joke.');
  return joke;
}
