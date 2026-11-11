import { makeTemplate, type JokeKind } from '../data/jokeTemplates.js';

export function generateTemplateJoke(kind: JokeKind, names: string[]): string {
  if (kind === 'roast') return makeTemplate('roast', [names[0] ?? 'This member']);
  if (kind === 'duo') return makeTemplate('duo', [names[0] ?? 'Member A', names[1] ?? 'Member B']);
  return makeTemplate('group', names);
}
