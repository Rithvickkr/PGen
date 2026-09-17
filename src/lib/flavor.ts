import type { Answers } from '../types';
import { hasUI } from './answers';
import { createReader, type Reader } from './reader';

export interface Flavor {
  key: 'clarity' | 'detail' | 'scope' | 'context';
  label: string;
  taste: string;
  value: number;
}

type Check = { id: string; ok: (r: Reader) => boolean; when?: (a: Answers) => boolean };

const len = (id: string, n: number) => (r: Reader) => r.text(id).length >= n;
const picked = (id: string) => (r: Reader) => r.text(id) !== '' || r.list(id).length > 0;

const GROUPS: { key: Flavor['key']; label: string; taste: string; checks: Check[] }[] = [
  {
    key: 'clarity',
    label: 'Clarity',
    taste: 'Salt',
    checks: [
      { id: 'oneLiner', ok: len('oneLiner', 15) },
      { id: 'problem', ok: len('problem', 30) },
      { id: 'targetUsers', ok: len('targetUsers', 20) },
      { id: 'platform', ok: picked('platform') },
      { id: 'alternatives', ok: len('alternatives', 15) },
    ],
  },
  {
    key: 'detail',
    label: 'Detail',
    taste: 'Richness',
    checks: [
      { id: 'userJourney', ok: len('userJourney', 40) },
      { id: 'coreFeatures', ok: (r) => r.list('coreFeatures').length >= 3 },
      { id: 'commonFeatures', ok: picked('commonFeatures') },
      { id: 'dataEntities', ok: len('dataEntities', 20) },
      { id: 'designStyle', ok: picked('designStyle'), when: hasUI },
      { id: 'edgeCases', ok: len('edgeCases', 20) },
    ],
  },
  {
    key: 'scope',
    label: 'Scope',
    taste: 'Balance',
    checks: [
      { id: 'outcome', ok: picked('outcome') },
      { id: 'timeline', ok: picked('timeline') },
      { id: 'successCriteria', ok: len('successCriteria', 20) },
      { id: 'niceToHave', ok: picked('niceToHave') },
      { id: 'outOfScope', ok: picked('outOfScope') },
    ],
  },
  {
    key: 'context',
    label: 'Context',
    taste: 'Aroma',
    checks: [
      { id: 'experience', ok: picked('experience') },
      { id: 'stackMode', ok: picked('stackMode') },
      { id: 'hosting', ok: picked('hosting') },
      { id: 'budget', ok: picked('budget') },
      { id: 'workStyle', ok: picked('workStyle') },
      { id: 'testing', ok: picked('testing') },
    ],
  },
];

/** The prompt's "flavor": how complete each aspect of the brief is, counting only questions asked at this level. */
export function flavorProfile(a: Answers): Flavor[] {
  const r = createReader(a);
  return GROUPS.map((g) => {
    const applicable = g.checks.filter((c) => r.visible(c.id) && (!c.when || c.when(a)));
    const done = applicable.filter((c) => c.ok(r)).length;
    return { key: g.key, label: g.label, taste: g.taste, value: applicable.length ? done / applicable.length : 0 };
  });
}
