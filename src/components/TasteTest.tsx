import type { Answers } from '../types';
import { flavorProfile } from '../lib/flavor';
import type { Strength } from '../lib/strength';
import { STEPS } from '../data/steps';
import { Chef } from './Chef';
import { Icon } from './Icon';

/** The chef tastes the pot: a flavor profile of the prompt, plus what would make it better. */
export function TasteTest({
  answers,
  strength,
  onJump,
  onClose,
  embedded = false,
}: {
  answers: Answers;
  strength: Strength;
  onJump: (stepId: string) => void;
  onClose?: () => void;
  embedded?: boolean;
}) {
  const flavors = flavorProfile(answers);
  const verdict =
    strength.score >= 90 ? 'Delicious. Perfectly seasoned.' : strength.score >= 70 ? 'Tasty! Just a pinch more of something.' : strength.score >= 40 ? 'Getting there. It needs more flavor.' : 'Still a bit bland. Let’s add ingredients.';

  // Radar: four axes, top/right/bottom/left.
  const R = 70;
  const axes = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];
  const points = flavors.map((f, i) => `${100 + axes[i][0] * R * Math.max(0.08, f.value)},${100 + axes[i][1] * R * Math.max(0.08, f.value)}`).join(' ');
  const stepTitle = (id: string) => STEPS.find((s) => s.id === id)?.title ?? id;

  return (
    <div className={`taste${embedded ? ' taste-embedded' : ''}`}>
      {!embedded && (
        <div className="map-head">
          <div>
            <div className="map-title">Taste test</div>
            <div className="map-meta">How your prompt tastes so far</div>
          </div>
          {onClose && (
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close taste test">
              <Icon name="x" size={16} />
            </button>
          )}
        </div>
      )}
      <div className="taste-body">
        {!embedded && (
          <div className="taste-chef">
            <Chef state={{ mood: 'taste', line: verdict, tick: strength.score }} />
          </div>
        )}
        {embedded && <p className="taste-verdict">{verdict}</p>}

        <div className="taste-profile">
          <svg className="radar" viewBox="0 0 200 200" role="img" aria-label="Flavor profile">
            {[1, 0.66, 0.33].map((k) => (
              <polygon key={k} points={axes.map(([x, y]) => `${100 + x * R * k},${100 + y * R * k}`).join(' ')} fill="none" stroke="var(--line-strong)" strokeWidth="1" />
            ))}
            {axes.map(([x, y], i) => (
              <line key={i} x1="100" y1="100" x2={100 + x * R} y2={100 + y * R} stroke="var(--line)" />
            ))}
            <polygon className="radar-shape" points={points} fill="rgba(242, 107, 58, 0.2)" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
            {flavors.map((f, i) => (
              <text
                key={f.key}
                x={100 + axes[i][0] * (R + 18)}
                y={100 + axes[i][1] * (R + 16) + 4}
                textAnchor={axes[i][0] === 0 ? 'middle' : axes[i][0] > 0 ? 'start' : 'end'}
                className="radar-label"
              >
                {f.taste}
              </text>
            ))}
          </svg>
          <ul className="flavors">
            {flavors.map((f) => (
              <li key={f.key}>
                <span className="flavor-name">
                  {f.label}
                  <small>{f.taste}</small>
                </span>
                <span className="flavor-bar">
                  <span style={{ width: `${Math.round(f.value * 100)}%` }} />
                </span>
                <span className="flavor-value">{Math.round(f.value * 100)}</span>
              </li>
            ))}
          </ul>
        </div>

        {strength.tips.length > 0 && (
          <div className="seasoning">
            <p className="seasoning-title">Season to taste</p>
            <ul className="tips">
              {strength.tips.slice(0, 4).map((t) => (
                <li key={t.tip}>
                  <button type="button" className="tip" onClick={() => onJump(t.step)}>
                    <span className="tip-text">{t.tip}</span>
                    <span className="tip-step">
                      {stepTitle(t.step)}
                      <Icon name="arrowRight" size={12} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
