import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Answers, Level } from '../types';
import { getLevel, isAnswered, str } from '../lib/answers';
import { optionLabel } from '../lib/reader';
import { getTarget, getTool } from '../lib/tools';
import { themeFor } from '../data/kitchen';
import type { Chapter, FlowItem } from './Journey';
import { Icon } from './Icon';
import { KitchenScene, type ServeStage } from './Scene';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------ */
/* Recipe card                                                         */
/* ------------------------------------------------------------------ */

const LEVEL_LABEL = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };

export function RecipeCard({
  chapters,
  flow,
  answers,
  variant = 'side',
}: {
  chapters: Chapter[];
  flow: FlowItem[];
  answers: Answers;
  variant?: 'side' | 'full';
}) {
  const name = str(answers, 'projectName');
  const oneLiner = str(answers, 'oneLiner');
  const tool = getTool(answers);
  const target = getTarget(answers);
  const servedIn = tool.value === 'other' ? (target === 'agent' ? 'A coding agent' : 'Any AI chat') : tool.label;
  const scale = str(answers, 'scale');
  const timeline = str(answers, 'timeline');

  const meta = [
    { label: 'Level', value: LEVEL_LABEL[getLevel(answers)] },
    { label: 'Serves', value: scale ? optionLabel('scale', scale) : '—' },
    { label: 'Ready in', value: timeline ? optionLabel('timeline', timeline) : '—' },
    { label: 'Served in', value: servedIn },
  ];

  return (
    <article className={`recipe recipe-${variant}`}>
      <p className="recipe-kicker">Recipe card</p>
      <h2 className={`recipe-title${name ? '' : ' is-empty'}`}>{name || 'Untitled recipe'}</h2>
      <p className={`recipe-desc${oneLiner ? '' : ' is-empty'}`}>{oneLiner || 'Your idea will appear here as you go.'}</p>

      <dl className="recipe-meta">
        {meta.map((m) => (
          <div key={m.label}>
            <dt>{m.label}</dt>
            <dd>{m.value}</dd>
          </div>
        ))}
      </dl>

      <ul className="recipe-parts">
        {chapters.map((c) => {
          const theme = themeFor(c.step.id);
          const items = flow.slice(c.start, c.start + c.count);
          const done = items.filter((f) => isAnswered(answers, f.q.id)).length;
          return (
            <li key={c.step.id} className={done === 0 ? 'is-empty' : done === items.length ? 'is-full' : ''}>
              <span className="recipe-swatch" style={{ background: theme.color }} />
              <span className="recipe-part-name">{theme.name}</span>
              <span className="recipe-part-count">
                {done}/{items.length}
              </span>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Serving: pour, plate, then flip the card to reveal the prompt       */
/* ------------------------------------------------------------------ */

type Phase = 'front' | 'pouring' | 'plated' | 'flip-out' | 'flip-in' | 'back';

export function Serve({
  served,
  onServed,
  chapters,
  flow,
  answers,
  onOpenMap,
  onSetLevel,
  onTaste,
  children,
}: {
  served: boolean;
  onServed: () => void;
  chapters: Chapter[];
  flow: FlowItem[];
  answers: Answers;
  onOpenMap: () => void;
  onSetLevel: (level: Level) => void;
  onTaste: () => void;
  children: ReactNode;
}) {
  const [phase, setPhase] = useState<Phase>(served ? 'back' : 'front');
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const serve = () => {
    if (reducedMotion()) {
      setPhase('back');
      onServed();
      return;
    }
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    setPhase('pouring');
    at(1500, () => setPhase('plated'));
    at(2700, () => setPhase('flip-out'));
    at(3020, () => setPhase('flip-in'));
    at(3520, () => {
      setPhase('back');
      onServed();
    });
  };

  const showBack = phase === 'flip-in' || phase === 'back';
  const busy = phase !== 'front';
  const name = str(answers, 'projectName');
  const serveStage: ServeStage = phase === 'pouring' ? 'pouring' : phase === 'front' ? 'idle' : 'plated';

  return (
    <div className="serve">
      <header className="finale-head">
        <p className="chapter-tag">{showBack ? 'Served' : 'Everything’s in the pot'}</p>
        <h1 className="finale-title">
          {showBack ? 'Bon appétit. Your prompt is ready.' : phase === 'front' ? `${name || 'Your recipe'} is ready to plate.` : 'Plating it up…'}
        </h1>
        <p className="finale-sub">
          {showBack ? (
            <>
              Copy it into your AI tool and answer any questions it asks. Want to tweak something? Open the{' '}
              <button type="button" className="inline-link" onClick={onOpenMap}>
                recipe steps
              </button>
              .
            </>
          ) : (
            'Take one last look at your recipe card. When it looks right, plate it up and we’ll serve your prompt.'
          )}
        </p>
      </header>

      <div className={`plate-stage plate-${phase}`}>
        {showBack ? (
          children
        ) : (
          <div className="serve-front">
            <div className="scene-frame scene-frame-serve">
              <KitchenScene mode="serve" chapters={chapters} flow={flow} answers={answers} serveStage={serveStage} onSetLevel={busy ? undefined : onSetLevel} onTaste={busy ? undefined : onTaste} />
            </div>
            <div className="serve-card">
              <RecipeCard chapters={chapters} flow={flow} answers={answers} variant="full" />
              <button type="button" className="btn btn-accent btn-lg serve-button" onClick={serve} disabled={busy}>
                <Icon name="sparkle" size={16} />
                {busy ? 'Plating…' : 'Plate it up'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
