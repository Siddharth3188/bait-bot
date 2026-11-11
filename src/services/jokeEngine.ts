import type { JokeKind } from '../data/jokeTemplates.js';
import { generateAIJoke, isAIAvailable } from './aiEngine.js';
import { generateTemplateJoke } from './templateEngine.js';

export async function generateJoke(kind: JokeKind, names: string[]): Promise<{ joke: string; source: 'AI' | 'templates' }> {
  const configuredChance = Number(process.env.AI_JOKE_CHANCE ?? 0.5);
  const aiChance = Number.isFinite(configuredChance) ? Math.min(1, Math.max(0, configuredChance)) : 0.5;

  if (isAIAvailable() && Math.random() < aiChance) {
    try {
      return { joke: await generateAIJoke(kind, names), source: 'AI' };
    } catch (error) {
      console.warn('[Bait Bot] AI generation failed; using templates instead.', error);
    }
  }

  return { joke: generateTemplateJoke(kind, names), source: 'templates' };
}
