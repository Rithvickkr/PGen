import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Answers } from '../types';
import { getLevel, isAnswered, str } from '../lib/answers';
import { optionLabel } from '../lib/reader';
import { getTarget, getTool } from '../lib/tools';
import { themeFor, type IngredientShape } from '../data/kitchen';
import type { Chapter, FlowItem } from './Journey';
import { Icon } from './Icon';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ------------------------------------------------------------------ */
/* Ingredients                                                         */
/* ------------------------------------------------------------------ */

function Ingredient({ shape, color, size }: { shape: IngredientShape; color: string; size: number }) {
  switch (shape) {
    case 'leaf':
      return (
        <g>
          <ellipse rx={size * 1.5} ry={size * 0.72} fill={color} />
          <line x1={-size * 1.1} x2={size * 1.1} y1={0} y2={0} stroke="rgba(255,255,255,0.45)" strokeWidth={1} />
        </g>
      );
    case 'drop':
      return (
        <path
          d={`M0 ${-size * 1.3} C ${size} ${-size * 0.2} ${size} ${size} 0 ${size} C ${-size} ${size} ${-size} ${-size * 0.2} 0 ${-size * 1.3} Z`}
          fill={color}
        />
      );
    case 'grain':
      return <rect x={-size * 0.7} y={-size * 0.4} width={size * 1.4} height={size * 0.8} rx={size * 0.4} fill={color} />;
    case 'slice':
      return (
        <g>
          <circle r={size * 1.15} fill={color} />
          <circle r={size * 0.75} fill="rgba(255,255,255,0.55)" />
        </g>
      );
    case 'berry':
      return (
        <g>
          <circle r={size * 0.95} fill={color} />
          <circle cx={-size * 0.3} cy={-size * 0.32} r={size * 0.28} fill="rgba(255,255,255,0.4)" />
        </g>
      );
    default:
      return (
        <g>
          <circle r={size} fill={color} />
          <circle cx={-size * 0.35} cy={-size * 0.35} r={size * 0.3} fill="rgba(255,255,255,0.45)" />
        </g>
      );
  }
}

/* ------------------------------------------------------------------ */
/* Bowl                                                                */
/* ------------------------------------------------------------------ */

interface BowlProps {
  flow: FlowItem[];
  answers: Answers;
  size?: 'lg' | 'sm';
  /** A few resting ingredients for the welcome screen. */
  decor?: boolean;
}

export function Bowl({ flow, answers, size = 'lg', decor = false }: BowlProps) {
  const added = decor ? [] : flow.filter((f) => isAnswered(answers, f.q.id));
  const fill = decor ? 0.35 : flow.length ? added.length / flow.length : 0;
  const wrapRef = useRef<HTMLDivElement>(null);
  const previous = useRef(added.length);
  // Several bowls can be on the page (one hidden per breakpoint), so SVG ids must be unique.
  const uid = useId().replace(/:/g, '');
  const bodyId = `bowl-body-${uid}`;
  const clipId = `bowl-opening-${uid}`;

  // A small wobble when something lands, timed with the end of the drop.
  useEffect(() => {
    const el = wrapRef.current;
    if (el && added.length > previous.current && !reducedMotion()) {
      el.animate(
        [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-2.5deg)' }, { transform: 'rotate(1.5deg)' }, { transform: 'rotate(0deg)' }],
        { duration: 520, delay: 420, easing: 'ease-out' },
      );
    }
    previous.current = added.length;
  }, [added.length]);

  const surfaceY = 98 - fill * 18;
  const spreadX = 64 + fill * 20;
  const spreadY = 16 + fill * 5;

  const pieces = decor
    ? [
        { id: 'a', shape: 'leaf' as const, color: '#78a565', x: 108, y: 88, rot: -20, size: 7 },
        { id: 'b', shape: 'dot' as const, color: '#f2b43c', x: 140, y: 84, rot: 0, size: 8 },
        { id: 'c', shape: 'berry' as const, color: '#6f7fd4', x: 162, y: 95, rot: 0, size: 6 },
        { id: 'd', shape: 'berry' as const, color: '#e0708f', x: 96, y: 101, rot: 0, size: 5.5 },
        { id: 'e', shape: 'slice' as const, color: '#efcd48', x: 125, y: 103, rot: 0, size: 6 },
      ]
    : added.map((f) => {
        const h = hash(f.q.id);
        const theme = themeFor(f.step.id);
        const angle = ((h % 360) * Math.PI) / 180;
        const radius = Math.sqrt(((h >>> 9) % 100) / 100) * 0.92;
        return {
          id: f.q.id,
          shape: theme.shape,
          color: theme.color,
          x: 130 + Math.cos(angle) * spreadX * radius,
          y: surfaceY + Math.sin(angle) * spreadY * radius,
          rot: (h >>> 3) % 180,
          size: 4.5 + ((h >>> 5) % 30) / 10,
        };
      });

  return (
    <div className={`bowl bowl-${size}${decor ? ' bowl-decor' : ''}`} ref={wrapRef}>
      <svg viewBox="0 0 260 220" role="img" aria-label={decor ? 'A mixing bowl' : `${added.length} of ${flow.length} ingredients added`}>
        <defs>
          <linearGradient id={bodyId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.55" stopColor="#f6efe5" />
            <stop offset="1" stopColor="#e4d6c3" />
          </linearGradient>
          <clipPath id={clipId}>
            <ellipse cx="130" cy="80" rx="108" ry="32" />
          </clipPath>
        </defs>

        <ellipse cx="130" cy="206" rx="86" ry="9" fill="rgba(70, 50, 30, 0.1)" />
        <path
          d="M22 82 C 26 172 72 200 130 200 C 188 200 234 172 238 82 Z"
          fill={`url(#${bodyId})`}
          stroke="rgba(110, 80, 50, 0.14)"
          strokeWidth="1.5"
        />
        <path d="M34 124 C 56 154 92 166 130 166 C 168 166 204 154 226 124" fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" opacity="0.18" />
        <ellipse cx="130" cy="80" rx="110" ry="34" fill="#e3d6c3" />
        <g clipPath={`url(#${clipId})`}>
          <ellipse
            className="batter"
            cx="130"
            cy="98"
            rx="82"
            ry="22"
            fill="#f6e5c3"
            style={{ transform: `translateY(${-fill * 18}px) scale(${1 + fill * 0.26}, ${1 + fill * 0.28})` }}
          />
        </g>

        {pieces.map((p, i) => (
          <g key={p.id} className="piece-pos" style={{ transform: `translate(${p.x}px, ${p.y}px)` } as CSSProperties}>
            <g className="piece" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
              <g transform={`rotate(${p.rot})`}>
                <Ingredient shape={p.shape} color={p.color} size={p.size} />
              </g>
            </g>
          </g>
        ))}

        <ellipse cx="130" cy="80" rx="110" ry="34" fill="none" stroke="#ffffff" strokeWidth="3.5" />
        <ellipse cx="130" cy="80" rx="112" ry="36" fill="none" stroke="rgba(110, 80, 50, 0.12)" strokeWidth="1" />
      </svg>
    </div>
  );
}

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
/* Compact kitchen for narrow screens                                  */
/* ------------------------------------------------------------------ */

export function KitchenStrip({ flow, answers, onOpen }: { flow: FlowItem[]; answers: Answers; onOpen: () => void }) {
  const added = flow.filter((f) => isAnswered(answers, f.q.id)).length;
  return (
    <button type="button" className="kitchen-strip" onClick={onOpen}>
      <Bowl flow={flow} answers={answers} size="sm" />
      <span className="kitchen-strip-text">
        <strong>{added} ingredients</strong> in the bowl
      </span>
      <span className="kitchen-strip-link">
        Recipe card
        <Icon name="arrowRight" size={13} />
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Serving: the recipe card flips over to reveal the prompt            */
/* ------------------------------------------------------------------ */

type Phase = 'front' | 'flip-out' | 'flip-in' | 'back';

export function Serve({
  served,
  onServed,
  chapters,
  flow,
  answers,
  onOpenMap,
  children,
}: {
  served: boolean;
  onServed: () => void;
  chapters: Chapter[];
  flow: FlowItem[];
  answers: Answers;
  onOpenMap: () => void;
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
    setPhase('flip-out');
    timers.current.push(
      window.setTimeout(() => setPhase('flip-in'), 320),
      window.setTimeout(() => {
        setPhase('back');
        onServed();
      }, 820),
    );
  };

  const showBack = phase === 'flip-in' || phase === 'back';
  const name = str(answers, 'projectName');

  return (
    <div className="serve">
      <header className="finale-head">
        <p className="chapter-tag">{showBack ? 'Served' : 'Everything’s in the bowl'}</p>
        <h1 className="finale-title">{showBack ? 'Bon appétit. Your prompt is ready.' : `${name || 'Your recipe'} is ready to serve.`}</h1>
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
            'Take one last look at your recipe card. When it looks right, serve it and we’ll turn it into your prompt.'
          )}
        </p>
      </header>

      <div className={`plate plate-${phase}`}>
        {showBack ? (
          children
        ) : (
          <div className="serve-front">
            <div className="serve-bowl">
              <Bowl flow={flow} answers={answers} />
            </div>
            <div className="serve-card">
              <RecipeCard chapters={chapters} flow={flow} answers={answers} variant="full" />
              <button type="button" className="btn btn-accent btn-lg serve-button" onClick={serve} disabled={phase !== 'front'}>
                <Icon name="sparkle" size={16} />
                Serve the prompt
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
