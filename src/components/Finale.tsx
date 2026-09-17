import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Answers, Level } from '../types';
import { getLevel, isAnswered, str } from '../lib/answers';
import { wordCount } from '../lib/generate';
import { downloadRecipeImage } from '../lib/recipeImage';
import { downloadText, shareUrl } from '../lib/storage';
import { buzz, play } from '../lib/sound';
import type { Strength } from '../lib/strength';
import { CHAT_TOOLS, getTarget, getTool } from '../lib/tools';
import { CHEF_TIPS } from '../data/kitchen';
import type { ChefState } from './Chef';
import { Icon } from './Icon';
import type { Chapter, FlowItem } from './Journey';
import { PromptText } from './PromptText';
import { FollowUp, followUps, withCode } from './Review';
import { TasteTest } from './TasteTest';
import { useCopy } from './useCopy';
import { World, type FinaleStage } from './World';

const LEVEL_LABEL = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };

type Tab = 'serve' | 'taste' | 'next';

export function Finale({
  answers,
  chapters,
  flow,
  prompt,
  strength,
  served,
  onServed,
  onJump,
  onOpenMap,
  onSetLevel,
  onTaste,
}: {
  answers: Answers;
  chapters: Chapter[];
  flow: FlowItem[];
  prompt: string;
  strength: Strength;
  served: boolean;
  onServed: () => void;
  onJump: (stepId: string) => void;
  onOpenMap: () => void;
  onSetLevel: (level: Level) => void;
  onTaste: () => void;
}) {
  const [stage, setStage] = useState<FinaleStage>(served ? 'done' : 'ready');
  const [chef, setChef] = useState<ChefState>({ mood: 'wave', line: CHEF_TIPS.review, tick: 1 });
  const [bell, setBell] = useState(0);
  const [tab, setTab] = useState<Tab>('serve');
  const [leaving, setLeaving] = useState(false);
  const timers = useRef<number[]>([]);
  const copy = useCopy();
  const link = useCopy();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  // The plate-up and cloche reveal take over the whole screen.
  const immersive = stage === 'plating' || stage === 'covered' || stage === 'revealed';
  useEffect(() => {
    if (!immersive) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [immersive]);
  const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, reduced ? 0 : ms));
  const say = (mood: ChefState['mood'], line: string) => setChef((c) => ({ mood, line, tick: c.tick + 1 }));

  const plate = () => {
    setStage('plating');
    play('pour');
    buzz(20);
    say('nod', 'Plating it up nice and neat…');
    at(1500, () => {
      setStage('covered');
      play('pop');
      say('wave', 'Lift the cloche when you’re ready. Drag it up or tap it.');
    });
  };

  const lift = () => {
    if (stage !== 'covered') return;
    setStage('revealed');
    play('lift');
    buzz(15);
    at(250, () => {
      play('ding');
      setBell((b) => b + 1);
      say('cheer', 'Bon appétit! Smell that.');
    });
    // Let the reveal breathe on the big screen, then ease back to the page as the ticket prints.
    at(2400, () => setLeaving(true));
    at(2850, () => {
      setLeaving(false);
      setStage('printing');
      play('print');
      window.scrollTo({ top: 0 });
    });
    at(4300, () => {
      setStage('done');
      onServed();
    });
  };

  const skip = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setLeaving(false);
    setStage('done');
    onServed();
  };

  const ring = () => {
    play('ding');
    buzz(10);
    setBell((b) => b + 1);
  };

  const target = getTarget(answers);
  const tool = getTool(answers);
  const name = str(answers, 'projectName');
  const slug = (name || 'starter').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'starter';
  const table = tool.value === 'other' ? (target === 'agent' ? 'Coding agent' : 'AI chat') : tool.label;
  let orderNo = 0;
  for (const ch of name || 'pgen') orderNo = (orderNo * 31 + ch.charCodeAt(0)) % 9000;
  const printed = stage === 'printing' || stage === 'done';
  const openLinks = target === 'chat' ? (tool.url ? [tool] : CHAT_TOOLS.filter((t) => t.url)) : [];

  const saveImage = () => {
    const parts = chapters.map((c) => {
      const items = flow.slice(c.start, c.start + c.count);
      return { stepId: c.step.id, done: items.filter((f) => isAnswered(answers, f.q.id)).length, total: items.length };
    });
    const pieces = flow.filter((f) => isAnswered(answers, f.q.id)).map((f) => ({ stepId: f.step.id, id: f.q.id }));
    void downloadRecipeImage(answers, parts, pieces);
  };

  const heading =
    stage === 'ready'
      ? { tag: 'Order up', title: `${name || 'Your dish'} is ready for the pass.`, sub: 'Everything’s cooked. Plate it up, lift the cloche, and your prompt prints on the order ticket.' }
      : stage === 'plating'
        ? { tag: 'At the pass', title: 'Plating it up…', sub: 'Arranging every ingredient you added.' }
        : stage === 'covered'
          ? { tag: 'At the pass', title: 'Lift the cloche.', sub: 'Drag the silver dome up, or tap it, to reveal your dish.' }
          : { tag: 'Served', title: 'Bon appétit. Your prompt is ready.', sub: 'Tear off the ticket to copy it, then paste it into your AI tool.' };

  return (
    <div className="finale">
      {immersive &&
        createPortal(
          <div className={`finale-stage stage-${stage}${leaving ? ' is-leaving' : ''}`} role="dialog" aria-modal="true" aria-label="Serving your dish">
            <div className="finale-stage-world">
              <World
                mode="finale"
                station={3}
                focus
                chapters={chapters}
                flow={flow}
                answers={answers}
                chef={chef}
                finale={stage}
                bellTick={bell}
                onLiftCloche={lift}
                onBell={ring}
              />
            </div>
            <div key={stage} className="finale-stage-head">
              <p className="chapter-tag">{stage === 'revealed' ? 'Served' : 'At the pass'}</p>
              <h2>{stage === 'plating' ? 'Plating it up…' : stage === 'covered' ? 'Lift the cloche.' : 'Bon appétit!'}</h2>
              <p>
                {stage === 'plating'
                  ? `Arranging everything that went into ${name || 'your dish'}.`
                  : stage === 'covered'
                    ? 'Drag the silver dome up, or tap it, to reveal your dish.'
                    : 'Your order ticket is heading to the printer.'}
              </p>
            </div>
            <div className="finale-stage-actions">
              {stage === 'covered' && (
                <button type="button" className="btn btn-accent btn-lg" onClick={lift} autoFocus>
                  Lift the cloche
                </button>
              )}
            </div>
            <button type="button" className="btn btn-quiet btn-sm finale-stage-skip" onClick={skip}>
              Skip
            </button>
          </div>,
          document.body,
        )}
      <header className="finale-head">
        <p className="chapter-tag">{heading.tag}</p>
        <h1 className="finale-title">{heading.title}</h1>
        <p className="finale-sub">
          {heading.sub}
          {stage === 'done' && (
            <>
              {' '}
              Want to change something? Open the{' '}
              <button type="button" className="inline-link" onClick={onOpenMap}>
                recipe steps
              </button>
              .
            </>
          )}
        </p>
      </header>

      <div className="finale-grid">
        <div className="finale-kitchen">
          <div className="world-frame world-frame-finale">
            <World
              mode="finale"
              station={3}
              enterFrom={served ? 3 : 2}
              chapters={chapters}
              flow={flow}
              answers={answers}
              chef={chef}
              finale={stage}
              bellTick={bell}
              onSetLevel={onSetLevel}
              onTaste={onTaste}
              onChef={() => setTab('taste')}
              onLiftCloche={lift}
              onBell={ring}
              onSelectChapter={(i) => onJump(flow[i]?.step.id ?? 'idea')}
            />
          </div>
          <div className="finale-actions">
            {stage === 'ready' && (
              <button type="button" className="btn btn-accent btn-lg" onClick={plate}>
                <Icon name="sparkle" size={16} />
                Plate it up
              </button>
            )}
            {stage === 'plating' && (
              <button type="button" className="btn btn-ghost btn-lg" disabled>
                Plating…
              </button>
            )}
            {stage === 'covered' && (
              <button type="button" className="btn btn-accent btn-lg" onClick={lift}>
                Lift the cloche
              </button>
            )}
            {(stage === 'revealed' || stage === 'printing') && <span className="finale-note">Printing your order ticket…</span>}
            {stage === 'done' && (
              <span className="finale-note">
                Tip: ring the <b>bell</b> for luck, or tap the <b>chef</b> for a taste test.
              </span>
            )}
          </div>
        </div>

        <aside className="ticket-col" aria-label="Order ticket">
          <div className="printer-slot" aria-hidden="true" />
          {printed ? (
            <article className={`order-ticket${stage === 'printing' ? ' is-printing' : ''}`}>
              <header className="order-head">
                <div className="order-row">
                  <span>ORDER #{String(orderNo + 1000)}</span>
                  <span>TABLE: {table.toUpperCase()}</span>
                </div>
                <h2 className="order-name">{name || 'Untitled recipe'}</h2>
                <div className="order-row muted">
                  <span>{LEVEL_LABEL[getLevel(answers)]}</span>
                  <span>{wordCount(prompt).toLocaleString()} words</span>
                </div>
              </header>
              <div className="order-body">
                <PromptText text={prompt} />
              </div>
              <footer className="order-foot">
                <button type="button" className={`btn btn-accent btn-block${copy.copied ? ' is-done' : ''}`} onClick={() => { void copy.copy(prompt); play('pop'); }}>
                  <Icon name={copy.copied ? 'check' : 'copy'} size={16} />
                  {copy.copied ? 'Torn off and copied' : 'Tear off & copy'}
                </button>
                <div className="order-actions">
                  <button type="button" className={`btn btn-ghost btn-sm${link.copied ? ' is-done' : ''}`} onClick={() => link.copy(shareUrl(answers))}>
                    <Icon name={link.copied ? 'check' : 'link'} size={14} />
                    {link.copied ? 'Link copied' : 'Pin it up'}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadText(`${slug}-prompt.md`, prompt)}>
                    <Icon name="download" size={14} />
                    .md
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={saveImage}>
                    <Icon name="file" size={14} />
                    Recipe card
                  </button>
                </div>
              </footer>
            </article>
          ) : (
            <div className="ticket-waiting">
              <p>Your order ticket prints here once the dish is served.</p>
            </div>
          )}
        </aside>
      </div>

      {stage === 'done' && (
        <section className="finale-extras">
          <div className="tabs" role="tablist" aria-label="After serving">
            {(
              [
                ['serve', 'How to serve'],
                ['taste', `Taste test · ${strength.score}`],
                ['next', 'Next courses'],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} className={`tab${tab === id ? ' is-selected' : ''}`} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>
          <div key={tab} className="tab-panel" role="tabpanel">
            {tab === 'serve' && (
              <div className="serve-howto">
                <ol className="howto">
                  {tool.howto.map((line) => (
                    <li key={line}>{withCode(line)}</li>
                  ))}
                </ol>
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
            )}
            {tab === 'taste' && <TasteTest answers={answers} strength={strength} onJump={onJump} embedded />}
            {tab === 'next' && (
              <div className="followups">
                <p className="muted small">Send these after the AI responds.</p>
                {followUps(str(answers, 'outcome') || 'build', target, tool.memoryFile).map((f) => (
                  <FollowUp key={f.title} title={f.title} text={f.text} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
