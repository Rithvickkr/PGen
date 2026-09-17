import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AnswerValue, Question } from '../types';
import { Icon } from './Icon';

interface ControlProps {
  /** Base id; the visible label must carry `${id}-label`. */
  id: string;
  q: Question;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
}

export function Control({ id, q, value, onChange }: ControlProps) {
  const text = typeof value === 'string' ? value : '';
  const items = Array.isArray(value) ? value : [];
  const labelledBy = `${id}-label`;

  switch (q.type) {
    case 'text':
      return (
        <input
          id={id}
          className="input"
          type="text"
          value={text}
          placeholder={q.placeholder}
          aria-labelledby={labelledBy}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'textarea':
      return <AutoTextarea id={id} labelledBy={labelledBy} value={text} placeholder={q.placeholder} onChange={onChange} />;
    case 'cards':
      return (
        <div
          className={`cards${q.options?.length === 2 || q.options?.length === 4 ? ' cards-2' : ''}`}
          role="radiogroup"
          aria-labelledby={labelledBy}
        >
          {q.options?.map((o) => {
            const selected = text === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`card-option${selected ? ' is-selected' : ''}`}
                onClick={() => onChange(o.value)}
              >
                <span className="card-option-top">
                  <span className="card-option-label">{o.label}</span>
                  <span className="radio-dot" />
                </span>
                {o.hint && <span className="card-option-hint">{o.hint}</span>}
              </button>
            );
          })}
        </div>
      );
    case 'single':
      return (
        <div className="pills" role="radiogroup" aria-labelledby={labelledBy}>
          {q.options?.map((o) => {
            const selected = text === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`pill${selected ? ' is-selected' : ''}`}
                onClick={() => onChange(selected ? '' : o.value)}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      );
    case 'multi':
      return <MultiChips labelledBy={labelledBy} q={q} items={items} onChange={onChange} />;
    case 'list':
      return <ListInput id={id} labelledBy={labelledBy} placeholder={q.placeholder} items={items} onChange={onChange} />;
  }
}

function AutoTextarea({
  id,
  labelledBy,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  labelledBy: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Collapsing to 'auto' to measure can make the page jump while typing, so keep the scroll position.
    const scrollY = window.scrollY;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
    if (window.scrollY !== scrollY) window.scrollTo({ top: scrollY });
  }, [value]);
  return (
    <textarea
      ref={ref}
      id={id}
      aria-labelledby={labelledBy}
      className="input textarea"
      rows={3}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function MultiChips({
  labelledBy,
  q,
  items,
  onChange,
}: {
  labelledBy: string;
  q: Question;
  items: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const options = q.options ?? [];
  const known = new Set(options.map((o) => o.value));
  const custom = items.filter((v) => !known.has(v));
  const toggle = (v: string) => onChange(items.includes(v) ? items.filter((x) => x !== v) : [...items, v]);

  const addCustom = () => {
    const v = draft.trim();
    if (v && !items.includes(v)) onChange([...items, v]);
    setDraft('');
  };

  return (
    <div className="chips" role="group" aria-labelledby={labelledBy}>
      {options.map((o) => {
        const selected = items.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={selected}
            className={`chip${selected ? ' is-selected' : ''}`}
            onClick={() => toggle(o.value)}
          >
            {selected && <Icon name="check" size={13} />}
            {o.label}
          </button>
        );
      })}
      {custom.map((v) => (
        <button key={v} type="button" className="chip is-selected" onClick={() => toggle(v)} aria-label={`Remove ${v}`}>
          {v}
          <Icon name="x" size={13} />
        </button>
      ))}
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
  );
}

function ListInput({
  id,
  labelledBy,
  placeholder,
  items,
  onChange,
}: {
  id: string;
  labelledBy: string;
  placeholder?: string;
  items: string[];
  onChange: (v: string[]) => void;
}) {
  const rows = items.length ? items : [''];
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);

  useEffect(() => {
    if (focusIndex !== null) {
      refs.current[focusIndex]?.focus();
      setFocusIndex(null);
    }
  }, [focusIndex, rows.length]);

  const set = (i: number, v: string) => onChange(rows.map((x, j) => (j === i ? v : x)));
  const insertAfter = (i: number) => {
    onChange([...rows.slice(0, i + 1), '', ...rows.slice(i + 1)]);
    setFocusIndex(i + 1);
  };
  const remove = (i: number) => {
    const next = rows.filter((_, j) => j !== i);
    onChange(next);
    setFocusIndex(Math.max(0, i - 1));
  };

  return (
    <div className="list">
      {rows.map((v, i) => (
        <div className="list-row" key={i}>
          <span className="list-index">{i + 1}</span>
          <input
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={i === 0 ? id : undefined}
            aria-labelledby={labelledBy}
            className="input"
            value={v}
            placeholder={i === 0 ? placeholder : 'Add another…'}
            onChange={(e) => set(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (v.trim()) insertAfter(i);
              } else if (e.key === 'Backspace' && !v && rows.length > 1) {
                e.preventDefault();
                remove(i);
              }
            }}
          />
          {rows.length > 1 && (
            <button type="button" className="icon-btn subtle" onClick={() => remove(i)} aria-label={`Remove item ${i + 1}`}>
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
      ))}
      <button type="button" className="add-row" onClick={() => insertAfter(rows.length - 1)}>
        <Icon name="plus" size={14} />
        Add item
      </button>
    </div>
  );
}
