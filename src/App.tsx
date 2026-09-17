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

type Dialog = { title: string; body: string; confirmLabel: string; onConfirm: () => void };
type Panel = 'preview' | 'map' | null;

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
  const latest = useRef({ flow, index });
  useEffect(() => {
    latest.current = { flow, index };
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

  const next = useCallback(() => goToIndex(latest.current.index + 1), [goToIndex]);
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
              <button type="button" className="icon-btn" onClick={() => setPanel('map')} aria-label="Journey map" title="Journey map">
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

      <main className={`stage${isReview ? ' stage-wide' : ''}`}>
        {!isWelcome && (
          <button type="button" className="back-link" onClick={back}>
            <Icon name="arrowLeft" size={15} />
            Back
          </button>
        )}

        <div key={pos} className={`scene scene-${direction}`}>
          {isWelcome && (
            <Welcome
              resumable={hasContent}
              onStart={() => goToIndex(0)}
              onResume={() => goToIndex(resumeIndex)}
              onExample={loadExample}
            />
          )}

          {current && (
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
          )}

          {isReview && (
            <>
              <header className="finale-head">
                <p className="chapter-tag">The end of the journey</p>
                <h1 className="finale-title">Your prompt is ready.</h1>
                <p className="finale-sub">
                  Copy it into your AI tool and answer any questions it asks. You can revisit any answer from the{' '}
                  <button type="button" className="inline-link" onClick={() => setPanel('map')}>
                    journey map
                  </button>
                  .
                </p>
              </header>
              <Review prompt={prompt} answers={answers} strength={strength} onJump={(stepId) => goToIndex(flow.findIndex((f) => f.step.id === stepId))} />
            </>
          )}
        </div>
      </main>

      {panel && (
        <Drawer onClose={() => setPanel(null)} label={panel === 'map' ? 'Journey map' : 'Prompt preview'}>
          {panel === 'map' ? (
            <JourneyMap chapters={chapters} flow={flow} answers={answers} position={index} onSelect={goToIndex} onClose={() => setPanel(null)} />
          ) : (
            <Preview prompt={prompt} onClose={() => setPanel(null)} />
          )}
        </Drawer>
      )}

      {dialog && <ConfirmDialog {...dialog} onCancel={() => setDialog(null)} />}
    </div>
  );
}
