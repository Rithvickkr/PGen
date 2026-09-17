import type { Answers, Level } from '../types';
import { atLeast, hasUI } from './answers';
import { createReader, type Reader } from './reader';

interface Check {
  step: string;
  weight: number;
  tip: string;
  level?: Level;
  when?: (a: Answers) => boolean;
  ok: (r: Reader) => boolean;
}

const CHECKS: Check[] = [
  { step: 'idea', weight: 14, tip: 'Describe your idea in one clear sentence.', ok: (r) => r.text('oneLiner').length >= 15 },
  { step: 'idea', weight: 10, tip: 'Explain the problem it solves: who feels it, and when.', ok: (r) => r.text('problem').length >= 30 },
  { step: 'users', weight: 10, tip: 'Describe who will use it, as specifically as you can.', ok: (r) => r.text('targetUsers').length >= 20 },
  { step: 'users', weight: 10, tip: 'Walk through a typical user journey step by step.', ok: (r) => r.text('userJourney').length >= 40 },
  { step: 'platform', weight: 8, tip: 'Choose what kind of software you’re building.', ok: (r) => !!r.text('platform') },
  { step: 'features', weight: 14, tip: 'List at least 3 must-have features.', ok: (r) => r.list('coreFeatures').length >= 3 },
  { step: 'design', weight: 4, tip: 'Pick a design style so the result matches your taste.', when: hasUI, ok: (r) => !!r.text('designStyle') },
  { step: 'tech', weight: 5, tip: 'Share your coding experience.', ok: (r) => !!r.text('experience') },
  { step: 'tech', weight: 4, tip: 'Say where it will run and what you can spend.', ok: (r) => !!r.text('hosting') && !!r.text('budget') },
  { step: 'delivery', weight: 4, tip: 'Set a rough timeline.', ok: (r) => !!r.text('timeline') },
  { step: 'idea', level: 'intermediate', weight: 4, tip: 'Mention how people solve this today.', ok: (r) => r.text('alternatives').length >= 15 },
  { step: 'features', level: 'intermediate', weight: 6, tip: 'Describe the main data the app stores.', ok: (r) => r.text('dataEntities').length >= 20 },
  { step: 'delivery', level: 'intermediate', weight: 6, tip: 'Define what “done” looks like for version 1.', ok: (r) => r.text('successCriteria').length >= 20 },
  { step: 'quality', level: 'intermediate', weight: 4, tip: 'Choose a testing approach.', ok: (r) => !!r.text('testing') },
  { step: 'features', level: 'advanced', weight: 6, tip: 'List what’s explicitly out of scope.', ok: (r) => r.list('outOfScope').length >= 1 },
  { step: 'features', level: 'advanced', weight: 4, tip: 'Note business rules and edge cases.', ok: (r) => r.text('edgeCases').length >= 20 },
  { step: 'quality', level: 'advanced', weight: 4, tip: 'Flag security and data requirements.', ok: (r) => r.list('security').length >= 1 },
];

export interface Strength {
  score: number;
  label: string;
  tips: { tip: string; step: string }[];
}

export function scorePrompt(a: Answers): Strength {
  const r = createReader(a);
  const applicable = CHECKS.filter((c) => atLeast(a, c.level ?? 'beginner') && (!c.when || c.when(a)));
  const total = applicable.reduce((s, c) => s + c.weight, 0);
  let earned = 0;
  const tips: Strength['tips'] = [];
  for (const c of applicable) {
    if (c.ok(r)) earned += c.weight;
    else tips.push({ tip: c.tip, step: c.step });
  }
  const score = total ? Math.round((earned / total) * 100) : 0;
  const label = score >= 90 ? 'Excellent' : score >= 70 ? 'Strong' : score >= 40 ? 'Good start' : 'Needs detail';
  return { score, label, tips };
}
