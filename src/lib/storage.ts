import type { Answers } from '../types';
import { DEFAULT_ANSWERS, sanitizeAnswers } from './answers';

const KEY = 'pgen:v1';

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(data: string): string {
  const bin = atob(data.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function shareUrl(answers: Answers): string {
  return `${location.origin}${location.pathname}#p=${toBase64Url(JSON.stringify(answers))}`;
}

export function loadState(): { answers: Answers; stepId: string } {
  const match = location.hash.match(/^#p=(.+)$/);
  if (match) {
    history.replaceState(null, '', location.pathname + location.search);
    try {
      return { answers: { ...DEFAULT_ANSWERS, ...sanitizeAnswers(JSON.parse(fromBase64Url(match[1]))) }, stepId: 'review' };
    } catch {
      /* fall through to saved state */
    }
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { answers: sanitizeAnswers(parsed.answers), stepId: typeof parsed.stepId === 'string' ? parsed.stepId : 'welcome' };
    }
  } catch {
    /* storage unavailable */
  }
  return { answers: { ...DEFAULT_ANSWERS }, stepId: 'welcome' };
}

export function saveState(answers: Answers, stepId: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ answers, stepId }));
  } catch {
    /* storage unavailable */
  }
}

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    el.remove();
  }
}

export function downloadText(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
