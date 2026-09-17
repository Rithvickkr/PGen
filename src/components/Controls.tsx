import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import type { AnswerValue, Question } from '../types';
import { themeFor } from '../data/kitchen';
import { Control } from './Field';
import { Icon } from './Icon';

export type KitchenAction = 'chop' | 'stir' | 'add' | 'remove' | 'pick' | 'coin' | 'tick';

interface CookingControlProps {
  id: string;
  q: Question;
  stepId: string;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
  act: (action: KitchenAction) => void;
}

/** Drag payload used when an ingredient chip is dropped into the kitchen. */
export const DRAG_TYPE = 'application/x-pgen-ingredient';

/**
 * The same questions as the plain form, but each answer is a cooking action:
 * typing chops, long answers stir, choices come off the shelf, and multi-selects come out of a crate.
 */
export function CookingControl(props: CookingControlProps) {
  const { q } = props;
  if (q.id === 'timeline') return <OvenTimer {...props} />;
  if (q.id === 'budget') return <CoinJar {...props} />;
  if (q.id === 'designStyle') return <PlateStyles {...props} />;
  switch (q.type) {
    case 'cards':
      return <IconCards {...props} />;
    case 'single':
      return <JarShelf {...props} />;
    case 'multi':
      return <Crate {...props} />;
    case 'list':
      return <PrepBowls {...props} />;
    case 'text':
      return <ChopInput {...props} />;
    case 'textarea':
      return <StirInput {...props} />;
  }
}

/* ------------------------------------------------------------------ */
/* Typing: chopping and stirring                                       */
/* ------------------------------------------------------------------ */

function ChopInput({ id, q, value, onChange, act }: CookingControlProps) {
  return (
    <div className="cook-field cook-field-chop">
      <Control
        id={id}
        q={q}
        value={value}
        onChange={(v) => {
          onChange(v);
          act('chop');
        }}
      />
      <span className="cook-field-tool" aria-hidden="true">
        <KnifeIcon />
      </span>
    </div>
  );
}

function StirInput({ id, q, value, onChange, act }: CookingControlProps) {
  const text = typeof value === 'string' ? value : '';
  const richness = Math.min(1, text.trim().length / 220);
  return (
    <div className="cook-field cook-field-stir" style={{ '--richness': richness } as CSSProperties}>
      <Control
        id={id}
        q={q}
        value={value}
        onChange={(v) => {
          onChange(v);
          act('stir');
        }}
      />
      <div className="richness" aria-hidden="true">
        <span className="richness-label">{richness < 0.25 ? 'Thin' : richness < 0.6 ? 'Getting richer' : richness < 1 ? 'Rich' : 'Perfectly rich'}</span>
        <span className="richness-bar">
          <span />
        </span>
      </div>
    </div>
  );
}

function PrepBowls({ id, q, stepId, value, onChange, act }: CookingControlProps) {
  const count = (v: AnswerValue | undefined) => (Array.isArray(v) ? v.filter((x) => x.trim()).length : 0);
  const color = themeFor(stepId).color;
  return (
    <div className="cook-field cook-field-prep" style={{ '--ingredient': color } as CSSProperties}>
      <Control
        id={id}
        q={q}
        value={value}
        onChange={(v) => {
          const before = count(value);
          const after = count(v);
          onChange(v);
          if (after > before) act('add');
          else if (after < before) act('remove');
          else act('chop');
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Single choice: jars on a shelf                                      */
/* ------------------------------------------------------------------ */

function JarShelf({ id, q, stepId, value, onChange, act }: CookingControlProps) {
  const selected = typeof value === 'string' ? value : '';
  const color = themeFor(stepId).color;
  return (
    <div className="jar-shelf" role="radiogroup" aria-labelledby={`${id}-label`} style={{ '--ingredient': color } as CSSProperties}>
      {q.options?.map((o) => {
        const on = selected === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            className={`jar-option${on ? ' is-selected' : ''}`}
            onClick={() => {
              onChange(on ? '' : o.value);
              act(on ? 'remove' : 'pick');
            }}
          >
            <span className="jar-lid" />
            <span className="jar-glass">
              <span className="jar-contents" />
              <span className="jar-label">{o.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Big choices: illustrated cards                                      */
/* ------------------------------------------------------------------ */

function IconCards({ id, q, value, onChange, act }: CookingControlProps) {
  const selected = typeof value === 'string' ? value : '';
  return (
    <div className={`cards${q.options?.length === 2 || q.options?.length === 4 ? ' cards-2' : ''}`} role="radiogroup" aria-labelledby={`${id}-label`}>
      {q.options?.map((o) => {
        const on = selected === o.value;
        const icon = OPTION_ICONS[`${q.id}:${o.value}`];
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            className={`card-option${on ? ' is-selected' : ''}${icon ? ' has-icon' : ''}`}
            onClick={() => {
              onChange(o.value);
              if (!on) act('pick');
            }}
          >
            <span className="card-option-top">
              {icon && <span className="card-icon">{icon}</span>}
              <span className="card-option-label">{o.label}</span>
              <span className="radio-dot" />
            </span>
            {o.hint && <span className="card-option-hint">{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Multi-select: a crate of ingredients you drag or tap into the pot   */
/* ------------------------------------------------------------------ */

const VEG = ['#78a565', '#e0708f', '#f2b43c', '#6f7fd4', '#e0993a', '#9fb86a', '#c96f5a'];

function Crate({ id, q, value, onChange, act }: CookingControlProps) {
  const items = Array.isArray(value) ? value : [];
  const [draft, setDraft] = useState('');
  const options = q.options ?? [];
  const known = new Set(options.map((o) => o.value));
  const custom = items.filter((v) => !known.has(v));

  const toggle = (v: string) => {
    const on = items.includes(v);
    onChange(on ? items.filter((x) => x !== v) : [...items, v]);
    act(on ? 'remove' : 'add');
  };
  const addCustom = () => {
    const v = draft.trim();
    if (v && !items.includes(v)) {
      onChange([...items, v]);
      act('add');
    }
    setDraft('');
  };

  return (
    <div className="crate">
      <p className="crate-hint">
        Tap an ingredient to add it, or drag it into the kitchen <Icon name="arrowRight" size={12} />
      </p>
      <div className="crate-box" role="group" aria-labelledby={`${id}-label`}>
        {[...options.map((o) => ({ value: o.value, label: o.label })), ...custom.map((c) => ({ value: c, label: c }))].map((o, i) => {
          const on = items.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              draggable={!on}
              className={`veg${on ? ' is-selected' : ''}`}
              style={{ '--veg': VEG[i % VEG.length] } as CSSProperties}
              onClick={() => toggle(o.value)}
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ qid: q.id, value: o.value }));
                e.dataTransfer.effectAllowed = 'copy';
              }}
            >
              <span className="veg-dot" />
              {o.label}
              {on && <Icon name="check" size={13} />}
            </button>
          );
        })}
        {q.allowCustom && (
          <input
            className="chip-input"
            value={draft}
            placeholder="+ Add your own"
            aria-label={`Add your own: ${q.label}`}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={addCustom}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustom();
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Timeline: an oven timer dial                                        */
/* ------------------------------------------------------------------ */

function OvenTimer({ id, q, value, onChange, act }: CookingControlProps) {
  const options = q.options ?? [];
  const selected = typeof value === 'string' ? value : '';
  const index = options.findIndex((o) => o.value === selected);
  const dialRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const span = 240;
  const angleFor = (i: number) => -span / 2 + (span / Math.max(1, options.length - 1)) * i;

  const setIndex = (i: number) => {
    const clamped = Math.max(0, Math.min(options.length - 1, i));
    if (options[clamped] && options[clamped].value !== selected) {
      onChange(options[clamped].value);
      act('tick');
    }
  };

  const fromPointer = (e: PointerEvent<HTMLDivElement>) => {
    const rect = dialRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
    let best = 0;
    options.forEach((_, i) => {
      if (Math.abs(angleFor(i) - deg) < Math.abs(angleFor(best) - deg)) best = i;
    });
    setIndex(best);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex(index < 0 ? 0 : index + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex(index < 0 ? 0 : index - 1);
    }
  };

  return (
    <div className="oven">
      <div
        ref={dialRef}
        className={`oven-dial${index >= 0 ? ' is-set' : ''}`}
        role="slider"
        tabIndex={0}
        aria-labelledby={`${id}-label`}
        aria-valuemin={0}
        aria-valuemax={options.length - 1}
        aria-valuenow={Math.max(0, index)}
        aria-valuetext={index >= 0 ? options[index].label : 'Not set'}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          fromPointer(e);
        }}
        onPointerMove={(e) => dragging.current && fromPointer(e)}
        onPointerUp={() => (dragging.current = false)}
      >
        {options.map((o, i) => (
          <span key={o.value} className={`oven-tick${i === index ? ' is-on' : ''}`} style={{ transform: `rotate(${angleFor(i)}deg)` }} />
        ))}
        <span className="oven-knob" style={{ transform: `rotate(${index >= 0 ? angleFor(index) : -span / 2 - 20}deg)` }}>
          <span className="oven-pointer" />
        </span>
        <span className="oven-readout">{index >= 0 ? options[index].label : 'Turn me'}</span>
      </div>
      <div className="oven-options" role="radiogroup" aria-label="Timeline options">
        {options.map((o, i) => (
          <button key={o.value} type="button" role="radio" aria-checked={i === index} className={`oven-option${i === index ? ' is-selected' : ''}`} onClick={() => setIndex(i)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Budget: coins in a jar                                              */
/* ------------------------------------------------------------------ */

function CoinJar({ id, q, value, onChange, act }: CookingControlProps) {
  const options = q.options ?? [];
  const selected = typeof value === 'string' ? value : '';
  const coins = Math.max(0, options.findIndex((o) => o.value === selected));
  return (
    <div className="coins">
      <div className="coin-jar" aria-hidden="true">
        <div className="coin-jar-glass">
          {Array.from({ length: selected ? coins * 3 + 1 : 0 }).map((_, i) => (
            <span key={`${selected}-${i}`} className="coin" style={{ '--i': i } as CSSProperties} />
          ))}
        </div>
      </div>
      <div className="coin-options" role="radiogroup" aria-labelledby={`${id}-label`}>
        {options.map((o, i) => {
          const on = o.value === selected;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              className={`coin-option${on ? ' is-selected' : ''}`}
              onClick={() => {
                onChange(on ? '' : o.value);
                act(on ? 'remove' : 'coin');
              }}
            >
              <span className="coin-stack" aria-hidden="true">
                {i === options.length - 1 ? <span className="coin coin-static coin-infinite">∞</span> : Array.from({ length: i + 1 }).map((_, k) => <span key={k} className="coin coin-static" />)}
              </span>
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Design style: pick a plate                                          */
/* ------------------------------------------------------------------ */

function PlateStyles({ id, q, value, onChange, act }: CookingControlProps) {
  const selected = typeof value === 'string' ? value : '';
  return (
    <div className="plates" role="radiogroup" aria-labelledby={`${id}-label`}>
      {q.options?.map((o) => {
        const on = selected === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            className={`plate-option${on ? ' is-selected' : ''}`}
            onClick={() => {
              onChange(on ? '' : o.value);
              act(on ? 'remove' : 'pick');
            }}
          >
            <span className={`plate-art plate-${o.value}`} aria-hidden="true">
              <span />
            </span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

function Flames({ n }: { n: number }) {
  return (
    <svg width={14 * n + 4} height="22" viewBox={`0 0 ${14 * n + 4} 24`} fill="currentColor">
      {Array.from({ length: n }).map((_, i) => (
        <path key={i} transform={`translate(${2 + i * 14} 2)`} d="M6 20c-3.3 0-5-2.3-5-5 0-3 2.2-4.6 3-7.5.5 1.6 1.4 2.6 2.4 3C6.8 7.8 8 5 7.5 1c3 2.4 4.5 6.3 4.5 10 0 5-2.7 9-6 9z" />
      ))}
    </svg>
  );
}

function KnifeIcon() {
  return (
    <Svg>
      <path d="M3 21l9-9" />
      <path d="M12 12l8.5-8.5c.8 3.4-.6 7.4-4.5 10L12 12z" />
    </Svg>
  );
}

const OPTION_ICONS: Record<string, ReactNode> = {
  'level:beginner': <Flames n={1} />,
  'level:intermediate': <Flames n={2} />,
  'level:advanced': <Flames n={3} />,
  'target:chat': (
    <Svg>
      <ellipse cx="12" cy="14" rx="9" ry="4" />
      <ellipse cx="12" cy="13.5" rx="5" ry="2" />
      <path d="M6 4v5M18 4v5" />
    </Svg>
  ),
  'target:agent': (
    <Svg>
      <path d="M3 12h13a0 0 0 0 1 0 0v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-3z" />
      <path d="M16 13h5" />
      <path d="M8 8c0-1.5 1-2 1-3.5M12 8c0-1.5 1-2 1-3.5" />
    </Svg>
  ),
  'outcome:validate': (
    <Svg>
      <ellipse cx="8" cy="8" rx="4" ry="5" transform="rotate(-45 8 8)" />
      <path d="M11 11l9 9" />
    </Svg>
  ),
  'outcome:plan': (
    <Svg>
      <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z" />
      <path d="M8 7h7M8 11h5" />
    </Svg>
  ),
  'outcome:build': (
    <Svg>
      <path d="M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-6z" />
      <path d="M2 10h20M9 6c0-1 1-1.5 1-2.5M14 6c0-1 1-1.5 1-2.5" />
    </Svg>
  ),
  'outcome:learn': (
    <Svg>
      <path d="M7 14c-2.5 0-4-1.8-4-4a4 4 0 0 1 5-3.9 4 4 0 0 1 8 0A4 4 0 0 1 21 10c0 2.2-1.5 4-4 4" />
      <path d="M7 14v6h10v-6" />
    </Svg>
  ),
  'platform:webapp': (
    <Svg>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M7 6.5h.01M10 6.5h.01" />
    </Svg>
  ),
  'platform:website': (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
    </Svg>
  ),
  'platform:mobile': (
    <Svg>
      <rect x="6" y="2" width="12" height="20" rx="2.5" />
      <path d="M11 18h2" />
    </Svg>
  ),
  'platform:desktop': (
    <Svg>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </Svg>
  ),
  'platform:extension': (
    <Svg>
      <path d="M10 3a2 2 0 0 1 4 0v2h4v4h-2a2 2 0 0 0 0 4h2v5H6v-5h2a2 2 0 0 0 0-4H6V5h4V3z" />
    </Svg>
  ),
  'platform:api': (
    <Svg>
      <path d="M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0V7zM12 17v5" />
    </Svg>
  ),
  'platform:cli': (
    <Svg>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M6 9l3 3-3 3M12 15h5" />
    </Svg>
  ),
  'platform:bot': (
    <Svg>
      <path d="M4 5h16v11H9l-5 4V5z" />
      <path d="M9 10h.01M15 10h.01" />
    </Svg>
  ),
  'platform:game': (
    <Svg>
      <path d="M6 8h12a4 4 0 0 1 4 4v1a4 4 0 0 1-7 2.6L14 15h-4l-1 .6A4 4 0 0 1 2 13v-1a4 4 0 0 1 4-4z" />
      <path d="M7 11v3M5.5 12.5h3M16 12h.01M18 13.5h.01" />
    </Svg>
  ),
  'platform:automation': (
    <Svg>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </Svg>
  ),
};
