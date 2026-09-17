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
