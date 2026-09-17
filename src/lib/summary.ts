import type { AnswerValue, Question } from '../types';
import { optionLabel } from './reader';

/** One-line summary of an answer, for overviews like the journey map. */
export function summarize(q: Question, value: AnswerValue | undefined): string {
  if (typeof value === 'string') {
    const v = value.trim();
    if (!v) return '';
    return q.type === 'single' || q.type === 'cards' ? optionLabel(q.id, v) : v.split('\n')[0];
  }
  const items = (value ?? []).map((s) => s.trim()).filter(Boolean);
  if (!items.length) return '';
  if (q.type === 'list') return `${items.length} item${items.length > 1 ? 's' : ''} · ${items[0]}`;
  const labels = items.map((v) => optionLabel(q.id, v));
  return labels.length > 3 ? `${labels.slice(0, 3).join(', ')} +${labels.length - 3} more` : labels.join(', ');
}
