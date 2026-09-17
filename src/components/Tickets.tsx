import type { CSSProperties } from 'react';
import type { Answers } from '../types';
import { isAnswered } from '../lib/answers';
import { themeFor } from '../data/kitchen';
import type { Chapter, FlowItem } from './Journey';

/** Order tickets clipped to a rail: one per chapter, stamped when done. */
export function TicketRail({
  chapters,
  flow,
  answers,
  position,
  onSelect,
}: {
  chapters: Chapter[];
  flow: FlowItem[];
  answers: Answers;
  position: number;
  onSelect: (index: number) => void;
}) {
  const remaining = flow.slice(Math.max(0, position)).filter((f) => !isAnswered(answers, f.q.id)).length;
  const minutes = Math.max(1, Math.ceil((remaining * 12) / 60));

  return (
    <div className="rail">
      <div className="rail-bar" role="list" aria-label="Recipe steps">
        {chapters.map((c, i) => {
          const items = flow.slice(c.start, c.start + c.count);
          const done = items.filter((f) => isAnswered(answers, f.q.id)).length;
          const current = position >= c.start && position < c.start + c.count;
          const complete = done === items.length;
          const theme = themeFor(c.step.id);
          return (
            <div role="listitem" key={c.step.id}>
              <button
                type="button"
                className={`rail-ticket${current ? ' is-current' : ''}${complete ? ' is-complete' : ''}${position >= c.start + c.count ? ' is-past' : ''}`}
                style={{ '--ticket': theme.color, '--tilt': `${i % 2 ? 2 : -2}deg` } as CSSProperties}
                onClick={() => onSelect(c.start)}
                title={`${theme.name} · ${done}/${items.length}`}
                aria-label={`${theme.name}, ${done} of ${items.length} answered`}
                aria-current={current ? 'step' : undefined}
              >
                <span className="rail-ticket-num">{String(i + 1).padStart(2, '0')}</span>
                {complete && <span className="rail-stamp" aria-hidden="true" />}
              </button>
            </div>
          );
        })}
      </div>
      {position >= 0 && position < flow.length && <span className="rail-timer">≈ {minutes} min left</span>}
    </div>
  );
}
