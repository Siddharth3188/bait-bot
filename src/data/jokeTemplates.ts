export type JokeKind = 'roast' | 'duo' | 'group';

const roastTemplates = [
  (name: string) => `${name} has the confidence of a final boss and the decision-making of a tutorial NPC.`,
  (name: string) => `${name} is proof that a loading screen can become a whole personality.`,
  (name: string) => `Scientists studied ${name} for three hours. They still couldn't identify the source of the lag.`,
  (name: string) => `${name} brings “I'll do it in five minutes” energy to a 14-month project.`,
  (name: string) => `${name} has 47 tabs open in their brain and every single one is buffering.`,
  (name: string) => `If confidence were Wi-Fi, ${name} would have full bars with absolutely no internet.`,
];

const duoTemplates = [
  (a: string, b: string) => `${a} brings the plan. ${b} brings a completely unrelated problem. Elite teamwork.`,
  (a: string, b: string) => `${a} and ${b}: one shared brain cell, currently on airplane mode.`,
  (a: string, b: string) => `If ${a} says “trust me” and ${b} says “I have an idea,” evacuate immediately.`,
  (a: string, b: string) => `${a} is the plot twist. ${b} is the reason the plot needed a twist.`,
  (a: string, b: string) => `${a} and ${b} could turn a five-minute task into a limited series.`,
];

const groupTemplates = [
  (names: string[]) => `The squad has assembled: ${names.join(', ')}. The server's average IQ just filed a leave request.`,
  (names: string[]) => `Tonight's team: ${names.join(', ')}. One has a plan, one has snacks, and the rest are here because the invite link worked.`,
  (names: string[]) => `${names.join(', ')} have been selected for a top-secret mission: successfully deciding what to play. Current success rate: 0%.`,
  (names: string[]) => `Breaking news: ${names.join(', ')} were seen making a group decision. Experts call it the longest event in recorded history.`,
];

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

export function makeTemplate(kind: 'roast', names: [string]): string;
export function makeTemplate(kind: 'duo', names: [string, string]): string;
export function makeTemplate(kind: 'group', names: string[]): string;
export function makeTemplate(kind: JokeKind, names: string[]): string {
  if (kind === 'roast') return pick(roastTemplates)(names[0] ?? 'This member');
  if (kind === 'duo') return pick(duoTemplates)(names[0] ?? 'Member A', names[1] ?? 'Member B');
  return pick(groupTemplates)(names);
}
