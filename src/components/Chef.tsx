export type ChefMood = 'idle' | 'wave' | 'nod' | 'taste' | 'cheer';

export interface ChefState {
  mood: ChefMood;
  line: string;
  /** Changes on every reaction so the animation replays. */
  tick: number;
}

/** A small, friendly chef who reacts to what's happening in the kitchen. */
export function Chef({ state, onClick, compact = false }: { state: ChefState; onClick?: () => void; compact?: boolean }) {
  return (
    <div className={`chef${compact ? ' chef-compact' : ''}`}>
      {state.line && (
        <p key={`line-${state.tick}`} className="chef-bubble" role="status" aria-live="polite">
          {state.line}
        </p>
      )}
      <button type="button" className="chef-button" onClick={onClick} aria-label="Ask the chef for a taste test" title="Taste test">
        <svg key={`chef-${state.tick}`} className={`chef-svg chef-${state.mood}`} viewBox="0 0 120 150" aria-hidden="true">
          {/* Body and apron */}
          <path className="chef-body" d="M24 150 C 24 112 40 98 60 98 C 80 98 96 112 96 150 Z" fill="#ffffff" stroke="rgba(90,60,30,0.14)" strokeWidth="1.5" />
          <path d="M42 150 V 118 Q 60 110 78 118 V 150 Z" fill="var(--accent)" opacity="0.9" />
          <circle cx="60" cy="112" r="2.2" fill="#d9cdb8" />
          <path d="M52 100 L60 110 L68 100" fill="none" stroke="#e7ddcf" strokeWidth="3" strokeLinecap="round" />

          {/* Arm: waves, tastes with a spoon, or cheers */}
          <g className="chef-arm">
            <path d="M92 124 C 104 118 108 106 106 96" stroke="#ffffff" strokeWidth="11" strokeLinecap="round" fill="none" />
            <path d="M92 124 C 104 118 108 106 106 96" stroke="rgba(90,60,30,0.12)" strokeWidth="12.5" strokeLinecap="round" fill="none" opacity="0.5" />
            <circle cx="106" cy="92" r="6" fill="#f2c9a5" />
            <g className="chef-spoon">
              <path d="M104 90 L 84 62" stroke="#b8c0c8" strokeWidth="3" strokeLinecap="round" />
              <ellipse cx="82" cy="58" rx="5" ry="7" fill="#c9d0d6" transform="rotate(-35 82 58)" />
            </g>
          </g>

          {/* Head */}
          <g className="chef-head">
            <circle cx="60" cy="72" r="26" fill="#f6d2b1" />
            <circle cx="36" cy="74" r="5" fill="#efc29c" />
            <circle cx="84" cy="74" r="5" fill="#efc29c" />
            <g className="chef-eyes">
              <ellipse cx="51" cy="72" rx="2.6" ry="3.2" fill="#3a2e26" />
              <ellipse cx="69" cy="72" rx="2.6" ry="3.2" fill="#3a2e26" />
            </g>
            <circle cx="45" cy="81" r="4" fill="#f4a896" opacity="0.5" />
            <circle cx="75" cy="81" r="4" fill="#f4a896" opacity="0.5" />
            <path className="chef-mouth" d="M53 84 Q 60 90 67 84" fill="none" stroke="#3a2e26" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M48 64 Q 51 62 54 64 M66 64 Q 69 62 72 64" fill="none" stroke="#8a6a52" strokeWidth="1.8" strokeLinecap="round" />
            {/* Hat */}
            <g className="chef-hat">
              <rect x="38" y="42" width="44" height="12" rx="3" fill="#ffffff" stroke="rgba(90,60,30,0.14)" strokeWidth="1.5" />
              <path
                d="M40 44 C 28 42 26 24 40 22 C 42 10 58 6 64 14 C 72 6 90 12 86 26 C 96 30 92 44 80 44 Z"
                fill="#ffffff"
                stroke="rgba(90,60,30,0.14)"
                strokeWidth="1.5"
              />
            </g>
          </g>

          {/* Cheer sparkles */}
          <g className="chef-sparkles" fill="var(--accent)">
            <path d="M16 40 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z" />
            <path d="M104 30 l1.5 4.5 4.5 1.5 -4.5 1.5 -1.5 4.5 -1.5 -4.5 -4.5 -1.5 4.5 -1.5z" />
          </g>
        </svg>
      </button>
    </div>
  );
}
