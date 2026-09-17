import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import type { AnswerValue, Answers, Question, Step } from '../types';
import { isAnswered } from '../lib/answers';
import { summarize } from '../lib/summary';
import { askFor } from '../data/asks';
import { EXAMPLES, type Example } from '../data/examples';
import { themeFor } from '../data/kitchen';
import { Control } from './Field';
import { Icon } from './Icon';

export interface FlowItem {
  q: Question;
  step: Step;
}

export interface Chapter {
  step: Step;
  start: number;
  count: number;
}

/* ------------------------------------------------------------------ */
/* Welcome                                                             */
/* ------------------------------------------------------------------ */

export function Welcome({
  resumable,
  onStart,
  onResume,
  onExample,
  art,
}: {
  resumable: boolean;
  onStart: () => void;
  onResume: () => void;
  onExample: (ex: Example) => void;
  art: ReactNode;
}) {
  return (
    <section className="welcome">
      <div className="welcome-copy">
        <p className="welcome-badge">
          <span className="dot" />
          Free, private, and about 5 minutes
        </p>
        <h1 className="welcome-title">
          Let’s cook up a prompt <em>any AI</em> can build from.
        </h1>
        <p className="welcome-lead">
          Step into the kitchen and add your idea one ingredient at a time. We’ll mix your answers into a clear, well-structured prompt for ChatGPT,
          Claude, Gemini, Cursor, and more.
        </p>

        <div className="welcome-actions">
          {resumable ? (
            <>
              <button type="button" className="btn btn-primary btn-lg" onClick={onResume}>
                Back to the kitchen
                <Icon name="arrowRight" size={16} />
              </button>
              <button type="button" className="btn btn-quiet btn-lg" onClick={onStart}>
                Start from the first step
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary btn-lg" onClick={onStart}>
              Start cooking
              <Icon name="arrowRight" size={16} />
            </button>
          )}
        </div>

        <ol className="welcome-path" aria-label="How it works">
          <li>
            <span>1</span>Gather ingredients
          </li>
          <li>
            <span>2</span>Mix the details
          </li>
          <li>
            <span>3</span>Serve your prompt
          </li>
        </ol>

        <div className="welcome-examples">
          <span className="welcome-examples-label">Or try a house recipe</span>
          {EXAMPLES.map((ex) => (
            <button key={ex.id} type="button" className="example-chip" onClick={() => onExample(ex)}>
              {ex.title}
            </button>
          ))}
        </div>
      </div>

      <div className="welcome-art">{art}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* One question per screen                                             */
/* ------------------------------------------------------------------ */

interface QuestionScreenProps {
  item: FlowItem;
  chapter: Chapter;
  chapterNumber: number;
  chapterTotal: number;
  position: number;
  answers: Answers;
  onChange: (id: string, value: AnswerValue) => void;
  onNext: () => void;
}

export function QuestionScreen({ item, chapter, chapterNumber, chapterTotal, position, answers, onChange, onNext }: QuestionScreenProps) {
  const { q, step } = item;
  const id = `f-${q.id}`;
  const value = answers[q.id];
  const answered = isAnswered(answers, q.id);
  const indexInChapter = position - chapter.start;
  const firstInChapter = indexInChapter === 0;
  const theme = themeFor(step.id);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    const t = window.setTimeout(() => {
      rootRef.current?.querySelector<HTMLElement>('.q-control > .input, .q-control .list .input')?.focus({ preventScroll: true });
    }, 250);
    return () => window.clearTimeout(t);
  }, []);

  // Moving on is always the person's call: nothing advances without Continue or Enter.
  const handleChange = (v: AnswerValue) => onChange(q.id, v);

  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter') return;
    const target = e.target as HTMLElement;
    if ((q.type === 'text' && target.tagName === 'INPUT') || e.ctrlKey || e.metaKey) {
      e.preventDefault();
      onNext();
    }
  };

  const hint =
    q.type === 'text' ? (
      <>
        press <kbd>Enter ↵</kbd>
      </>
    ) : q.type === 'textarea' || q.type === 'list' ? (
      <>
        press <kbd>Ctrl</kbd> + <kbd>Enter ↵</kbd>
      </>
    ) : null;

  return (
    <div className="q-screen" ref={rootRef} onKeyDown={handleKey}>
      {firstInChapter ? (
        <div className="chapter-intro" style={{ '--swatch': theme.color } as CSSProperties}>
          <span className="chapter-tag">
            Step {chapterNumber} of {chapterTotal} · {theme.ingredient}
          </span>
          <span className="chapter-name">{theme.name}</span>
          <span className="chapter-sub">{theme.line}</span>
        </div>
      ) : (
        <p className="q-kicker">
          <i className="q-swatch" style={{ background: theme.color }} />
          {theme.name}
          <span>
            {indexInChapter + 1} / {chapter.count}
          </span>
        </p>
      )}

      <h1 className="q-ask" id={`${id}-label`}>
        {askFor(q, answers)}
      </h1>
      {q.help && <p className="q-help">{q.help}</p>}

      <div className="q-control">
        <Control id={id} q={q} value={value} onChange={handleChange} />
      </div>

      <div className="q-actions">
        <button type="button" className="btn btn-primary" onClick={onNext}>
          Continue
          <Icon name="arrowRight" size={15} />
        </button>
        <span className="q-hint">
          {answered ? (
            <>
              <i className="q-swatch" style={{ background: theme.color }} />
              In the bowl{hint && <> · or {hint}</>}
            </>
          ) : (
            'Optional, you can skip this'
          )}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Progress trail                                                      */
/* ------------------------------------------------------------------ */

export function Trail({
  chapters,
  position,
  total,
  onSelect,
}: {
  chapters: Chapter[];
  position: number;
  total: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="trail" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.max(0, Math.min(position, total))} aria-label="Journey progress">
      {chapters.map((c) => {
        const done = position >= c.start + c.count;
        const fill = done ? 1 : position < c.start ? 0 : (position - c.start + 1) / (c.count + 1);
        return (
          <button
            key={c.step.id}
            type="button"
            className={`trail-seg${done ? ' is-done' : ''}${position >= c.start && !done ? ' is-current' : ''}`}
            style={{ flexGrow: c.count }}
            onClick={() => onSelect(c.start)}
            title={c.step.title}
            aria-label={`Go to ${c.step.title}`}
          >
            <span style={{ transform: `scaleX(${fill})` }} />
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Journey map                                                         */
/* ------------------------------------------------------------------ */

export function JourneyMap({
  chapters,
  flow,
  answers,
  position,
  onSelect,
  onClose,
}: {
  chapters: Chapter[];
  flow: FlowItem[];
  answers: Answers;
  position: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}) {
  const answeredCount = flow.filter((f) => isAnswered(answers, f.q.id)).length;

  return (
    <div className="map">
      <div className="map-head">
        <div>
          <div className="map-title">Recipe steps</div>
          <div className="map-meta">
            {answeredCount} of {flow.length} answered · tap any question to revisit it
          </div>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close recipe steps">
          <Icon name="x" size={16} />
        </button>
      </div>
      <div className="map-body">
        {chapters.map((c, ci) => (
          <section key={c.step.id} className="map-chapter">
            <h3 className="map-chapter-title">
              <span>{String(ci + 1).padStart(2, '0')}</span>
              <i className="q-swatch" style={{ background: themeFor(c.step.id).color }} />
              {themeFor(c.step.id).name}
            </h3>
            <ul>
              {flow.slice(c.start, c.start + c.count).map((f, i) => {
                const index = c.start + i;
                const summary = summarize(f.q, answers[f.q.id]);
                return (
                  <li key={f.q.id}>
                    <button
                      type="button"
                      className={`map-item${index === position ? ' is-current' : ''}${summary ? ' is-answered' : ''}`}
                      onClick={() => onSelect(index)}
                    >
                      <span className="map-item-dot" />
                      <span className="map-item-text">
                        <span className="map-item-label">{f.q.label}</span>
                        <span className="map-item-summary">{summary || 'Not answered'}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        <button type="button" className={`map-finish${position >= flow.length ? ' is-current' : ''}`} onClick={() => onSelect(flow.length)}>
          <Icon name="sparkle" size={14} />
          Serve your prompt
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small shared pieces                                                 */
/* ------------------------------------------------------------------ */

export function Logo() {
  return (
    <svg className="logo" width="26" height="26" viewBox="0 0 28 28" aria-hidden="true">
      <rect width="28" height="28" rx="8" fill="currentColor" />
      <path d="M8.5 9.5l4.5 4.5-4.5 4.5" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.5 18.5h5" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function Meter({ value }: { value: number }) {
  return (
    <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label="Prompt strength">
      <span style={{ width: `${Math.max(3, value)}%` }} />
    </div>
  );
}
