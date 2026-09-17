export type IngredientShape = 'dot' | 'leaf' | 'drop' | 'grain' | 'slice' | 'berry';

export interface ChapterTheme {
  /** Recipe name for the chapter, shown instead of the plain step title. */
  name: string;
  /** One warm line that sets up the chapter. */
  line: string;
  ingredient: string;
  color: string;
  shape: IngredientShape;
}

/** How each questionnaire step appears in the kitchen. */
export const KITCHEN: Record<string, ChapterTheme> = {
  start: {
    name: 'Prep the kitchen',
    line: 'Pick how detailed the recipe is, where it’s served, and what we’re making.',
    ingredient: 'A pinch of salt',
    color: '#d9cdb8',
    shape: 'grain',
  },
  idea: {
    name: 'The base',
    line: 'Every good recipe starts with a solid base. Here, that’s your idea.',
    ingredient: 'Egg yolk',
    color: '#f2b43c',
    shape: 'dot',
  },
  users: {
    name: 'The guests',
    line: 'Who’s coming to the table, and what will they enjoy?',
    ingredient: 'Blueberries',
    color: '#6f7fd4',
    shape: 'berry',
  },
  platform: {
    name: 'The dish',
    line: 'What are we cooking today?',
    ingredient: 'Flour',
    color: '#e4d3b3',
    shape: 'grain',
  },
  features: {
    name: 'The ingredients',
    line: 'Everything that goes into the first version.',
    ingredient: 'Fresh basil',
    color: '#78a565',
    shape: 'leaf',
  },
  design: {
    name: 'The plating',
    line: 'How it looks and feels when it reaches the table.',
    ingredient: 'Raspberries',
    color: '#e0708f',
    shape: 'berry',
  },
  tech: {
    name: 'The kitchen',
    line: 'Your tools, your setup, and what you can spend.',
    ingredient: 'Cracked pepper',
    color: '#5c524a',
    shape: 'grain',
  },
  quality: {
    name: 'Kitchen standards',
    line: 'Quality, safety, and keeping things clean.',
    ingredient: 'Lemon',
    color: '#efcd48',
    shape: 'slice',
  },
  delivery: {
    name: 'The method',
    line: 'Timing, and how the AI should cook alongside you.',
    ingredient: 'Honey',
    color: '#e0993a',
    shape: 'drop',
  },
};

export function themeFor(stepId: string): ChapterTheme {
  return KITCHEN[stepId] ?? KITCHEN.idea;
}

/* ------------------------------------------------------------------ */
/* Stations: the camera glides between them as chapters change         */
/* ------------------------------------------------------------------ */

export interface Station {
  id: 'pantry' | 'prep' | 'stove' | 'pass';
  name: string;
}

export const STATIONS: Station[] = [
  { id: 'pantry', name: 'Pantry' },
  { id: 'prep', name: 'Prep counter' },
  { id: 'stove', name: 'Stove' },
  { id: 'pass', name: 'The pass' },
];

const STATION_OF: Record<string, number> = {
  start: 0,
  idea: 0,
  users: 1,
  platform: 1,
  features: 1,
  design: 3,
  tech: 2,
  quality: 2,
  delivery: 2,
  review: 3,
};

export function stationFor(stepId: string | undefined): number {
  return stepId ? (STATION_OF[stepId] ?? 0) : 0;
}

/* ------------------------------------------------------------------ */
/* The chef's lines. Prewritten, never generated.                      */
/* ------------------------------------------------------------------ */

export const CHEF_TIPS: Record<string, string> = {
  start: 'Welcome in! Let’s set the heat and decide what we’re cooking.',
  idea: 'Every great dish starts with a clear base. Keep it simple.',
  users: 'We cook for our guests. The more specific, the tastier.',
  platform: 'What are we making today? I’ll grab the right pans.',
  features: 'Mise en place! Line up the must-haves for version one.',
  design: 'We eat with our eyes first. How should it look on the plate?',
  tech: 'Let’s check the kitchen. What tools do we have to work with?',
  quality: 'Clean kitchen, happy guests. Set your standards.',
  delivery: 'Nearly there! How should we pace the cooking?',
  review: 'Order up! Everything’s ready for the pass.',
};

export const CHEF_REACTIONS = {
  add: ['Smells good.', 'Oh, that’s going in.', 'Nice choice.', 'Perfect, in it goes.', 'Chef’s kiss.', 'Now we’re cooking.'],
  chop: ['Nice knife work.', 'Keep chopping.', 'Look at those slices.'],
  stir: ['Keep stirring, it’s thickening nicely.', 'Rich and tasty so far.'],
  remove: ['Taking that back out. No problem.'],
  skip: ['We can come back to that.', 'No rush, that one’s optional.'],
  coin: ['Budget noted.'],
  tick: ['Timer set.'],
};

export function pickLine(lines: string[], seed: number): string {
  return lines[Math.abs(seed) % lines.length];
}
