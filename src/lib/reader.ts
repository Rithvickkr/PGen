import type { Answers, Question, Step } from '../types';
import { STEPS } from '../data/steps';
import { isQuestionVisible, isStepVisible } from './answers';

const INDEX = new Map<string, { q: Question; step: Step }>();
for (const step of STEPS) for (const q of step.questions) INDEX.set(q.id, { q, step });

export function optionLabel(id: string, value: string): string {
  return INDEX.get(id)?.q.options?.find((o) => o.value === value)?.label ?? value;
}

export function stepOf(id: string): string | undefined {
  return INDEX.get(id)?.step.id;
}

/**
 * Reads answers the way the prompt should see them: only questions visible at the current
 * level and platform count, so switching levels never leaks hidden answers into the prompt.
 */
export function createReader(a: Answers) {
  const visible = (id: string) => {
    const entry = INDEX.get(id);
    return !!entry && isStepVisible(entry.step, a) && isQuestionVisible(entry.q, a);
  };
  const text = (id: string): string => {
    const v = a[id];
    return visible(id) && typeof v === 'string' ? v.trim() : '';
  };
  const list = (id: string): string[] => {
    const v = a[id];
    return visible(id) && Array.isArray(v) ? v.map((s) => s.trim()).filter(Boolean) : [];
  };
  return {
    text,
    list,
    label: (id: string) => {
      const v = text(id);
      return v ? optionLabel(id, v) : '';
    },
    labels: (id: string) => list(id).map((v) => optionLabel(id, v)),
    is: (id: string, value: string) => text(id) === value,
    includes: (id: string, value: string) => list(id).includes(value),
  };
}

export type Reader = ReturnType<typeof createReader>;
