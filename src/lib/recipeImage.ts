import type { Answers } from '../types';
import { getLevel, str } from './answers';
import { optionLabel } from './reader';
import { getTarget, getTool } from './tools';
import { themeFor } from '../data/kitchen';

interface Part {
  stepId: string;
  done: number;
  total: number;
}

const LEVEL_LABEL = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    } else line = next;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…';
  }
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws a shareable recipe card (1080×1350) and downloads it as a PNG. */
export async function downloadRecipeImage(answers: Answers, parts: Part[], pieces: { stepId: string; id: string }[]): Promise<void> {
  await document.fonts?.ready;
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const font = (weight: number, size: number, family = 'Geist') => `${weight} ${size}px ${family}, system-ui, sans-serif`;

  // Background and card
  ctx.fillStyle = '#f4ece1';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(90, 60, 30, 0.08)';
  roundRect(ctx, 70, 86, W - 140, H - 160, 44);
  ctx.fill();
  ctx.fillStyle = '#fffdf8';
  roundRect(ctx, 70, 70, W - 140, H - 160, 44);
  ctx.fill();

  // Dashed top edge
  ctx.strokeStyle = '#f26b3a';
  ctx.lineWidth = 6;
  ctx.setLineDash([26, 16]);
  ctx.beginPath();
  ctx.moveTo(120, 73);
  ctx.lineTo(W - 120, 73);
  ctx.stroke();
  ctx.setLineDash([]);

  // Plate with the dish
  const cx = W / 2;
  const cy = 330;
  ctx.fillStyle = 'rgba(90, 60, 30, 0.1)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 22, 250, 60, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(cx, cy, 240, 70, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f3ece2';
  ctx.beginPath();
  ctx.ellipse(cx, cy, 170, 48, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f0d9ae';
  ctx.beginPath();
  ctx.ellipse(cx, cy - 16, 140, 44, 0, 0, Math.PI * 2);
  ctx.fill();
  pieces.slice(-24).forEach((p, i) => {
    let h = 0;
    for (const ch of p.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const a = (h % 360) * (Math.PI / 180);
    const rr = Math.sqrt(((h >>> 8) % 100) / 100);
    ctx.fillStyle = themeFor(p.stepId).color;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * 110 * rr, cy - 18 + Math.sin(a) * 30 * rr, 9 + (i % 3) * 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // Title and description
  const name = str(answers, 'projectName') || 'Untitled recipe';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#a0958a';
  ctx.font = font(500, 26);
  ctx.fillText('RECIPE CARD', cx, 500);
  ctx.fillStyle = '#1e1d1b';
  ctx.font = font(600, 76);
  ctx.fillText(wrap(ctx, name, W - 260, 1)[0], cx, 588);
  ctx.fillStyle = '#69655e';
  ctx.font = font(400, 32);
  wrap(ctx, str(answers, 'oneLiner') || 'A new app idea, ready to cook.', W - 300, 3).forEach((l, i) => ctx.fillText(l, cx, 650 + i * 46));

  // Meta grid
  const tool = getTool(answers);
  const servedIn = tool.value === 'other' ? (getTarget(answers) === 'agent' ? 'A coding agent' : 'Any AI chat') : tool.label;
  const scale = str(answers, 'scale');
  const timeline = str(answers, 'timeline');
  const meta = [
    ['Level', LEVEL_LABEL[getLevel(answers)]],
    ['Serves', scale ? optionLabel('scale', scale) : '—'],
    ['Ready in', timeline ? optionLabel('timeline', timeline) : '—'],
    ['Served in', servedIn],
  ];
  ctx.strokeStyle = 'rgba(30, 29, 27, 0.15)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  [800, 1000].forEach((y) => {
    ctx.beginPath();
    ctx.moveTo(150, y);
    ctx.lineTo(W - 150, y);
    ctx.stroke();
  });
  ctx.setLineDash([]);
  ctx.textAlign = 'left';
  meta.forEach(([label, value], i) => {
    const x = i % 2 === 0 ? 170 : 580;
    const y = i < 2 ? 860 : 950;
    ctx.fillStyle = '#a0958a';
    ctx.font = font(400, 24);
    ctx.fillText(label, x, y);
    ctx.fillStyle = '#1e1d1b';
    ctx.font = font(500, 32);
    ctx.fillText(wrap(ctx, value, 360, 1)[0], x, y + 40);
  });

  // Parts
  parts.forEach((p, i) => {
    const x = i % 2 === 0 ? 170 : 580;
    const y = 1060 + Math.floor(i / 2) * 44;
    ctx.fillStyle = themeFor(p.stepId).color;
    ctx.globalAlpha = p.done ? 1 : 0.35;
    ctx.beginPath();
    ctx.arc(x + 9, y - 9, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = p.done ? '#1e1d1b' : '#a0958a';
    ctx.font = font(400, 26);
    ctx.fillText(themeFor(p.stepId).name, x + 32, y);
    ctx.fillStyle = '#a0958a';
    ctx.font = font(400, 22, 'Geist Mono');
    ctx.textAlign = 'right';
    ctx.fillText(`${p.done}/${p.total}`, x + 340, y);
    ctx.textAlign = 'left';
  });

  // Footer
  ctx.textAlign = 'center';
  ctx.fillStyle = '#a0958a';
  ctx.font = font(500, 26);
  ctx.fillText('Cooked up with PGen', cx, H - 40);

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'recipe'}-recipe-card.png`;
  link.click();
  URL.revokeObjectURL(url);
}

