import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { AnswerValue, Answers, Level } from './types';
import { STEPS } from './data/steps';
import type { Example } from './data/examples';
import { CHEF_REACTIONS, CHEF_TIPS, pickLine, stationFor } from './data/kitchen';
import { DEFAULT_ANSWERS, LEVELS, getLevel, isAnswered, isQuestionVisible, isStepVisible, str } from './lib/answers';
import { generatePrompt } from './lib/generate';
import { buzz, isMuted, play, setMuted, subscribeSound, type SoundName } from './lib/sound';
import { scorePrompt } from './lib/strength';
import { loadState, saveState } from './lib/storage';
import type { ChefState } from './components/Chef';
import type { KitchenAction } from './components/Controls';
import { Finale } from './components/Finale';
import { Icon } from './components/Icon';
import { JourneyMap, Logo, QuestionScreen, Trail, Welcome, type Chapter, type FlowItem } from './components/Journey';
import { RecipeCard } from './components/Kitchen';
import { ConfirmDialog, Drawer, MoreMenu } from './components/Overlays';
import { Preview } from './components/Preview';
import { Review } from './components/Review';
import { TasteTest } from './components/TasteTest';
import { TicketRail } from './components/Tickets';
import { World } from './components/World';

type Dialog = { title: string; body: string; confirmLabel: string; onConfirm: () => void };
type Panel = 'preview' | 'map' | 'recipe' | 'taste' | null;

/** Every question in authoring order, used to find the nearest question when one disappears. */
const ALL_QUESTIONS = STEPS.flatMap((step) => step.questions.map((q) => q.id));

const SOUND_FOR: Record<KitchenAction, SoundName> = {
  chop: 'chop',
  stir: 'stir',
  add: 'plop',
  pick: 'pick',
  remove: 'pop',
  coin: 'coin',
  tick: 'tick',
};

const QUICK_KEY = 'pgen:quick';

export default function App() {
  const [initial] = useState(loadState);
  const [answers, setAnswers] = useState<Answers>(initial.answers);
  // 'welcome' | 'review' | 'q:<questionId>' (older saves may hold a step id)
  const [pos, setPos] = useState(initial.stepId);
  const [panel, setPanel] = useState<Panel>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [served, setServed] = useState(false);
  const [action, setAction] = useState<{ type: KitchenAction; tick: number; stepId: string }>({ type: 'add', tick: 0, stepId: '' });
  const [chef, setChef] = useState<ChefState>({ mood: 'wave', line: 'Hi! I’m your chef today. Ready to cook something?', tick: 0 });
  const [quick, setQuick] = useState(() => {
    try {
      return localStorage.getItem(QUICK_KEY) === 'on';
    } catch {
      return false;
    }
  });
  const muted = useSyncExternalStore(subscribeSound, isMuted);

  useEffect(() => saveState(answers, pos), [answers, pos]);

  const flow = useMemo<FlowItem[]>(
    () =>
      STEPS.filter((s) => s.questions.length > 0 && isStepVisible(s, answers)).flatMap((step) =>
        step.questions.filter((q) => isQuestionVisible(q, answers)).map((q) => ({ q, step })),
      ),
    [answers],
  );

  const chapters = useMemo<Chapter[]>(() => {
    const out: Chapter[] = [];
    flow.forEach((item, i) => {
      const last = out[out.length - 1];
      if (last && last.step.id === item.step.id) last.count++;
      else out.push({ step: item.step, start: i, count: 1 });
    });
    return out;
  }, [flow]);

  /** -1 = welcome, 0..n-1 = a question, n = the finished prompt. */
  const index = useMemo(() => {
    if (pos === 'review') return flow.length;
    if (pos.startsWith('q:')) {
      const id = pos.slice(2);
      const found = flow.findIndex((f) => f.q.id === id);
      if (found >= 0) return found;
      // The question is hidden now (level or platform changed): continue from the nearest one after it.
      const order = ALL_QUESTIONS.indexOf(id);
      const nextVisible = flow.findIndex((f) => ALL_QUESTIONS.indexOf(f.q.id) >= order);
      return nextVisible >= 0 ? nextVisible : flow.length;
    }
    const stepStart = flow.findIndex((f) => f.step.id === pos);
    return stepStart >= 0 && pos !== 'start' ? stepStart : -1;
  }, [pos, flow]);

  const prompt = useMemo(() => generatePrompt(answers), [answers]);
  const strength = useMemo(() => scorePrompt(answers), [answers]);
  const level = getLevel(answers);
  const isWelcome = index < 0;
  const isReview = index >= flow.length;
  const current = !isWelcome && !isReview ? flow[index] : null;
  const chapterIdx = current ? chapters.findIndex((c) => c.step.id === current.step.id) : -1;
  const station = isWelcome ? 0 : isReview ? 3 : stationFor(current?.step.id);

  const posOf = useCallback((i: number, list: FlowItem[]) => (i < 0 ? 'welcome' : i >= list.length ? 'review' : `q:${list[i].q.id}`), []);

  // Delayed callbacks read the latest state from here.
  const latest = useRef({ flow, index, answers });
  useEffect(() => {
    latest.current = { flow, index, answers };
  });

  /* ---------------- The chef ---------------- */

  const lastReaction = useRef(0);
  const say = useCallback((mood: ChefState['mood'], line: string) => {
    setChef((c) => ({ mood, line, tick: c.tick + 1 }));
  }, []);

  // A tip whenever a new chapter starts.
  const stepId = current?.step.id;
  useEffect(() => {
    if (stepId && CHEF_TIPS[stepId]) say('wave', CHEF_TIPS[stepId]);
  }, [stepId, say]);

  // Moving between stations: a whoosh as the camera glides.
  const lastStation = useRef(station);
  useEffect(() => {
    if (station !== lastStation.current && !quick) play('whoosh');
    lastStation.current = station;
  }, [station, quick]);

  // Finishing a chapter earns a cheer.
  const chapterComplete = current ? flow.slice(chapters[chapterIdx].start, chapters[chapterIdx].start + chapters[chapterIdx].count).every((f) => isAnswered(answers, f.q.id)) : false;
  const wasComplete = useRef({ id: stepId, done: chapterComplete });
  useEffect(() => {
    const prev = wasComplete.current;
    if (stepId && prev.id === stepId && !prev.done && chapterComplete && !quick) {
      window.setTimeout(() => {
        play('pop');
        say('cheer', 'That’s this part done! Looking delicious.');
      }, 500);
    }
    wasComplete.current = { id: stepId, done: chapterComplete };
  }, [stepId, chapterComplete, quick, say]);

  /* ---------------- Cooking actions ---------------- */

  const lastSound = useRef<Partial<Record<KitchenAction, number>>>({});
  const act = useCallback(
    (type: KitchenAction) => {
      const now = performance.now();
      const gap = type === 'chop' ? 60 : type === 'stir' ? 200 : 0;
      if (gap && now - (lastSound.current[type] ?? 0) < gap) return;
      lastSound.current[type] = now;
      play(SOUND_FOR[type]);
      if (type !== 'stir') buzz(type === 'chop' ? 5 : 12);
      const { flow: list, index: i } = latest.current;
      const id = list[i]?.step.id ?? '';
      setAction((a) => ({ type, tick: a.tick + 1, stepId: id }));

      if (type === 'chop' || type === 'stir') return;
      if (now - lastReaction.current < 1200) {
        setChef((c) => ({ ...c, mood: 'nod', tick: c.tick + 1 }));
        return;
      }
      lastReaction.current = now;
      const seed = Math.floor(now);
      const lines = type === 'remove' ? CHEF_REACTIONS.remove : type === 'coin' ? CHEF_REACTIONS.coin : type === 'tick' ? CHEF_REACTIONS.tick : CHEF_REACTIONS.add;
      say('nod', pickLine(lines, seed));
    },
    [say],
  );

  /* ---------------- Navigation ---------------- */

  const goToIndex = useCallback(
    (i: number) => {
      const { flow: list, index: current } = latest.current;
      const target = Math.max(-1, Math.min(i, list.length));
      setDirection(target >= current ? 'forward' : 'back');
      setPos(posOf(target, list));
      setPanel(null);
      window.scrollTo({ top: 0 });
    },
    [posOf],
  );

  const next = useCallback(() => {
    const { flow: list, index: i, answers: a } = latest.current;
    const item = list[i];
    if (item && !quick) {
      if (isAnswered(a, item.q.id)) {
        // Typed answers go into the pot on the way to the next question; choices already went in when picked.
        if (item.q.type === 'text' || item.q.type === 'textarea') act('add');
      } else {
        say('idle', pickLine(CHEF_REACTIONS.skip, i));
      }
    }
    goToIndex(i + 1);
  }, [goToIndex, act, say, quick]);

  const back = () => goToIndex(index - 1);

  const update = useCallback((id: string, value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }, []);

  const setLevel = useCallback(
    (l: Level) => {
      if (latest.current.answers.level !== l) {
        update('level', l);
        play('tick');
        buzz(8);
      }
    },
    [update],
  );

  const dropIngredient = useCallback(
    (qid: string, value: string) => {
      const existing = latest.current.answers[qid];
      const list = Array.isArray(existing) ? existing : [];
      if (list.includes(value)) return;
      update(qid, [...list, value]);
      act('add');
    },
    [update, act],
  );

  const goToStation = (s: number) => {
    const first = chapters.find((c) => stationFor(c.step.id) === s);
    if (first) goToIndex(first.start);
    else if (s === 3) goToIndex(flow.length);
  };

  const jumpToStep = (id: string) => {
    const i = flow.findIndex((f) => f.step.id === id);
    goToIndex(i >= 0 ? i : 0);
  };

  /* ---------------- Examples, reset, quick mode ---------------- */

  const hasContent = str(answers, 'oneLiner') !== '' || str(answers, 'problem') !== '' || str(answers, 'projectName') !== '';

  const loadExample = (ex: Example) => {
    setMenuOpen(false);
    const apply = () => {
      setAnswers({ ...DEFAULT_ANSWERS, ...ex.answers });
      setDirection('forward');
      setServed(false);
      setPos('review');
      setDialog(null);
    };
    if (hasContent) {
      setDialog({
        title: `Load “${ex.title}”?`,
        body: 'This replaces your current answers with the example. Your answers can’t be recovered afterwards.',
        confirmLabel: 'Load example',
        onConfirm: apply,
      });
    } else apply();
  };

  const reset = () => {
    setMenuOpen(false);
    setDialog({
      title: 'Start over?',
      body: 'All your answers will be cleared. This can’t be undone.',
      confirmLabel: 'Clear answers',
      onConfirm: () => {
        setAnswers({ ...DEFAULT_ANSWERS, level });
        setDirection('back');
        setServed(false);
        setPos('welcome');
        setDialog(null);
      },
    });
  };

  const toggleQuick = () => {
    setQuick((q) => {
      try {
        localStorage.setItem(QUICK_KEY, q ? 'off' : 'on');
      } catch {
        /* storage unavailable */
      }
      return !q;
    });
    setMenuOpen(false);
  };

  const firstOpen = flow.findIndex((f) => !isAnswered(answers, f.q.id));
  const resumeIndex = firstOpen >= 0 ? firstOpen : flow.length;
  const cooking = !quick;

  return (
    <div className={`app${isWelcome ? ' is-welcome' : ''}${quick ? ' is-quick' : ''}`}>
      <header className="topbar">
        <div className="topbar-inner">
          <button type="button" className="brand" onClick={() => goToIndex(-1)} aria-label="PGen, back to the start">
            <Logo />
            <span className="brand-name">PGen</span>
          </button>

          {!isWelcome &&
            (cooking ? (
              <TicketRail chapters={chapters} flow={flow} answers={answers} position={index} onSelect={goToIndex} />
            ) : (
              <Trail chapters={chapters} position={index} total={flow.length} onSelect={goToIndex} />
            ))}

          <div className="topbar-actions">
            {!isWelcome && (
              <div className="segmented" role="radiogroup" aria-label="Prompt level">
                {LEVELS.map((l) => (
                  <button
                    key={l.value}
                    type="button"
                    role="radio"
                    aria-checked={level === l.value}
                    className={level === l.value ? 'is-selected' : ''}
                    onClick={() => setLevel(l.value)}
                    title={`${l.label} prompt`}
                  >
                    {l.label.slice(0, 3)}
                  </button>
                ))}
              </div>
            )}
            {cooking && (
              <button
                type="button"
                className="icon-btn"
                onClick={() => {
                  setMuted(!muted);
                  if (muted) window.setTimeout(() => play('pop'), 20);
                }}
                aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
                aria-pressed={!muted}
                title={muted ? 'Sound off' : 'Sound on'}
              >
                <Icon name={muted ? 'mute' : 'volume'} size={17} />
              </button>
            )}
            {!isWelcome && (
              <button type="button" className="icon-btn" onClick={() => setPanel('map')} aria-label="Recipe steps" title="Recipe steps">
                <Icon name="map" size={17} />
              </button>
            )}
            {!isWelcome && !isReview && (
              <button type="button" className="icon-btn" onClick={() => setPanel('preview')} aria-label="Preview prompt" title="Preview prompt">
                <Icon name="eye" size={17} />
              </button>
            )}
            <MoreMenu
              open={menuOpen}
              onToggle={() => setMenuOpen((o) => !o)}
              onClose={() => setMenuOpen(false)}
              onPick={loadExample}
              onReset={reset}
              quick={quick}
              onToggleQuick={toggleQuick}
            />
          </div>
        </div>
      </header>

      <main className={`stage${current || (isReview && cooking) ? ' stage-kitchen' : ''}${isReview && quick ? ' stage-wide' : ''}`}>
        {isWelcome && (
          <div key={pos} className={`scene scene-${direction}`}>
            <Welcome
              resumable={hasContent}
              onStart={() => goToIndex(0)}
              onResume={() => goToIndex(resumeIndex)}
              onExample={loadExample}
              art={
                cooking ? (
                  <div className="world-frame world-frame-welcome">
                    <World
                      mode="welcome"
                      station={0}
                      chapters={chapters}
                      flow={flow}
                      answers={answers}
                      chef={chef}
                      onStart={() => goToIndex(hasContent ? resumeIndex : 0)}
                      onChef={() => goToIndex(hasContent ? resumeIndex : 0)}
                    />
                  </div>
                ) : null
              }
            />
          </div>
        )}

        {current && (
          <div className={`cook-layout${quick ? ' is-quick' : ''}`}>
            <div className="cook-main">
              <button type="button" className="back-link" onClick={back}>
                <Icon name="arrowLeft" size={15} />
                Back
              </button>
              <div key={pos} className={`scene scene-${direction}`}>
                <div className={cooking ? 'notepad' : ''}>
                  <QuestionScreen
                    item={current}
                    chapter={chapters[chapterIdx]}
                    chapterNumber={chapterIdx + 1}
                    chapterTotal={chapters.length}
                    position={index}
                    answers={answers}
                    onChange={update}
                    onNext={next}
                    cooking={cooking}
                    act={act}
                  />
                </div>
              </div>
            </div>
            {cooking && (
              <aside className="cook-side" aria-label="Your kitchen">
                <div className="world-frame">
                  <World
                    mode="cooking"
                    station={station}
                    chapters={chapters}
                    flow={flow}
                    answers={answers}
                    currentStepId={current.step.id}
                    currentType={current.q.type}
                    currentValue={answers[current.q.id]}
                    action={action}
                    chef={chef}
                    onSelectChapter={goToIndex}
                    onSelectStation={goToStation}
                    onSetLevel={setLevel}
                    onTaste={() => setPanel('preview')}
                    onChef={() => setPanel('taste')}
                    onOpenRecipe={() => setPanel('recipe')}
                    onDropIngredient={dropIngredient}
                  />
                </div>
                <p className="scene-hint">
                  Click a <b>jar</b> or <b>ticket</b> to jump · turn a <b>knob</b> for the level · click the <b>pot</b> to taste · tap the <b>chef</b> for a taste test
                </p>
              </aside>
            )}
          </div>
        )}

        {isReview &&
          (cooking ? (
            <div key={pos} className={`scene scene-${direction}`}>
              <button type="button" className="back-link" onClick={back}>
                <Icon name="arrowLeft" size={15} />
                Back
              </button>
              <Finale
                answers={answers}
                chapters={chapters}
                flow={flow}
                prompt={prompt}
                strength={strength}
                served={served}
                onServed={() => setServed(true)}
                onJump={jumpToStep}
                onOpenMap={() => setPanel('map')}
                onSetLevel={setLevel}
                onTaste={() => setPanel('preview')}
              />
            </div>
          ) : (
            <>
              <button type="button" className="back-link" onClick={back}>
                <Icon name="arrowLeft" size={15} />
                Back
              </button>
              <div key={pos} className={`scene scene-${direction}`}>
                <header className="finale-head">
                  <p className="chapter-tag">All done</p>
                  <h1 className="finale-title">Your prompt is ready.</h1>
                  <p className="finale-sub">Copy it into your AI tool and answer any questions it asks.</p>
                </header>
                <Review prompt={prompt} answers={answers} strength={strength} onJump={jumpToStep} />
              </div>
            </>
          ))}
      </main>

      {panel && (
        <Drawer
          onClose={() => setPanel(null)}
          label={panel === 'map' ? 'Recipe steps' : panel === 'recipe' ? 'Recipe card' : panel === 'taste' ? 'Taste test' : 'Prompt preview'}
        >
          {panel === 'map' ? (
            <JourneyMap chapters={chapters} flow={flow} answers={answers} position={index} onSelect={goToIndex} onClose={() => setPanel(null)} />
          ) : panel === 'recipe' ? (
            <div className="recipe-panel">
              <div className="map-head">
                <div>
                  <div className="map-title">Your recipe so far</div>
                  <div className="map-meta">Every answer adds an ingredient</div>
                </div>
                <button type="button" className="icon-btn" onClick={() => setPanel(null)} aria-label="Close recipe card">
                  <Icon name="x" size={16} />
                </button>
              </div>
              <div className="recipe-panel-body">
                <RecipeCard chapters={chapters} flow={flow} answers={answers} />
              </div>
            </div>
          ) : panel === 'taste' ? (
            <TasteTest answers={answers} strength={strength} onJump={jumpToStep} onClose={() => setPanel(null)} />
          ) : (
            <Preview prompt={prompt} onClose={() => setPanel(null)} />
          )}
        </Drawer>
      )}

      {dialog && <ConfirmDialog {...dialog} onCancel={() => setDialog(null)} />}
    </div>
  );
}
