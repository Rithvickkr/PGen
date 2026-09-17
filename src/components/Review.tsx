import { useEffect, useState } from 'react';
import type { Answers } from '../types';
import { getLevel, str } from '../lib/answers';
import { wordCount } from '../lib/generate';
import { downloadText, shareUrl } from '../lib/storage';
import type { Strength } from '../lib/strength';
import { CHAT_TOOLS, getTarget, getTool, type Target } from '../lib/tools';
import { STEPS } from '../data/steps';
import { Icon } from './Icon';
import { PromptText } from './PromptText';
import { Meter } from './Journey';
import { useCopy } from './useCopy';

interface ReviewProps {
  prompt: string;
  answers: Answers;
  strength: Strength;
  onJump: (stepId: string) => void;
}

const LEVEL_LABEL = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };

export function followUps(outcome: string, target: Target, memoryFile?: string) {
  const first =
    outcome === 'validate'
      ? {
          title: 'Turn feedback into a plan',
          text: 'Thanks. Apply your suggestions to the scope, then turn it into a build-ready plan: tech stack with reasons, data model, screens, folder structure, and a phased roadmap. Don’t write code yet.',
        }
      : outcome === 'plan'
        ? {
            title: 'Start building',
            text: 'The plan looks good. Let’s start building Phase 1. Follow the plan and standards we agreed on, and stop when Phase 1 runs so I can test it.',
          }
        : {
            title: 'Continue to the next phase',
            text: 'Phase complete and tested. Let’s continue with the next phase. Keep the same approach and standards, and stop when it runs so I can test it.',
          };

  return [
    first,
    {
      title: 'Review the code',
      text: 'Review everything built so far as a senior engineer would. Look for bugs, security issues, missing error handling, and code quality problems. List findings by severity with file references, then fix them.',
    },
    {
      title: 'Add tests',
      text: 'Write tests for the most important logic and user flows built so far. Explain what each test covers and how to run them.',
    },
    {
      title: 'Deploy it',
      text: 'Walk me through deploying this to production step by step: hosting setup, environment variables, database, domain, and a final pre-launch checklist.',
    },
    target === 'agent'
      ? {
          title: 'Save progress',
          text: `Update ${memoryFile ?? 'AGENTS.md'} and PLAN.md with the current state: what’s done, key decisions and why, known issues, and the next steps.`,
        }
      : {
          title: 'Continue in a new chat',
          text: 'Summarize this project so I can continue in a new conversation: the idea, tech stack, architecture, decisions made and why, what’s done, and what’s next. Keep it compact.',
        },
  ];
}

/** Renders `code` spans written with backticks in how-to steps. */
export function withCode(text: string) {
  return text.split(/(`[^`]+`)/).map((part, i) =>
    part.startsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : <span key={i}>{part}</span>,
  );
}

type Tab = 'use' | 'strength' | 'next';

export function Review({ prompt, answers, strength, onJump }: ReviewProps) {
  const main = useCopy();
  const link = useCopy();
  const [tab, setTab] = useState<Tab>('use');
  const target = getTarget(answers);
  const tool = getTool(answers);
  const outcome = str(answers, 'outcome') || 'build';
  const name = str(answers, 'projectName');
  const slug = (name || 'starter').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'starter';
  const stepTitle = (id: string) => STEPS.find((s) => s.id === id)?.title ?? id;
  const prompts = followUps(outcome, target, tool.memoryFile);
  const toolLabel = tool.value === 'other' ? (target === 'agent' ? 'Coding agent' : 'AI chat') : tool.label;
  const openLinks = target === 'chat' ? (tool.url ? [tool] : CHAT_TOOLS.filter((t) => t.url)) : [];

  const tabs: { id: Tab; label: string }[] = [
    { id: 'use', label: 'How to use' },
    { id: 'strength', label: `Strength ${strength.score}` },
    { id: 'next', label: 'Follow-ups' },
  ];

  return (
    <div className="review">
      <section className="doc" aria-label="Your prompt">
        <div className="doc-head">
          <span className="doc-name">
            <Icon name="file" size={15} />
            {slug}-prompt.md
          </span>
          <span className="doc-meta">
            {LEVEL_LABEL[getLevel(answers)]} · {toolLabel} · {wordCount(prompt).toLocaleString()} words
          </span>
        </div>
        <div className="doc-body">
          <PromptText text={prompt} />
        </div>
      </section>

      <aside className="review-aside">
        <div className="panel panel-actions">
          <button type="button" className={`btn btn-accent btn-block${main.copied ? ' is-done' : ''}`} onClick={() => main.copy(prompt)}>
            <Icon name={main.copied ? 'check' : 'copy'} size={16} />
            {main.copied ? 'Copied to clipboard' : 'Copy prompt'}
          </button>
          <div className="btn-row">
            <button type="button" className="btn btn-ghost" onClick={() => downloadText(`${slug}-prompt.md`, prompt)}>
              <Icon name="download" size={14} />
              Download
            </button>
            <button type="button" className={`btn btn-ghost${link.copied ? ' is-done' : ''}`} onClick={() => link.copy(shareUrl(answers))}>
              <Icon name={link.copied ? 'check' : 'link'} size={14} />
              {link.copied ? 'Copied' : 'Share link'}
            </button>
          </div>
          {openLinks.length > 0 && (
            <div className="open-in">
              <span className="open-in-label">Open</span>
              {openLinks.map((t) => (
                <a key={t.value} className="open-in-link" href={t.url} target="_blank" rel="noreferrer">
                  {t.label}
                  <Icon name="external" size={12} />
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="panel panel-tabs">
          <div className="tabs" role="tablist" aria-label="More about your prompt">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`panel-${t.id}`}
                className={`tab${tab === t.id ? ' is-selected' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div key={tab} className="tab-panel" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === 'use' && (
              <ol className="howto">
                {tool.howto.map((line) => (
                  <li key={line}>{withCode(line)}</li>
                ))}
              </ol>
            )}

            {tab === 'strength' && (
              <div className="strength">
                <div className="strength-top">
                  <span className="strength-score">
                    <CountUp value={strength.score} />
                    <small>/100</small>
                  </span>
                  <span className="strength-label">{strength.label}</span>
                </div>
                <Meter value={strength.score} />
                {strength.tips.length > 0 ? (
                  <ul className="tips">
                    {strength.tips.slice(0, 5).map((t) => (
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
                ) : (
                  <p className="muted small">Nothing important is missing. This is a well-specified brief.</p>
                )}
              </div>
            )}

            {tab === 'next' && (
              <div className="followups">
                <p className="muted small">Send these after the AI responds.</p>
                {prompts.map((f) => (
                  <FollowUp key={f.title} title={f.title} text={f.text} />
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

export function FollowUp({ title, text }: { title: string; text: string }) {
  const { copied, copy } = useCopy();
  const [open, setOpen] = useState(false);
  return (
    <div className={`followup${open ? ' is-open' : ''}`}>
      <div className="followup-head">
        <button type="button" className="followup-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <Icon name="chevronDown" size={14} />
          {title}
        </button>
        <button type="button" className={`followup-copy${copied ? ' is-done' : ''}`} onClick={() => copy(text)} aria-label={`Copy the “${title}” prompt`}>
          <Icon name={copied ? 'check' : 'copy'} size={13} />
        </button>
      </div>
      {open && <p className="followup-text">{text}</p>}
    </div>
  );
}

function CountUp({ value, duration = 700 }: { value: number; duration?: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return <>{shown}</>;
}
