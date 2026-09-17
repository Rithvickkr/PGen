import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { Answers, Level } from '../types';
import { LEVELS, getLevel, isAnswered, str } from '../lib/answers';
import { themeFor } from '../data/kitchen';
import type { Chapter, FlowItem } from './Journey';
import { Ingredient } from './Ingredient';

export type SceneMode = 'welcome' | 'cooking' | 'serve';
export type ServeStage = 'idle' | 'pouring' | 'plated';

interface SceneProps {
  mode: SceneMode;
  chapters: Chapter[];
  flow: FlowItem[];
  answers: Answers;
  currentStepId?: string;
  /** Bumps each time an answered question is added to the pot. */
  cook?: { tick: number; stepId: string };
  serveStage?: ServeStage;
  onSelectChapter?: (index: number) => void;
  onSetLevel?: (level: Level) => void;
  onTaste?: () => void;
  onOpenRecipe?: () => void;
  onStart?: () => void;
}

const BROTH: [number, number, number] = [244, 222, 178];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The pot's color: warm broth tinted by everything that's gone in. */
export function mixtureColor(flow: FlowItem[], answers: Answers): string {
  const added = flow.filter((f) => isAnswered(answers, f.q.id));
  if (!added.length) return `rgb(${BROTH.join(',')})`;
  const sum = added.reduce<[number, number, number]>((acc, f) => {
    const c = rgb(themeFor(f.step.id).color);
    return [acc[0] + c[0], acc[1] + c[1], acc[2] + c[2]];
  }, [0, 0, 0]);
  const strength = Math.min(0.55, 0.2 + added.length / 80);
  const mix = BROTH.map((b, i) => Math.round(b * (1 - strength) + (sum[i] / added.length) * strength));
  return `rgb(${mix.join(',')})`;
}

/** Keyboard and pointer props for an SVG group that acts as a button. */
function pressable(label: string, onPress?: () => void) {
  if (!onPress) return {};
  return {
    role: 'button',
    tabIndex: 0,
    'aria-label': label,
    onClick: onPress,
    onKeyDown: (e: KeyboardEvent<SVGGElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onPress();
      }
    },
  };
}

export function KitchenScene({
  mode,
  chapters,
  flow,
  answers,
  currentStepId,
  cook,
  serveStage = 'idle',
  onSelectChapter,
  onSetLevel,
  onTaste,
  onOpenRecipe,
  onStart,
}: SceneProps) {
  const uid = useId().replace(/:/g, '');
  const added = flow.filter((f) => isAnswered(answers, f.q.id));
  const progress = mode === 'welcome' ? 0 : flow.length ? added.length / flow.length : 0;
  const heat = mode === 'welcome' ? 0.35 : mode === 'serve' ? 0.85 : 0.35 + progress * 0.65;
  const mixture = mode === 'welcome' ? `rgb(${BROTH.join(',')})` : mixtureColor(flow, answers);
  const level = getLevel(answers);
  const name = str(answers, 'projectName');

  // Ingredients flying from the board into the pot.
  const [flights, setFlights] = useState<{ key: number; stepId: string }[]>([]);
  const lastTick = useRef(cook?.tick ?? 0);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  useEffect(() => {
    if (!cook || cook.tick === lastTick.current) return;
    lastTick.current = cook.tick;
    const flight = { key: cook.tick, stepId: cook.stepId };
    setFlights((f) => [...f, flight]);
    timers.current.push(window.setTimeout(() => setFlights((f) => f.filter((x) => x.key !== flight.key)), 1300));
  }, [cook]);

  const boardTheme = themeFor(mode === 'welcome' ? 'idea' : currentStepId ?? 'idea');
  const surfacePieces = added.slice(-12);
  const garnish = added.slice(-9);
  const pct = Math.round(progress * 100);

  return (
    <svg className={`scene-svg scene-${mode}`} viewBox="0 0 600 640" preserveAspectRatio="xMidYMax meet" role="group" aria-label="Kitchen">
      <defs>
        <pattern id={`tiles-${uid}`} width="46" height="24" patternUnits="userSpaceOnUse">
          <rect width="46" height="24" fill="#faf5ee" />
          <rect x="1" y="1" width="44" height="22" rx="3" fill="#fdfaf5" stroke="rgba(120, 90, 60, 0.09)" />
        </pattern>
        <linearGradient id={`sky-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bfe0ef" />
          <stop offset="1" stopColor="#eef7fa" />
        </linearGradient>
        <linearGradient id={`pot-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#4b5460" />
          <stop offset="0.45" stopColor="#5f6a77" />
          <stop offset="1" stopColor="#3d444e" />
        </linearGradient>
        <linearGradient id={`wood-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dcb48a" />
          <stop offset="1" stopColor="#c99b6c" />
        </linearGradient>
        <radialGradient id={`glow-${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffb866" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffb866" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Wall and backsplash */}
      <rect width="600" height="480" fill="#f4ece1" />
      <rect y="250" width="600" height="222" fill={`url(#tiles-${uid})`} />

      {/* Window with a herb on the sill */}
      <g className="window">
        <rect x="30" y="34" width="152" height="118" rx="10" fill="#ffffff" />
        <rect x="40" y="44" width="132" height="98" rx="5" fill={`url(#sky-${uid})`} />
        <circle className="sun" cx="146" cy="70" r="13" fill="#ffe3a3" />
        <path className="cloud" d="M58 104 q6 -12 18 -6 q8 -10 18 0 q10 0 8 10 h-46 z" fill="#ffffff" opacity="0.9" />
        <rect x="104" y="44" width="4" height="98" fill="#ffffff" />
        <rect x="40" y="91" width="132" height="4" fill="#ffffff" />
        <rect x="22" y="150" width="168" height="9" rx="4" fill="#e9dccb" />
        <g className="herb">
          <path d="M64 128 q-10 -14 -2 -26 q8 8 4 26" fill="#7fae6a" />
          <path d="M70 128 q2 -22 14 -28 q2 16 -10 28" fill="#6c9c58" />
          <path d="M72 128 q-18 -8 -20 -20 q14 0 22 16" fill="#8bbb74" />
        </g>
        <path d="M58 128 h26 l-4 22 h-18 z" fill="#d98e62" />
      </g>

      {/* Progress clock */}
      <g transform="translate(118 214)" className="clock" aria-label={`${pct}% cooked`}>
        <circle r="31" fill="#ffffff" stroke="rgba(120, 90, 60, 0.12)" strokeWidth="1.5" />
        <circle r="24" fill="none" stroke="#efe6da" strokeWidth="5" />
        <circle
          r="24"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="5"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${Math.max(0.5, pct)} 100`}
          transform="rotate(-90)"
          className="clock-arc"
        />
        <text y="4" textAnchor="middle" className="svg-label strong">
          {pct}%
        </text>
      </g>

      {/* Shelves with a jar per chapter */}
      {[118, 226].map((y) => (
        <g key={y}>
          <rect x="226" y={y} width="356" height="9" rx="3" fill="#d2a67b" />
          <rect x="226" y={y + 9} width="356" height="3" fill="rgba(90, 60, 30, 0.12)" />
          <path d={`M250 ${y + 9} v10 h8`} stroke="#c49a70" strokeWidth="3" fill="none" />
          <path d={`M558 ${y + 9} v10 h-8`} stroke="#c49a70" strokeWidth="3" fill="none" />
        </g>
      ))}
      {chapters.map((c, i) => {
        const theme = themeFor(c.step.id);
        const onShelf = i < 5 ? 0 : 1;
        const slot = onShelf === 0 ? i : i - 5;
        const x = 246 + slot * 68;
        const base = onShelf === 0 ? 118 : 226;
        const items = flow.slice(c.start, c.start + c.count);
        const done = mode === 'welcome' ? 0 : items.filter((f) => isAnswered(answers, f.q.id)).length / items.length;
        const isCurrent = mode === 'cooking' && c.step.id === currentStepId;
        const clip = `jar-${uid}-${i}`;
        return (
          <g
            key={c.step.id}
            className={`jar${isCurrent ? ' is-current' : ''}`}
            transform={`translate(${x} ${base - 62})`}
            {...pressable(`${theme.name}: go to this step`, onSelectChapter ? () => onSelectChapter(c.start) : undefined)}
          >
            <title>{`${theme.name} · ${Math.round(done * 100)}%`}</title>
            <g className="jar-body">
              <clipPath id={clip}>
                <rect x="4" y="12" width="40" height="50" rx="9" />
              </clipPath>
              <rect x="4" y="12" width="40" height="50" rx="9" fill="rgba(255, 255, 255, 0.6)" stroke="rgba(120, 90, 60, 0.22)" strokeWidth="1.5" />
              <g clipPath={`url(#${clip})`}>
                <rect className="jar-fill" x="4" y={62 - 50 * done} width="40" height={50 * done + 1} fill={theme.color} opacity="0.85" />
              </g>
              <rect x="10" y="18" width="4" height="30" rx="2" fill="rgba(255, 255, 255, 0.7)" />
              <rect x="8" y="4" width="32" height="10" rx="3" fill={theme.color} />
              <rect x="14" y="30" width="20" height="12" rx="2" fill="#fffdf8" opacity="0.92" />
              <text x="24" y="39.5" textAnchor="middle" className="svg-label tiny">
                {i + 1}
              </text>
            </g>
          </g>
        );
      })}

      {/* Pinned recipe note */}
      <g transform="translate(34 270) rotate(-4)" className="note" {...pressable('Open your recipe card', onOpenRecipe)}>
        <title>Your recipe card</title>
        <rect x="3" y="4" width="128" height="150" rx="6" fill="rgba(90, 60, 30, 0.08)" />
        <rect width="128" height="150" rx="6" fill="#fffdf7" />
        <circle cx="64" cy="10" r="5" fill="var(--accent)" />
        <text x="14" y="34" className="svg-label title">
          {(name || 'My recipe').slice(0, 15)}
        </text>
        {Array.from({ length: 7 }).map((_, k) => {
          const filled = mode !== 'welcome' && k < Math.round(progress * 7);
          return (
            <rect
              key={k}
              x="14"
              y={48 + k * 13}
              width={96 - (k % 3) * 18}
              height="4"
              rx="2"
              fill={filled ? themeFor(chapters[k % Math.max(1, chapters.length)]?.step.id ?? 'idea').color : '#ece4d8'}
              className="note-line"
            />
          );
        })}
      </g>

      {/* Hanging utensils */}
      <g className="utensils">
        <rect x="506" y="266" width="76" height="4" rx="2" fill="#b98f66" />
        <g className="swing">
          <path d="M522 270 v44" stroke="#9aa3ad" strokeWidth="3" strokeLinecap="round" />
          <ellipse cx="522" cy="322" rx="10" ry="8" fill="#9aa3ad" />
        </g>
        <g className="swing swing-2">
          <path d="M546 270 v36" stroke="#c79a6c" strokeWidth="3" strokeLinecap="round" />
          <rect x="538" y="304" width="16" height="22" rx="5" fill="#c79a6c" />
        </g>
        <g className="swing swing-3">
          <path d="M568 270 v26" stroke="#9aa3ad" strokeWidth="2" strokeLinecap="round" />
          <path d="M568 296 q-10 16 0 32 q10 -16 0 -32 M568 296 q-4 16 0 32 q4 -16 0 -32" stroke="#9aa3ad" strokeWidth="1.6" fill="none" />
        </g>
      </g>

      {/* Counter */}
      <rect y="470" width="600" height="18" fill="#ecd3b2" />
      <rect y="470" width="600" height="3" fill="#f6e6d0" />
      <rect y="488" width="600" height="152" fill={`url(#wood-${uid})`} />
      <rect x="18" y="596" width="266" height="60" rx="6" fill="none" stroke="rgba(90, 60, 30, 0.14)" strokeWidth="2" />
      <rect x="316" y="596" width="266" height="60" rx="6" fill="none" stroke="rgba(90, 60, 30, 0.14)" strokeWidth="2" />
      <rect x="126" y="604" width="50" height="5" rx="2.5" fill="rgba(90, 60, 30, 0.22)" />
      <rect x="424" y="604" width="50" height="5" rx="2.5" fill="rgba(90, 60, 30, 0.22)" />

      {/* Stove knobs set the prompt level */}
      {LEVELS.map((l, i) => {
        const active = level === l.value;
        return (
          <g
            key={l.value}
            transform={`translate(${358 + i * 62} 532)`}
            className={`knob${active ? ' is-active' : ''}`}
            {...pressable(`Set prompt level to ${l.label}`, onSetLevel ? () => onSetLevel(l.value) : undefined)}
          >
            <title>{`${l.label} prompt`}</title>
            {active && <circle r="21" fill="none" stroke="var(--accent)" strokeWidth="2.5" opacity="0.8" />}
            <circle r="16" fill="#fffaf3" stroke="rgba(90, 60, 30, 0.2)" strokeWidth="1.5" />
            <g className="knob-dial" style={{ transform: `rotate(${active ? 90 : -30}deg)` } as CSSProperties}>
              <circle r="14" fill="transparent" />
              <rect x="-2" y="-13" width="4" height="11" rx="2" fill={active ? 'var(--accent)' : '#9b8b7a'} />
            </g>
            <text y="36" textAnchor="middle" className={`svg-label knob-label${active ? ' strong' : ''}`}>
              {l.label}
            </text>
          </g>
        );
      })}

      {/* Cooktop and flames */}
      <ellipse cx="420" cy="462" rx="120" ry="26" fill={`url(#glow-${uid})`} style={{ opacity: heat } as CSSProperties} className="stove-glow" />
      <rect x="290" y="460" width="260" height="12" rx="6" fill="#3a3632" />
      <g transform="translate(420 462)" className="flames">
        {[-44, -22, 0, 22, 44].map((dx, i) => (
          <g key={dx} transform={`translate(${dx} 0) scale(${(0.5 + heat * 0.7).toFixed(3)})`}>
            <g className="flame" style={{ animationDelay: `${i * 0.13}s` }}>
              <path d="M0 0 C -7 -6 -6 -14 0 -22 C 6 -14 7 -6 0 0 Z" fill="#f79a3e" />
              <path d="M0 0 C -3.5 -4 -3 -9 0 -13 C 3 -9 3.5 -4 0 0 Z" fill="#ffd66b" />
            </g>
          </g>
        ))}
      </g>

      {/* Steam */}
      <g className="steam" style={{ opacity: mode === 'welcome' ? 0.35 : 0.3 + progress * 0.7 } as CSSProperties}>
        {[392, 420, 448].map((x, i) => (
          <path
            key={x}
            className="steam-wisp"
            style={{ animationDelay: `${i * 0.9}s` }}
            d={`M${x} 310 c -10 -14 10 -26 0 -40 c -10 -14 10 -26 0 -40`}
            stroke="#ffffff"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />
        ))}
      </g>

      {/* Pot */}
      <g transform="translate(0 -16)">
      <g className={`pot pot-${serveStage}`} {...pressable('Taste it: preview your prompt', mode === 'welcome' ? onStart : onTaste)}>
        <title>{mode === 'welcome' ? 'Start cooking' : 'Taste it: preview your prompt'}</title>
        <rect x="316" y="370" width="26" height="11" rx="5.5" fill="#39404a" />
        <rect x="498" y="370" width="26" height="11" rx="5.5" fill="#39404a" />
        <path d="M336 344 L336 438 Q336 460 360 460 L480 460 Q504 460 504 438 L504 344 Z" fill={`url(#pot-${uid})`} />
        <rect x="336" y="394" width="168" height="7" fill="var(--accent)" opacity="0.92" />
        <rect x="350" y="356" width="9" height="84" rx="4.5" fill="rgba(255, 255, 255, 0.12)" />
        <ellipse cx="420" cy="344" rx="86" ry="16" fill="#343a42" />
        <ellipse className="broth" cx="420" cy="346" rx="78" ry="12" style={{ fill: mixture } as CSSProperties} />
        <ellipse cx="400" cy="343" rx="30" ry="4" fill="rgba(255, 255, 255, 0.25)" />

        {mode !== 'welcome' &&
          surfacePieces.map((f, i) => {
            const h = hash(f.q.id);
            const theme = themeFor(f.step.id);
            const a = ((h % 360) * Math.PI) / 180;
            const r = Math.sqrt(((h >>> 9) % 100) / 100) * 0.8;
            return (
              <g key={f.q.id} transform={`translate(${420 + Math.cos(a) * 62 * r} ${346 + Math.sin(a) * 8 * r})`}>
                <g className="float" style={{ animationDelay: `${(i % 5) * 0.35}s` }}>
                  <g transform={`rotate(${(h >>> 3) % 180}) scale(0.62)`}>
                    <Ingredient shape={theme.shape} color={theme.color} size={6} />
                  </g>
                </g>
              </g>
            );
          })}

        {Array.from({ length: Math.ceil(heat * 6) }).map((_, i) => (
          <circle key={i} className="bubble" cx={372 + ((i * 37) % 96)} cy={347 + (i % 3) * 2} r={2.5 + (i % 3)} style={{ animationDelay: `${i * 0.45}s` }} />
        ))}
      </g>
      </g>

      {/* Pour stream while serving */}
      {serveStage === 'pouring' && (
        <path className="stream" d="M300 330 C 262 344 244 396 232 446" stroke={mixture} strokeWidth="11" strokeLinecap="round" fill="none" />
      )}

      {/* Cutting board with the next ingredient, or a plate when serving */}
      {mode === 'serve' ? (
        <g transform="translate(150 462)" className="plate">
          <ellipse cy="8" rx="92" ry="14" fill="rgba(90, 60, 30, 0.12)" />
          <ellipse rx="88" ry="19" fill="#ffffff" stroke="rgba(90, 60, 30, 0.12)" strokeWidth="1.5" />
          <ellipse rx="60" ry="12" fill="#f5efe7" />
          {serveStage === 'plated' && (
            <g className="dish">
              <ellipse cy="-6" rx="50" ry="16" fill={mixture} />
              <ellipse cx="-12" cy="-12" rx="22" ry="5" fill="rgba(255, 255, 255, 0.28)" />
              {garnish.map((f, i) => {
                const theme = themeFor(f.step.id);
                const h = hash(f.q.id);
                return (
                  <g key={f.q.id} transform={`translate(${-36 + ((h % 72) | 0)} ${-10 + (i % 3) * 3 - 3})`}>
                    <g transform={`rotate(${(h >>> 4) % 180}) scale(0.7)`}>
                      <Ingredient shape={theme.shape} color={theme.color} size={6} />
                    </g>
                  </g>
                );
              })}
            </g>
          )}
        </g>
      ) : (
        <g className="board">
          <rect x="44" y="452" width="190" height="18" rx="9" fill="#c99a69" />
          <rect x="44" y="446" width="190" height="16" rx="8" fill="#e3bd8f" />
          <circle cx="216" cy="454" r="4" fill="#c99a69" />
          <path d="M252 460 l70 -8 q10 0 6 6 l-60 8 z" fill="#d7dde3" />
          <rect x="236" y="458" width="20" height="8" rx="3" fill="#3f3a35" transform="rotate(-6 246 462)" />
          <g transform="translate(126 440)">
            <g key={`${currentStepId}-${cook?.tick ?? 0}`} className="board-item">
              <g transform="scale(2.3)">
                <Ingredient shape={boardTheme.shape} color={boardTheme.color} size={7} />
              </g>
            </g>
          </g>
          <text x="139" y="512" textAnchor="middle" className="svg-label board-label">
            {mode === 'welcome' ? 'Your idea goes in first' : `Next in: ${boardTheme.ingredient}`}
          </text>
        </g>
      )}

      {/* Ingredients flying into the pot */}
      {flights.map((f) => {
        const theme = themeFor(f.stepId);
        return (
          <g key={f.key}>
            <g className="flight">
              <Ingredient shape={theme.shape} color={theme.color} size={11} />
            </g>
            <ellipse className="splash" cx="420" cy="330" rx="24" ry="6" fill="none" stroke="#ffffff" strokeWidth="3" />
          </g>
        );
      })}
    </svg>
  );
}
