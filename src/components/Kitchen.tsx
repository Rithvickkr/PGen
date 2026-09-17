import type { Answers } from '../types';
import { getLevel, isAnswered, str } from '../lib/answers';
import { optionLabel } from '../lib/reader';
import { getTarget, getTool } from '../lib/tools';
import { themeFor } from '../data/kitchen';
import type { Chapter, FlowItem } from './Journey';

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
