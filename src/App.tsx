import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AnswerValue, Answers } from './types';
import { STEPS } from './data/steps';
import type { Example } from './data/examples';
import { DEFAULT_ANSWERS, LEVELS, getLevel, isAnswered, isQuestionVisible, isStepVisible, str } from './lib/answers';
import { generatePrompt } from './lib/generate';
import { scorePrompt } from './lib/strength';
import { loadState, saveState } from './lib/storage';
import { Icon } from './components/Icon';
import { Preview } from './components/Preview';
import { Review } from './components/Review';
import { JourneyMap, Logo, QuestionScreen, Trail, Welcome, type Chapter, type FlowItem } from './components/Journey';
import { ConfirmDialog, Drawer, MoreMenu } from './components/Overlays';
import { RecipeCard, Serve } from './components/Kitchen';
import { KitchenScene } from './components/Scene';

type Dialog = { title: string; body: string; confirmLabel: string; onConfirm: () => void };
type Panel = 'preview' | 'map' | 'recipe' | null;

/** Every question in authoring order, used to find the nearest question when one disappears. */
const ALL_QUESTIONS = STEPS.flatMap((step) => step.questions.map((q) => q.id));

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
  const [cook, setCook] = useState({ tick: 0, stepId: '' });

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

  const posOf = useCallback((i: number, list: FlowItem[]) => (i < 0 ? 'welcome' : i >= list.length ? 'review' : `q:${list[i].q.id}`), []);

  // Auto-advance fires after a delay, so it reads the latest flow and position from a ref.
  const latest = useRef({ flow, index, answers });
  useEffect(() => {
    latest.current = { flow, index, answers };
  });

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
    // An answered question goes into the pot on the way to the next one.
    if (item && isAnswered(a, item.q.id)) setCook((c) => ({ tick: c.tick + 1, stepId: item.step.id }));
    goToIndex(i + 1);
  }, [goToIndex]);
  const back = () => goToIndex(index - 1);

  const update = useCallback((id: string, value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }, []);

  const hasContent = str(answers, 'oneLiner') !== '' || str(answers, 'problem') !== '' || str(answers, 'projectName') !== '';

  const loadExample = (ex: Example) => {
    setMenuOpen(false);
    const apply = () => {
      setAnswers({ ...DEFAULT_ANSWERS, ...ex.answers });
      setDirection('forward');
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
        setPos('welcome');
        setDialog(null);
      },
    });
  };

  const firstOpen = flow.findIndex((f) => !isAnswered(answers, f.q.id));
  const resumeIndex = firstOpen >= 0 ? firstOpen : flow.length;
  const current = !isWelcome && !isReview ? flow[index] : null;
  const chapterIdx = current ? chapters.findIndex((c) => c.step.id === current.step.id) : -1;

  return (
    <div className={`app${isWelcome ? ' is-welcome' : ''}`}>
      <header className="topbar">
        <div className="topbar-inner">
          <button type="button" className="brand" onClick={() => goToIndex(-1)} aria-label="PGen, back to the start">
            <Logo />
            <span className="brand-name">PGen</span>
          </button>

          {!isWelcome && <Trail chapters={chapters} position={index} total={flow.length} onSelect={goToIndex} />}

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
                    onClick={() => update('level', l.value)}
                    title={`${l.label} prompt`}
                  >
                    {l.label.slice(0, 3)}
                  </button>
                ))}
              </div>
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
            <MoreMenu open={menuOpen} onToggle={() => setMenuOpen((o) => !o)} onClose={() => setMenuOpen(false)} onPick={loadExample} onReset={reset} />
          </div>
        </div>
      </header>

      <main className={`stage${current ? ' stage-kitchen' : ''}${isReview ? ' stage-kitchen' : ''}`}>
        {isWelcome && (
          <div key={pos} className={`scene scene-${direction}`}>
            <Welcome
              resumable={hasContent}
              onStart={() => goToIndex(0)}
              onResume={() => goToIndex(resumeIndex)}
              onExample={loadExample}
              art={
                <div className="scene-frame scene-frame-welcome">
                  <KitchenScene mode="welcome" chapters={chapters} flow={flow} answers={answers} onStart={() => goToIndex(hasContent ? resumeIndex : 0)} />
                </div>
              }
            />
          </div>
        )}

        {current && (
          <div className="cook-layout">
            <div className="cook-main">
              <button type="button" className="back-link" onClick={back}>
                <Icon name="arrowLeft" size={15} />
                Back
              </button>
              <div key={pos} className={`scene scene-${direction}`}>
                <div className="notepad">
                  <QuestionScreen
                    item={current}
                    chapter={chapters[chapterIdx]}
                    chapterNumber={chapterIdx + 1}
                    chapterTotal={chapters.length}
                    position={index}
                    answers={answers}
                    onChange={update}
                    onNext={next}
                  />
                </div>
              </div>
            </div>
            <aside className="cook-side" aria-label="Your kitchen">
              <div className="scene-frame">
                <KitchenScene
                  mode="cooking"
                  chapters={chapters}
                  flow={flow}
                  answers={answers}
                  currentStepId={current.step.id}
                  cook={cook}
                  onSelectChapter={goToIndex}
                  onSetLevel={(l) => update('level', l)}
                  onTaste={() => setPanel('preview')}
                  onOpenRecipe={() => setPanel('recipe')}
                />
              </div>
              <p className="scene-hint">
                Tap a <b>jar</b> to jump to a step · turn a <b>knob</b> to change the level · click the <b>pot</b> to taste
              </p>
            </aside>
          </div>
        )}

        {isReview && (
          <>
            <button type="button" className="back-link" onClick={back}>
              <Icon name="arrowLeft" size={15} />
              Back
            </button>
            <div key={pos} className={`scene scene-${direction}`}>
              <Serve
                served={served}
                onServed={() => setServed(true)}
                chapters={chapters}
                flow={flow}
                answers={answers}
                onOpenMap={() => setPanel('map')}
                onSetLevel={(l) => update('level', l)}
                onTaste={() => setPanel('preview')}
              >
                <Review prompt={prompt} answers={answers} strength={strength} onJump={(stepId) => goToIndex(flow.findIndex((f) => f.step.id === stepId))} />
              </Serve>
            </div>
          </>
        )}
      </main>

      {panel && (
        <Drawer onClose={() => setPanel(null)} label={panel === 'map' ? 'Recipe steps' : panel === 'recipe' ? 'Recipe card' : 'Prompt preview'}>
          {panel === 'map' ? (
            <JourneyMap chapters={chapters} flow={flow} answers={answers} position={index} onSelect={goToIndex} onClose={() => setPanel(null)} />
          ) : panel === 'recipe' ? (
            <div className="recipe-panel">
              <div className="map-head">
                <div>
                  <div className="map-title">Your recipe so far</div>
                  <div className="map-meta">Every answer adds an ingredient to the pot</div>
                </div>
                <button type="button" className="icon-btn" onClick={() => setPanel(null)} aria-label="Close recipe card">
                  <Icon name="x" size={16} />
                </button>
              </div>
              <div className="recipe-panel-body">
                <RecipeCard chapters={chapters} flow={flow} answers={answers} />
              </div>
            </div>
          ) : (
            <Preview prompt={prompt} onClose={() => setPanel(null)} />
          )}
        </Drawer>
      )}

      {dialog && <ConfirmDialog {...dialog} onCancel={() => setDialog(null)} />}
    </div>
  );
}
