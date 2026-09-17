import { useEffect, useId, useRef, useState, type CSSProperties, type DragEvent, type KeyboardEvent, type PointerEvent } from 'react';
import type { AnswerValue, Answers, FieldType, Level } from '../types';
import { LEVELS, getLevel, isAnswered, str } from '../lib/answers';
import { optionLabel } from '../lib/reader';
import { STATIONS, stationFor, themeFor } from '../data/kitchen';
import type { Chapter, FlowItem } from './Journey';
import type { KitchenAction } from './Controls';
import { DRAG_TYPE } from './Controls';
import { Chef, type ChefState } from './Chef';
import { Ingredient } from './Ingredient';

export type FinaleStage = 'ready' | 'plating' | 'covered' | 'revealed' | 'printing' | 'done';

interface WorldProps {
  mode: 'welcome' | 'cooking' | 'finale';
  station: number;
  /** Station the camera starts at before gliding to `station`. */
  enterFrom?: number;
  chapters: Chapter[];
  flow: FlowItem[];
  answers: Answers;
  currentStepId?: string;
  currentType?: FieldType;
  currentValue?: AnswerValue;
  action?: { type: KitchenAction; tick: number; stepId: string };
  chef: ChefState;
  finale?: FinaleStage;
  bellTick?: number;
  /** Zoom in on the plate for the full-screen serving moment. */
  focus?: boolean;
  onSelectChapter?: (index: number) => void;
  onSelectStation?: (station: number) => void;
  onSetLevel?: (level: Level) => void;
  onTaste?: () => void;
  onChef?: () => void;
  onOpenRecipe?: () => void;
  onStart?: () => void;
  onLiftCloche?: () => void;
  onBell?: () => void;
  onDropIngredient?: (qid: string, value: string) => void;
}

const W = 600;
const VESSELS = [
  { x: 430, y: 426 },
  { x: 1010, y: 420 },
  { x: 1590, y: 330 },
  { x: 2100, y: 440 },
];
const BROTH: [number, number, number] = [244, 222, 178];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mixture(items: FlowItem[]): string {
  if (!items.length) return `rgb(${BROTH.join(',')})`;
  const sum = [0, 0, 0];
  for (const f of items) {
    const n = parseInt(themeFor(f.step.id).color.slice(1), 16);
    sum[0] += (n >> 16) & 255;
    sum[1] += (n >> 8) & 255;
    sum[2] += n & 255;
  }
  const k = Math.min(0.55, 0.2 + items.length / 80);
  return `rgb(${BROTH.map((b, i) => Math.round(b * (1 - k) + (sum[i] / items.length) * k)).join(',')})`;
}

function useMedia(query: string): boolean {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatch(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return match;
}

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

type Flight = { key: number; kind: 'in' | 'out' | 'coin'; stepId: string; station: number };

export function World(props: WorldProps) {
  const {
    mode,
    station,
    enterFrom,
    chapters,
    flow,
    answers,
    currentStepId,
    currentType,
    currentValue,
    action,
    chef,
    finale,
    bellTick = 0,
    focus = false,
    onSelectChapter,
    onSelectStation,
    onSetLevel,
    onTaste,
    onChef,
    onOpenRecipe,
    onStart,
    onLiftCloche,
    onBell,
    onDropIngredient,
  } = props;

  const uid = useId().replace(/:/g, '');
  const compact = useMedia('(max-width: 960px)');
  const reduced = useMedia('(prefers-reduced-motion: reduce)');
  const [cam, setCam] = useState(enterFrom ?? station);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [dropping, setDropping] = useState(false);
  const [flights, setFlights] = useState<Flight[]>([]);
  const timers = useRef<number[]>([]);
  const lastTick = useRef(action?.tick ?? 0);
  const frame = useRef(0);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  // Glide to the station (after a beat when entering from somewhere else).
  useEffect(() => {
    const t = window.setTimeout(() => setCam(station), enterFrom !== undefined && cam === enterFrom ? 120 : 0);
    return () => window.clearTimeout(t);
  }, [station]);

  // Turn actions into things happening in the kitchen.
  useEffect(() => {
    if (!action || action.tick === lastTick.current) return;
    lastTick.current = action.tick;
    const kind = action.type === 'coin' ? 'coin' : action.type === 'remove' ? 'out' : action.type === 'add' || action.type === 'pick' ? 'in' : null;
    if (!kind || reduced) return;
    const flight: Flight = { key: action.tick, kind, stepId: action.stepId, station: stationFor(action.stepId) };
    setFlights((f) => [...f.slice(-6), flight]);
    timers.current.push(window.setTimeout(() => setFlights((f) => f.filter((x) => x.key !== flight.key)), 1200));
  }, [action, reduced]);

  const added = mode === 'welcome' ? [] : flow.filter((f) => isAnswered(answers, f.q.id));
  const atStation = (i: number) => added.filter((f) => stationFor(f.step.id) === i);
  const progress = mode === 'welcome' || !flow.length ? 0 : added.length / flow.length;
  const level = getLevel(answers);
  const name = str(answers, 'projectName');
  const heat = mode === 'welcome' ? 0.35 : mode === 'finale' ? 0.85 : 0.35 + progress * 0.65;
  const pct = Math.round(progress * 100);
  const theme = themeFor(currentStepId ?? 'idea');
  const chopKey = action?.type === 'chop' ? action.tick : -1;
  const stirKey = action?.type === 'stir' ? action.tick : -1;
  const tickKey = action?.type === 'tick' ? action.tick : -1;

  const slices = (() => {
    if (currentType === 'text' || currentType === 'textarea') {
      return typeof currentValue === 'string' ? Math.min(14, currentValue.trim().split(/\s+/).filter(Boolean).length) : 0;
    }
    return 0;
  })();

  const chapterDone = (c: Chapter) => {
    if (mode === 'welcome') return 0;
    const items = flow.slice(c.start, c.start + c.count);
    return items.filter((f) => isAnswered(answers, f.q.id)).length / items.length;
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reduced || e.pointerType !== 'mouse') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * -14;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -6;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => setParallax({ x, y }));
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!onDropIngredient || !e.dataTransfer.types.includes(DRAG_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDropping(true);
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    setDropping(false);
    const raw = e.dataTransfer.getData(DRAG_TYPE);
    if (!raw || !onDropIngredient) return;
    e.preventDefault();
    try {
      const { qid, value } = JSON.parse(raw) as { qid: string; value: string };
      onDropIngredient(qid, value);
    } catch {
      /* ignore malformed drops */
    }
  };

  const camX = -cam * W;
  const viewBox = focus ? (compact ? '120 262 360 280' : '70 258 460 300') : compact ? '0 250 600 390' : '0 0 600 640';

  return (
    <div
      className={`world world-${mode}${focus ? ' is-focused' : ''}${dropping ? ' is-dropping' : ''}`}
      onPointerMove={onPointerMove}
      onPointerLeave={() => setParallax({ x: 0, y: 0 })}
      onDragOver={onDragOver}
      onDragLeave={() => setDropping(false)}
      onDrop={onDrop}
    >
      <svg className="world-svg" viewBox={viewBox} preserveAspectRatio="xMidYMax meet" role="group" aria-label={`Kitchen, ${STATIONS[cam]?.name ?? ''}`}>
        <defs>
          <pattern id={`tiles-${uid}`} width="46" height="24" patternUnits="userSpaceOnUse">
            <rect width="46" height="24" fill="#faf5ee" />
            <rect x="1" y="1" width="44" height="22" rx="3" fill="#fdfaf5" stroke="rgba(120,90,60,0.09)" />
          </pattern>
          <pattern id={`sage-${uid}`} width="30" height="30" patternUnits="userSpaceOnUse">
            <rect width="30" height="30" fill="#dfe7de" />
            <rect x="1" y="1" width="28" height="28" rx="3" fill="#e8efe6" stroke="rgba(70,90,70,0.1)" />
          </pattern>
          <pattern id={`slats-${uid}`} width="36" height="40" patternUnits="userSpaceOnUse">
            <rect width="36" height="40" fill="#ecdcc6" />
            <rect x="34" width="2" height="40" fill="rgba(120,90,60,0.12)" />
          </pattern>
          <linearGradient id={`steel-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#eef0f2" />
            <stop offset="0.5" stopColor="#dde1e5" />
            <stop offset="1" stopColor="#eceff1" />
          </linearGradient>
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
          <linearGradient id={`bowl-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#e7d9c6" />
          </linearGradient>
          <linearGradient id={`cloche-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#c4cad0" />
            <stop offset="0.35" stopColor="#f5f7f8" />
            <stop offset="1" stopColor="#aeb5bc" />
          </linearGradient>
          <linearGradient id={`rays-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff7e0" stopOpacity="0.55" />
            <stop offset="1" stopColor="#fff7e0" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={`glow-${uid}`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffb866" stopOpacity="0.55" />
            <stop offset="1" stopColor="#ffb866" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`lamp-${uid}`} cx="0.5" cy="0" r="1">
            <stop offset="0" stopColor="#ffd9a0" stopOpacity="0.5" />
            <stop offset="1" stopColor="#ffd9a0" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ---------------- Back layer: walls and everything on them ---------------- */}
        <g className="cam" style={{ transform: `translate(${camX}px, 0px)` }}>
          <g className="parallax" style={{ transform: `translate(${parallax.x * 0.45}px, ${parallax.y * 0.45}px)` }}>
            <rect x="-900" y="-900" width="4200" height="1372" fill="#f4ece1" />
            <rect x="-900" y="250" width="900" height="222" fill={`url(#tiles-${uid})`} />
            <rect x="0" y="250" width="600" height="222" fill={`url(#slats-${uid})`} />
            <rect x="600" y="250" width="600" height="222" fill={`url(#tiles-${uid})`} />
            <rect x="1200" y="250" width="600" height="222" fill={`url(#sage-${uid})`} />
            <rect x="1800" y="250" width="1500" height="222" fill={`url(#steel-${uid})`} />
            {[600, 1200, 1800].map((x) => (
              <rect key={x} x={x - 6} y="-900" width="12" height="1372" fill="rgba(120, 90, 60, 0.06)" />
            ))}

            <PantryWall
              uid={uid}
              chapters={chapters}
              chapterDone={chapterDone}
              currentStepId={mode === 'cooking' ? currentStepId : undefined}
              pct={pct}
              onSelectChapter={onSelectChapter}
            />
            <PrepWall answers={answers} mode={mode} />
            <StoveWall chapters={chapters} chapterDone={chapterDone} />
            <PassWall uid={uid} chapters={chapters} chapterDone={chapterDone} onSelectChapter={onSelectChapter} />
          </g>
        </g>

        {/* ---------------- Front layer: counters and everything on them ---------------- */}
        <g className="cam" style={{ transform: `translate(${camX}px, 0px)` }}>
          <g className="parallax" style={{ transform: `translate(${parallax.x}px, ${parallax.y}px)` }}>
            {/* Counter: wood, then steel at the pass */}
            <rect x="-900" y="470" width="2700" height="18" fill="#ecd3b2" />
            <rect x="-900" y="470" width="2700" height="3" fill="#f6e6d0" />
            <rect x="-900" y="488" width="2700" height="600" fill={`url(#wood-${uid})`} />
            <rect x="1800" y="470" width="1500" height="18" fill="#e3e7ea" />
            <rect x="1800" y="470" width="1500" height="3" fill="#f7f9fa" />
            <rect x="1800" y="488" width="1500" height="600" fill="#cdd3d8" />
            {Array.from({ length: 8 }).map((_, i) => (
              <g key={i}>
                <rect x={18 + i * 300} y="596" width="264" height="120" rx="6" fill="none" stroke="rgba(90, 60, 30, 0.14)" strokeWidth="2" />
                <rect x={125 + i * 300} y="604" width="50" height="5" rx="2.5" fill="rgba(90, 60, 30, 0.22)" />
              </g>
            ))}

            <PantryCounter answers={answers} mode={mode} name={name} items={atStation(0)} onOpenRecipe={onOpenRecipe} />
            <PrepCounter
              answers={answers}
              mode={mode}
              items={atStation(1)}
              theme={theme}
              slices={stationFor(currentStepId) === 1 || mode === 'welcome' ? slices : 0}
              chopKey={chopKey}
              crateActive={mode === 'cooking' && currentType === 'multi'}
            />
            <StoveCounter
              uid={uid}
              answers={answers}
              mode={mode}
              level={level}
              heat={heat}
              items={atStation(2)}
              allItems={added}
              stirKey={stirKey}
              tickKey={tickKey}
              onSetLevel={onSetLevel}
              onTaste={mode === 'welcome' ? onStart : onTaste}
            />
            <PassCounter
              uid={uid}
              items={atStation(3)}
              allItems={added}
              finale={finale}
              bellTick={bellTick}
              onLiftCloche={onLiftCloche}
              onBell={onBell}
            />

            {flights.map((f) => (
              <FlightPiece key={f.key} flight={f} />
            ))}
          </g>
        </g>
      </svg>

      <div className="world-light" aria-hidden="true" />

      <nav className="world-stations" aria-label="Kitchen stations">
        {STATIONS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={`world-station${i === cam ? ' is-here' : ''}`}
            onClick={onSelectStation ? () => onSelectStation(i) : undefined}
            disabled={!onSelectStation}
            aria-current={i === cam ? 'location' : undefined}
          >
            <span className="world-station-dot" />
            <span className="world-station-name">{s.name}</span>
          </button>
        ))}
      </nav>

      {dropping && <div className="world-drop">Drop it in</div>}

      <Chef state={chef} onClick={onChef} compact={compact} />
    </div>
  );
}

/* ================================================================== */
/* Flights                                                             */
/* ================================================================== */

function FlightPiece({ flight }: { flight: Flight }) {
  const theme = themeFor(flight.stepId);
  if (flight.kind === 'coin') {
    const style = { '--x0': '1300px', '--y0': '330px', '--x1': '1300px', '--y1': '432px' } as CSSProperties;
    return (
      <g className="flight flight-coin" style={style}>
        <ellipse rx="9" ry="9" fill="#f2c14e" stroke="#d99f2b" strokeWidth="2" />
      </g>
    );
  }
  const v = VESSELS[flight.station];
  const from = flight.station === 1 ? { x: 740, y: 420 } : { x: v.x - 190, y: 250 };
  const style = (flight.kind === 'in'
    ? { '--x0': `${from.x}px`, '--y0': `${from.y}px`, '--xm': `${(from.x + v.x) / 2}px`, '--ym': `${Math.min(from.y, v.y) - 150}px`, '--x1': `${v.x}px`, '--y1': `${v.y}px` }
    : { '--x0': `${v.x}px`, '--y0': `${v.y}px`, '--xm': `${v.x + 70}px`, '--ym': `${v.y - 150}px`, '--x1': `${v.x + 150}px`, '--y1': `${v.y - 60}px` }) as CSSProperties;
  return (
    <g>
      <g className={`flight flight-${flight.kind}`} style={style}>
        <Ingredient shape={theme.shape} color={theme.color} size={11} />
      </g>
      {flight.kind === 'in' && <ellipse className="splash" cx={v.x} cy={v.y} rx="26" ry="6" fill="none" stroke="#ffffff" strokeWidth="3" />}
    </g>
  );
}

function Pieces({ items, spreadX, spreadY, scale = 0.62, float = false }: { items: FlowItem[]; spreadX: number; spreadY: number; scale?: number; float?: boolean }) {
  return (
    <>
      {items.map((f, i) => {
        const h = hash(f.q.id);
        const t = themeFor(f.step.id);
        const a = ((h % 360) * Math.PI) / 180;
        const r = Math.sqrt(((h >>> 9) % 100) / 100) * 0.85;
        return (
          <g key={f.q.id} transform={`translate(${(Math.cos(a) * spreadX * r).toFixed(1)} ${(Math.sin(a) * spreadY * r).toFixed(1)})`}>
            <g className={float ? 'float' : 'settle'} style={{ animationDelay: `${(i % 6) * 0.3}s` }}>
              <g transform={`rotate(${(h >>> 3) % 180}) scale(${scale})`}>
                <Ingredient shape={t.shape} color={t.color} size={6} />
              </g>
            </g>
          </g>
        );
      })}
    </>
  );
}

/* ================================================================== */
/* Pantry                                                              */
/* ================================================================== */

function PantryWall({
  uid,
  chapters,
  chapterDone,
  currentStepId,
  pct,
  onSelectChapter,
}: {
  uid: string;
  chapters: Chapter[];
  chapterDone: (c: Chapter) => number;
  currentStepId?: string;
  pct: number;
  onSelectChapter?: (i: number) => void;
}) {
  return (
    <g>
      {/* Window and light */}
      <polygon points="196,60 196,168 420,470 250,470" fill={`url(#rays-${uid})`} className="rays" />
      <rect x="36" y="40" width="160" height="126" rx="10" fill="#ffffff" />
      <rect x="46" y="50" width="140" height="106" rx="5" fill={`url(#sky-${uid})`} />
      <circle className="sun" cx="158" cy="78" r="13" fill="#ffe3a3" />
      <path className="cloud" d="M64 114 q6 -12 18 -6 q8 -10 18 0 q10 0 8 10 h-46 z" fill="#ffffff" opacity="0.9" />
      <rect x="114" y="50" width="4" height="106" fill="#ffffff" />
      <rect x="46" y="101" width="140" height="4" fill="#ffffff" />
      <rect x="28" y="164" width="176" height="9" rx="4" fill="#e9dccb" />
      <g className="herb">
        <path d="M70 142 q-10 -14 -2 -26 q8 8 4 26" fill="#7fae6a" />
        <path d="M76 142 q2 -22 14 -28 q2 16 -10 28" fill="#6c9c58" />
        <path d="M78 142 q-18 -8 -20 -20 q14 0 22 16" fill="#8bbb74" />
      </g>
      <path d="M64 142 h26 l-4 22 h-18 z" fill="#d98e62" />

      {/* Progress clock */}
      <g transform="translate(118 234)">
        <circle r="31" fill="#ffffff" stroke="rgba(120,90,60,0.12)" strokeWidth="1.5" />
        <circle r="24" fill="none" stroke="#efe6da" strokeWidth="5" />
        <circle className="clock-arc" r="24" fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" pathLength={100} strokeDasharray={`${Math.max(0.5, pct)} 100`} transform="rotate(-90)" />
        <text y="4" textAnchor="middle" className="svg-label strong">
          {pct}%
        </text>
      </g>

      {/* Shelving with a jar per chapter */}
      <rect x="248" y="30" width="8" height="280" rx="3" fill="#c49a70" />
      <rect x="544" y="30" width="8" height="280" rx="3" fill="#c49a70" />
      {[118, 226].map((y) => (
        <g key={y}>
          <rect x="240" y={y} width="320" height="9" rx="3" fill="#d2a67b" />
          <rect x="240" y={y + 9} width="320" height="3" fill="rgba(90,60,30,0.12)" />
        </g>
      ))}
      {chapters.map((c, i) => {
        const t = themeFor(c.step.id);
        const row = i < 5 ? 0 : 1;
        const x = 262 + (row === 0 ? i : i - 5) * 56;
        const base = row === 0 ? 118 : 226;
        const done = chapterDone(c);
        const clip = `jar-${uid}-${i}`;
        return (
          <g
            key={c.step.id}
            className={`jar${c.step.id === currentStepId ? ' is-current' : ''}`}
            transform={`translate(${x} ${base - 62})`}
            {...pressable(`${t.name}: go to this step`, onSelectChapter ? () => onSelectChapter(c.start) : undefined)}
          >
            <title>{`${t.name} · ${Math.round(done * 100)}%`}</title>
            <g className="jar-body">
              <clipPath id={clip}>
                <rect x="4" y="12" width="40" height="50" rx="9" />
              </clipPath>
              <rect x="4" y="12" width="40" height="50" rx="9" fill="rgba(255,255,255,0.6)" stroke="rgba(120,90,60,0.22)" strokeWidth="1.5" />
              <g clipPath={`url(#${clip})`}>
                <rect className="jar-fill" x="4" y={62 - 50 * done} width="40" height={50 * done + 1} fill={t.color} opacity="0.85" />
              </g>
              <rect x="10" y="18" width="4" height="30" rx="2" fill="rgba(255,255,255,0.7)" />
              <rect x="8" y="4" width="32" height="10" rx="3" fill={t.color} />
              <rect x="14" y="30" width="20" height="12" rx="2" fill="#fffdf8" opacity="0.92" />
              <text x="24" y="39.5" textAnchor="middle" className="svg-label tiny">
                {i + 1}
              </text>
            </g>
          </g>
        );
      })}
    </g>
  );
}

function PantryCounter({
  answers,
  mode,
  name,
  items,
  onOpenRecipe,
}: {
  answers: Answers;
  mode: WorldProps['mode'];
  name: string;
  items: FlowItem[];
  onOpenRecipe?: () => void;
}) {
  const oneLiner = str(answers, 'oneLiner');
  return (
    <g>
      {/* Recipe book on a stand */}
      <g className="book" {...pressable('Open your recipe card', onOpenRecipe)}>
        <title>Your recipe card</title>
        <path d="M86 470 L122 402 L158 470" fill="none" stroke="#a97b52" strokeWidth="6" strokeLinecap="round" />
        <g transform="translate(122 420) rotate(-8)">
          <path d="M-72 -46 Q -36 -54 0 -44 L 0 30 Q -36 20 -72 28 Z" fill="#fffdf6" stroke="rgba(90,60,30,0.18)" strokeWidth="1.5" />
          <path d="M72 -46 Q 36 -54 0 -44 L 0 30 Q 36 20 72 28 Z" fill="#fffaf0" stroke="rgba(90,60,30,0.18)" strokeWidth="1.5" />
          <text x="-64" y="-26" className="svg-label title">
            {(name || 'My recipe').slice(0, 11)}
          </text>
          {[0, 1, 2, 3].map((k) => (
            <rect key={k} x="-64" y={-14 + k * 10} width={50 - (k % 2) * 14} height="3" rx="1.5" fill={mode !== 'welcome' && oneLiner && k < 3 ? '#cdbba4' : '#ece4d8'} />
          ))}
          {[0, 1, 2, 3, 4].map((k) => (
            <rect key={k} x="10" y={-34 + k * 11} width={52 - (k % 3) * 12} height="3" rx="1.5" fill={k < Math.round((items.length / 8) * 5) ? 'var(--accent)' : '#ece4d8'} opacity="0.7" />
          ))}
        </g>
      </g>

      {/* Basket for pantry answers */}
      <g transform={`translate(${VESSELS[0].x} ${VESSELS[0].y})`} className="vessel">
        <ellipse cy="48" rx="66" ry="8" fill="rgba(90,60,30,0.12)" />
        <path d="M-58 -2 Q 0 -86 58 -2" fill="none" stroke="#b58456" strokeWidth="7" strokeLinecap="round" />
        <ellipse rx="70" ry="16" fill="#9c6c42" />
        <Pieces items={items} spreadX={52} spreadY={9} scale={0.75} />
        <path d="M-70 0 C -66 36 -50 48 0 48 C 50 48 66 36 70 0 Z" fill="#c8955f" />
        {[12, 24, 36].map((y) => (
          <path key={y} d={`M${-68 + y / 6} ${y} Q 0 ${y + 10} ${68 - y / 6} ${y}`} fill="none" stroke="rgba(90,55,25,0.25)" strokeWidth="2" />
        ))}
        {[-44, -22, 0, 22, 44].map((x) => (
          <path key={x} d={`M${x} 4 L ${x * 0.8} 46`} stroke="rgba(90,55,25,0.18)" strokeWidth="2" />
        ))}
        <ellipse rx="70" ry="16" fill="none" stroke="#b58456" strokeWidth="4" />
      </g>
    </g>
  );
}

/* ================================================================== */
/* Prep counter                                                        */
/* ================================================================== */

const GUESTS: Record<string, number> = { me: 1, small: 3, thousands: 6, large: 10 };

function PrepWall({ answers, mode }: { answers: Answers; mode: WorldProps['mode'] }) {
  const scale = mode === 'welcome' ? '' : str(answers, 'scale');
  const users = mode === 'welcome' ? '' : str(answers, 'targetUsers');
  const platform = mode === 'welcome' ? '' : str(answers, 'platform');
  const guests = GUESTS[scale] ?? 0;
  return (
    <g>
      {/* Chalkboard: tonight's guests */}
      <rect x="636" y="44" width="212" height="152" rx="8" fill="#b88a5e" />
      <rect x="646" y="54" width="192" height="132" rx="4" fill="#3f4a44" />
      <text x="742" y="80" textAnchor="middle" className="svg-label chalk">
        Tonight’s guests
      </text>
      {Array.from({ length: guests }).map((_, i) => (
        <g key={i} transform={`translate(${672 + (i % 5) * 34} ${106 + Math.floor(i / 5) * 30})`} className="guest" style={{ animationDelay: `${i * 0.06}s` }}>
          <circle r="6" fill="none" stroke="#f3f0e6" strokeWidth="2" />
          <path d="M-10 18 Q 0 4 10 18" fill="none" stroke="#f3f0e6" strokeWidth="2" strokeLinecap="round" />
        </g>
      ))}
      {!guests && (
        <text x="742" y="126" textAnchor="middle" className="svg-label chalk faint">
          Who’s coming?
        </text>
      )}
      <text x="742" y="174" textAnchor="middle" className="svg-label chalk small">
        {users ? (users.length > 30 ? `${users.slice(0, 29)}…` : users) : ''}
      </text>

      {/* Menu card: today's dish */}
      <g transform="translate(900 60)">
        <rect width="150" height="96" rx="6" fill="#fffdf7" stroke="rgba(90,60,30,0.14)" strokeWidth="1.5" />
        <rect x="8" y="8" width="134" height="80" rx="3" fill="none" stroke="rgba(242,107,58,0.35)" strokeWidth="1.5" strokeDasharray="4 4" />
        <text x="75" y="34" textAnchor="middle" className="svg-label">
          Today’s dish
        </text>
        <text x="75" y="60" textAnchor="middle" className="svg-label title">
          {platform ? optionLabel('platform', platform) : '…'}
        </text>
      </g>

      {/* Knife strip */}
      <rect x="920" y="286" width="170" height="10" rx="5" fill="#4b4540" />
      {[940, 978, 1016, 1054].map((x, i) => (
        <g key={x} className="swing" style={{ animationDelay: `${i * 0.4}s` }}>
          <rect x={x - 4} y="296" width="8" height="18" rx="2" fill="#3f3a35" />
          <path d={`M${x - 5} 314 h10 l-1 ${40 + (i % 2) * 8} q-4 6 -8 0 z`} fill="#d7dde3" />
        </g>
      ))}
    </g>
  );
}

function PrepCounter({
  answers,
  mode,
  items,
  theme,
  slices,
  chopKey,
  crateActive,
}: {
  answers: Answers;
  mode: WorldProps['mode'];
  items: FlowItem[];
  theme: ReturnType<typeof themeFor>;
  slices: number;
  chopKey: number;
  crateActive: boolean;
}) {
  const features = mode === 'welcome' ? 0 : Array.isArray(answers.coreFeatures) ? answers.coreFeatures.filter((x) => x.trim()).length : 0;
  const v = VESSELS[1];
  return (
    <g>
      {/* Cutting board, knife, and slices */}
      <rect x="640" y="452" width="190" height="18" rx="9" fill="#c99a69" />
      <rect x="640" y="446" width="190" height="16" rx="8" fill="#e3bd8f" />
      <circle cx="812" cy="454" r="4" fill="#c99a69" />
      <g transform="translate(700 438)">
        <g key={`${theme.name}`} className="board-item">
          <g transform="scale(1.9)">
            <Ingredient shape={theme.shape} color={theme.color} size={7} />
          </g>
        </g>
      </g>
      {Array.from({ length: slices }).map((_, i) => (
        <ellipse key={i} className="slice" cx={740 + (i % 7) * 11} cy={446 - Math.floor(i / 7) * 5} rx="4" ry="6" fill={theme.color} opacity="0.85" transform={`rotate(-20 ${740 + (i % 7) * 11} ${446 - Math.floor(i / 7) * 5})`} />
      ))}
      <g key={chopKey} className={`knife${chopKey >= 0 ? ' is-chopping' : ''}`}>
        <path d="M770 432 l62 -10 q10 0 6 7 l-58 12 z" fill="#d7dde3" />
        <rect x="826" y="418" width="30" height="9" rx="3" fill="#3f3a35" transform="rotate(-9 841 422)" />
      </g>

      {/* Prep bowls: one per must-have feature */}
      {Array.from({ length: Math.min(8, features) }).map((_, i) => {
        const x = 862 + (i % 4) * 28;
        const y = 468 - Math.floor(i / 4) * 22;
        return (
          <g key={i} transform={`translate(${x} ${y})`} className="ramekin" style={{ animationDelay: `${i * 0.05}s` }}>
            <path d="M-12 -8 L -9 2 Q 0 5 9 2 L 12 -8 Z" fill="#ffffff" stroke="rgba(90,60,30,0.16)" strokeWidth="1" />
            <ellipse cy="-8" rx="12" ry="3.5" fill="#78a565" />
          </g>
        );
      })}

      {/* Mixing bowl for prep answers */}
      <g transform={`translate(${v.x} ${v.y})`} className="vessel">
        <ellipse cy="54" rx="60" ry="8" fill="rgba(90,60,30,0.12)" />
        <path d="M-66 0 C -62 44 -34 54 0 54 C 34 54 62 44 66 0 Z" fill="#f7efe4" stroke="rgba(110,80,50,0.14)" strokeWidth="1.5" />
        <path d="M-56 26 C -40 42 40 42 56 26" fill="none" stroke="var(--accent)" strokeWidth="4" opacity="0.2" />
        <ellipse rx="66" ry="18" fill="#e3d6c3" />
        <ellipse cy="3" rx="56" ry="13" fill={mixture(items)} className="broth" />
        <Pieces items={items} spreadX={44} spreadY={8} />
        <ellipse rx="66" ry="18" fill="none" stroke="#ffffff" strokeWidth="3" />
      </g>

      {/* Crate of ingredients for multi-select questions */}
      <g transform="translate(1088 424)" className={`crate-art${crateActive ? ' is-active' : ''}`}>
        {crateActive && <rect x="-8" y="-24" width="92" height="76" rx="12" fill="var(--accent)" opacity="0.14" className="crate-glow" />}
        {[['#78a565', 18, -6], ['#e0708f', 38, -10], ['#f2b43c', 58, -5], ['#6f7fd4', 28, -14], ['#e0993a', 50, -16]].map(([c, x, y], i) => (
          <circle key={i} cx={x as number} cy={y as number} r="9" fill={c as string} />
        ))}
        <rect x="0" y="-4" width="76" height="48" rx="4" fill="#caa072" />
        {[8, 22, 36].map((y) => (
          <rect key={y} x="0" y={y} width="76" height="3" fill="rgba(90,55,25,0.25)" />
        ))}
        <rect x="-2" y="-6" width="80" height="6" rx="3" fill="#b88a5e" />
      </g>
    </g>
  );
}

/* ================================================================== */
/* Stove                                                               */
/* ================================================================== */

function StoveWall({ chapters, chapterDone }: { chapters: Chapter[]; chapterDone: (c: Chapter) => number }) {
  const quality = chapters.find((c) => c.step.id === 'quality');
  const tech = chapters.find((c) => c.step.id === 'tech');
  const checks = Math.round(((quality ? chapterDone(quality) : 0) * 0.6 + (tech ? chapterDone(tech) : 0) * 0.4) * 5);
  return (
    <g>
      {/* Clipboard: kitchen standards */}
      <g transform="translate(1250 70)">
        <rect width="112" height="148" rx="8" fill="#b88a5e" />
        <rect x="8" y="14" width="96" height="126" rx="3" fill="#fffdf7" />
        <rect x="36" y="-6" width="40" height="18" rx="4" fill="#9aa3ad" />
        <text x="56" y="36" textAnchor="middle" className="svg-label">
          Standards
        </text>
        {Array.from({ length: 5 }).map((_, i) => (
          <g key={i} transform={`translate(18 ${52 + i * 17})`}>
            <rect width="10" height="10" rx="2" fill="none" stroke="#b9ab98" strokeWidth="1.5" />
            {i < checks && <path className="tick-mark" d="M2 5 l2.5 3 l4 -6" fill="none" stroke="#3f8f5a" strokeWidth="2" strokeLinecap="round" />}
            <rect x="18" y="3" width={54 - (i % 3) * 10} height="4" rx="2" fill={i < checks ? '#cdbba4' : '#ece4d8'} />
          </g>
        ))}
      </g>

      {/* Range hood */}
      <path d="M1478 40 H1702 L1726 150 H1454 Z" fill="#e6e9ec" stroke="rgba(60,70,80,0.12)" strokeWidth="1.5" />
      <rect x="1528" y="-900" width="124" height="940" fill="#dde1e5" />
      <rect x="1460" y="146" width="260" height="10" rx="4" fill="#cfd4d9" />
      <rect x="1500" y="156" width="180" height="4" rx="2" fill="#ffe7b5" opacity="0.9" />

      {/* Hanging utensils */}
      <rect x="1392" y="262" width="96" height="4" rx="2" fill="#9aa3ad" />
      <g className="swing">
        <path d="M1410 266 v44" stroke="#9aa3ad" strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="1410" cy="318" rx="10" ry="8" fill="#9aa3ad" />
      </g>
      <g className="swing swing-2">
        <path d="M1440 266 v36" stroke="#c79a6c" strokeWidth="3" strokeLinecap="round" />
        <rect x="1432" y="300" width="16" height="22" rx="5" fill="#c79a6c" />
      </g>
      <g className="swing swing-3">
        <path d="M1470 266 v26" stroke="#9aa3ad" strokeWidth="2" strokeLinecap="round" />
        <path d="M1470 292 q-10 16 0 32 q10 -16 0 -32 M1470 292 q-4 16 0 32 q4 -16 0 -32" stroke="#9aa3ad" strokeWidth="1.6" fill="none" />
      </g>
    </g>
  );
}

function StoveCounter({
  uid,
  answers,
  mode,
  level,
  heat,
  items,
  allItems,
  stirKey,
  tickKey,
  onSetLevel,
  onTaste,
}: {
  uid: string;
  answers: Answers;
  mode: WorldProps['mode'];
  level: Level;
  heat: number;
  items: FlowItem[];
  allItems: FlowItem[];
  stirKey: number;
  tickKey: number;
  onSetLevel?: (l: Level) => void;
  onTaste?: () => void;
}) {
  const v = VESSELS[2];
  const budgetIdx = ['zero', 'low', 'mid', 'flexible'].indexOf(mode === 'welcome' ? '' : str(answers, 'budget'));
  const coins = budgetIdx < 0 ? 0 : budgetIdx * 3 + 2;
  const timelineOptions = ['weekend', 'weeks', 'month', 'quarter', 'none'];
  const tIdx = timelineOptions.indexOf(mode === 'welcome' ? '' : str(answers, 'timeline'));
  const dialAngle = tIdx < 0 ? -140 : -120 + tIdx * 60;
  const potItems = allItems.slice(-12);
  const pieces = mode === 'finale' ? potItems : items.length ? items.slice(-12) : potItems.slice(-4);

  return (
    <g>
      {/* Coin jar: budget */}
      <g transform="translate(1300 432)">
        <rect x="-26" y="-50" width="52" height="58" rx="12" fill="rgba(255,255,255,0.55)" stroke="rgba(120,90,60,0.25)" strokeWidth="1.5" />
        <rect x="-20" y="-58" width="40" height="10" rx="3" fill="#c79a6c" />
        {Array.from({ length: coins }).map((_, i) => (
          <ellipse key={i} className="coin-disc" cx={-12 + (i % 3) * 12} cy={0 - Math.floor(i / 3) * 7} rx="8" ry="3.5" fill="#f2c14e" stroke="#d99f2b" strokeWidth="1" />
        ))}
        <text y="30" textAnchor="middle" className="svg-label">
          Budget
        </text>
      </g>

      {/* Cooktop glow and flames */}
      <ellipse cx={v.x} cy="462" rx="120" ry="26" fill={`url(#glow-${uid})`} style={{ opacity: heat }} className="stove-glow" />
      <rect x="1460" y="460" width="260" height="12" rx="6" fill="#3a3632" />
      <g transform={`translate(${v.x} 460)`}>
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
      <g className="steam" style={{ opacity: mode === 'welcome' ? 0.35 : 0.3 + heat * 0.6 }}>
        {[-28, 0, 28].map((dx, i) => (
          <path key={dx} className="steam-wisp" style={{ animationDelay: `${i * 0.9}s` }} d={`M${v.x + dx} ${v.y - 20} c -10 -14 10 -26 0 -40 c -10 -14 10 -26 0 -40`} stroke="#ffffff" strokeWidth="6" strokeLinecap="round" fill="none" />
        ))}
      </g>

      {/* Pot */}
      <g transform={`translate(${v.x} ${v.y})`}>
        <g className="pot" {...pressable(mode === 'welcome' ? 'Start cooking' : 'Taste it: preview your prompt', onTaste)}>
          <title>{mode === 'welcome' ? 'Start cooking' : 'Taste it: preview your prompt'}</title>
          <rect x="-104" y="24" width="26" height="11" rx="5.5" fill="#39404a" />
          <rect x="78" y="24" width="26" height="11" rx="5.5" fill="#39404a" />
          <path d="M-84 -2 L-84 92 Q-84 114 -60 114 L60 114 Q84 114 84 92 L84 -2 Z" fill={`url(#pot-${uid})`} />
          <rect x="-84" y="48" width="168" height="7" fill="var(--accent)" opacity="0.92" />
          <rect x="-70" y="10" width="9" height="84" rx="4.5" fill="rgba(255,255,255,0.12)" />
          <ellipse rx="86" ry="16" fill="#343a42" />
          <ellipse className="broth" cy="2" rx="78" ry="12" fill={mode === 'welcome' ? `rgb(${BROTH.join(',')})` : mixture(allItems)} />
          <ellipse cx="-20" cy="-1" rx="30" ry="4" fill="rgba(255,255,255,0.25)" />
          <g transform="translate(0 2)">
            <Pieces items={pieces} spreadX={60} spreadY={7} float />
          </g>
          {Array.from({ length: Math.ceil(heat * 6) }).map((_, i) => (
            <circle key={i} className="bubble" cx={-48 + ((i * 37) % 96)} cy={3 + (i % 3) * 2} r={2.5 + (i % 3)} style={{ animationDelay: `${i * 0.45}s` }} />
          ))}
          <g key={stirKey} className={`spoon${stirKey >= 0 ? ' is-stirring' : ''}`}>
            <path d="M18 -4 L 58 -78" stroke="#c79a6c" strokeWidth="6" strokeLinecap="round" />
            <ellipse cx="14" cy="2" rx="9" ry="5" fill="#b8875a" />
          </g>
        </g>
      </g>

      {/* Knobs set the prompt level */}
      {LEVELS.map((l, i) => {
        const active = level === l.value;
        return (
          <g key={l.value} transform={`translate(${v.x - 62 + i * 62} 530)`} className={`knob${active ? ' is-active' : ''}`} {...pressable(`Set prompt level to ${l.label}`, onSetLevel ? () => onSetLevel(l.value) : undefined)}>
            <title>{`${l.label} prompt`}</title>
            {active && <circle r="21" fill="none" stroke="var(--accent)" strokeWidth="2.5" opacity="0.8" />}
            <circle r="16" fill="#fffaf3" stroke="rgba(90,60,30,0.2)" strokeWidth="1.5" />
            <g className="knob-dial" style={{ transform: `rotate(${active ? 90 : -30}deg)` }}>
              <circle r="14" fill="transparent" />
              <rect x="-2" y="-13" width="4" height="11" rx="2" fill={active ? 'var(--accent)' : '#9b8b7a'} />
            </g>
            <text y="35" textAnchor="middle" className={`svg-label knob-label${active ? ' strong-small' : ''}`}>
              {l.label}
            </text>
          </g>
        );
      })}

      {/* Oven timer: timeline */}
      <g transform="translate(1738 540)">
        <circle r="26" fill="#fffaf3" stroke="rgba(90,60,30,0.2)" strokeWidth="1.5" />
        {[-120, -60, 0, 60, 120].map((a) => (
          <rect key={a} x="-1" y="-24" width="2" height="5" fill="#b9ab98" transform={`rotate(${a})`} />
        ))}
        <g key={tickKey} className={`timer-hand${tickKey >= 0 ? ' is-ticking' : ''}`} style={{ transform: `rotate(${dialAngle}deg)` }}>
          <circle r="22" fill="transparent" />
          <rect x="-2" y="-18" width="4" height="16" rx="2" fill="var(--accent)" />
          <circle r="4" fill="#3f3a35" />
        </g>
        <text y="42" textAnchor="middle" className="svg-label knob-label">
          Timer
        </text>
      </g>

      {/* Oven door with a warm glow */}
      <rect x="1478" y="590" width="224" height="96" rx="8" fill="#3a3632" />
      <rect x="1494" y="604" width="192" height="70" rx="5" fill="#2a2724" />
      <rect x="1494" y="604" width="192" height="70" rx="5" fill="#ff9d4d" className="oven-glow" style={{ opacity: 0.1 + heat * 0.4 }} />
    </g>
  );
}

/* ================================================================== */
/* The pass                                                            */
/* ================================================================== */

function PassWall({ uid, chapters, chapterDone, onSelectChapter }: { uid: string; chapters: Chapter[]; chapterDone: (c: Chapter) => number; onSelectChapter?: (i: number) => void }) {
  return (
    <g>
      {/* Heat lamps */}
      {[2000, 2200].map((x) => (
        <g key={x}>
          <path d={`M${x} -900 V 60`} stroke="#8a9098" strokeWidth="2" />
          <polygon points={`${x - 22},92 ${x + 22},92 ${x + 130},470 ${x - 130},470`} fill={`url(#lamp-${uid})`} className="lamp-light" />
          <path d={`M${x - 26} 94 Q ${x} 50 ${x + 26} 94 Z`} fill="#4b5460" />
          <rect x={x - 26} y="92" width="52" height="5" rx="2" fill="#ffd9a0" />
        </g>
      ))}

      {/* Ticket rail: one ticket per chapter */}
      <rect x="1846" y="178" width="508" height="8" rx="4" fill="#9aa3ad" />
      {chapters.map((c, i) => {
        const done = chapterDone(c);
        const x = 1862 + i * 54;
        return (
          <g key={c.step.id} transform={`translate(${x} 186) rotate(${i % 2 ? 2 : -2})`} className="ticket" {...pressable(`${themeFor(c.step.id).name}: go to this step`, onSelectChapter ? () => onSelectChapter(c.start) : undefined)}>
            <title>{themeFor(c.step.id).name}</title>
            <g className="ticket-body">
              <rect width="42" height="60" rx="2" fill="#fffdf7" stroke="rgba(90,60,30,0.14)" strokeWidth="1" />
              <rect width="42" height="6" fill={themeFor(c.step.id).color} />
              <text x="21" y="26" textAnchor="middle" className="svg-label strong-small">
                {String(i + 1).padStart(2, '0')}
              </text>
              <rect x="8" y="34" width="26" height="3" rx="1.5" fill="#ece4d8" />
              <rect x="8" y="41" width="18" height="3" rx="1.5" fill="#ece4d8" />
              {done >= 1 && (
                <g transform="translate(28 48) rotate(-14)" className="stamp">
                  <circle r="9" fill="none" stroke="var(--accent)" strokeWidth="2" />
                  <path d="M-4 0 l3 3 l5 -6" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
                </g>
              )}
            </g>
          </g>
        );
      })}
    </g>
  );
}

function PassCounter({
  uid,
  items,
  allItems,
  finale,
  bellTick,
  onLiftCloche,
  onBell,
}: {
  uid: string;
  items: FlowItem[];
  allItems: FlowItem[];
  finale?: FinaleStage;
  bellTick: number;
  onLiftCloche?: () => void;
  onBell?: () => void;
}) {
  const v = VESSELS[3];
  const plated = finale && finale !== 'ready';
  const covered = finale === 'covered';
  const lifted = finale === 'revealed' || finale === 'printing' || finale === 'done';
  const printing = finale === 'printing' || finale === 'done';
  const [drag, setDrag] = useState<{ start: number; dy: number } | null>(null);

  const onDown = (e: PointerEvent<SVGGElement>) => {
    if (!covered) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ start: e.clientY, dy: 0 });
  };
  const onMove = (e: PointerEvent<SVGGElement>) => {
    if (!drag) return;
    setDrag({ ...drag, dy: Math.min(0, e.clientY - drag.start) });
  };
  const onUp = () => {
    if (!drag) return;
    const lift = drag.dy < -30 || Math.abs(drag.dy) < 4;
    setDrag(null);
    if (lift) onLiftCloche?.();
  };

  return (
    <g>
      {/* Ticket printer */}
      <g transform="translate(1850 418)">
        <rect width="112" height="52" rx="8" fill="#3f3a35" />
        <rect x="14" y="10" width="84" height="6" rx="3" fill="#1f1c1a" />
        <circle cx="96" cy="36" r="4" fill={printing ? '#7fd18a' : '#6b645d'} />
        <rect x="18" y="-70" width="76" height="80" fill="#fffdf7" className={`printer-paper${printing ? ' is-printing' : ''}`} />
        {printing &&
          [0, 1, 2, 3, 4].map((k) => (
            <rect key={k} className="printer-line" x="26" y={-58 + k * 12} width={58 - (k % 2) * 16} height="3" rx="1.5" fill="#cdbba4" style={{ animationDelay: `${0.3 + k * 0.15}s` }} />
          ))}
      </g>

      {/* Plate */}
      <g transform={`translate(${v.x} ${v.y})`} className="vessel">
        <ellipse cy="10" rx="96" ry="14" fill="rgba(60,70,80,0.14)" />
        <ellipse rx="92" ry="20" fill="#ffffff" stroke="rgba(90,60,30,0.12)" strokeWidth="1.5" />
        <ellipse rx="64" ry="13" fill="#f5efe7" />
        {!plated && <Pieces items={items} spreadX={48} spreadY={7} scale={0.7} />}
        {plated && (
          <g className="dish">
            <ellipse cy="-8" rx="54" ry="17" fill={mixture(allItems)} />
            <ellipse cx="-14" cy="-14" rx="22" ry="5" fill="rgba(255,255,255,0.28)" />
            <g transform="translate(0 -10)">
              <Pieces items={allItems.slice(-14)} spreadX={40} spreadY={8} scale={0.7} />
            </g>
          </g>
        )}
        {lifted && (
          <g className="dish-steam">
            {[-20, 0, 20].map((dx, i) => (
              <path key={dx} className="steam-wisp" style={{ animationDelay: `${i * 0.6}s` }} d={`M${dx} -26 c -8 -12 8 -22 0 -34 c -8 -12 8 -22 0 -34`} stroke="#ffffff" strokeWidth="5" strokeLinecap="round" fill="none" />
            ))}
          </g>
        )}
        {(covered || finale === 'plating' || lifted) && (
          <g
            className={`cloche${finale === 'plating' ? ' is-lowering' : ''}${lifted ? ' is-lifted' : ''}${covered ? ' is-ready' : ''}`}
            style={drag ? { transform: `translateY(${drag.dy}px)`, transition: 'none' } : undefined}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            role={covered ? 'button' : undefined}
            tabIndex={covered ? 0 : undefined}
            aria-label={covered ? 'Lift the cloche' : undefined}
            onKeyDown={(e: KeyboardEvent<SVGGElement>) => {
              if (covered && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onLiftCloche?.();
              }
            }}
          >
            <path d="M-80 -2 C -80 -84 80 -84 80 -2 Z" fill={`url(#cloche-${uid})`} stroke="rgba(60,70,80,0.2)" strokeWidth="1.5" />
            <path d="M-54 -30 C -44 -58 -14 -68 6 -66" fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" opacity="0.7" />
            <ellipse cy="-2" rx="84" ry="8" fill="#b9c0c6" />
            <circle cy="-72" r="9" fill="#aeb5bc" stroke="rgba(60,70,80,0.2)" />
          </g>
        )}
      </g>

      {/* Service bell */}
      <g transform="translate(2290 452)" className="bell" {...pressable('Ring the service bell', onBell)}>
        <title>Ring the bell</title>
        <g key={bellTick} className={bellTick ? 'bell-top is-ringing' : 'bell-top'}>
          <path d="M-22 12 C -22 -14 22 -14 22 12 Z" fill="#e1b64f" />
          <path d="M-12 -2 C -8 -8 -2 -10 4 -10" fill="none" stroke="#fff3c4" strokeWidth="3" strokeLinecap="round" />
          <circle cy="-14" r="4" fill="#c9983a" />
        </g>
        <ellipse cy="14" rx="28" ry="6" fill="#4b4540" />
      </g>
    </g>
  );
}
