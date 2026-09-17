import type { Answers, Level, Question, Step } from '../types';

export const LEVELS: { value: Level; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const LEVEL_RANK: Record<Level, number> = { beginner: 0, intermediate: 1, advanced: 2 };

export const DEFAULT_ANSWERS: Answers = {
  level: 'beginner',
  target: 'chat',
  outcome: 'build',
  stackMode: 'recommend',
  workStyle: ['clarify', 'explain', 'phases'],
};

export function getLevel(a: Answers): Level {
  const l = a.level;
  return l === 'intermediate' || l === 'advanced' ? l : 'beginner';
}

export function atLeast(a: Answers, level: Level): boolean {
  return LEVEL_RANK[getLevel(a)] >= LEVEL_RANK[level];
}

export function str(a: Answers, id: string): string {
  const v = a[id];
  return typeof v === 'string' ? v.trim() : '';
}

export function arr(a: Answers, id: string): string[] {
  const v = a[id];
  return Array.isArray(v) ? v.map((s) => s.trim()).filter(Boolean) : [];
}

/** Platforms without a visual interface skip the design step. */
export function hasUI(a: Answers): boolean {
  return !['api', 'cli', 'automation'].includes(str(a, 'platform'));
}

export function isQuestionVisible(q: Question, a: Answers): boolean {
  return atLeast(a, q.level ?? 'beginner') && (!q.showIf || q.showIf(a));
}

export function isStepVisible(step: Step, a: Answers): boolean {
  if (step.questions.length === 0) return true;
  if (step.level && !atLeast(a, step.level)) return false;
  if (step.showIf && !step.showIf(a)) return false;
  return step.questions.some((q) => isQuestionVisible(q, a));
}

export function isAnswered(a: Answers, id: string): boolean {
  return str(a, id).length > 0 || arr(a, id).length > 0;
}

export function stepProgress(step: Step, a: Answers): { answered: number; total: number } {
  const qs = step.questions.filter((q) => isQuestionVisible(q, a));
  return { answered: qs.filter((q) => isAnswered(a, q.id)).length, total: qs.length };
}

export function sanitizeAnswers(input: unknown): Answers {
  const out: Answers = {};
  if (!input || typeof input !== 'object') return out;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v;
    else if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === 'string');
  }
  if (out.target === 'code') out.target = 'agent';
  return out;
}
