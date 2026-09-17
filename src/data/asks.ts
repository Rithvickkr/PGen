import type { Answers, Question } from '../types';
import { str } from '../lib/answers';

const name = (a: Answers, fallback = 'your app') => str(a, 'projectName') || fallback;

/**
 * Conversational phrasing for the journey. Question labels stay short for summaries and the
 * generated prompt; these are what people actually read, one screen at a time.
 */
const ASKS: Record<string, (a: Answers) => string> = {
  level: () => 'First, how much detail do you want in your prompt?',
  target: () => 'Where are you going to use it?',
  chatTool: () => 'Which AI chat do you use?',
  agentTool: () => 'Which coding agent do you use?',
  outcome: () => 'What would you like the AI to do with your idea?',

  projectName: () => 'Let’s start with a name. What are you calling it?',
  oneLiner: (a) => `Describe ${name(a, 'it')} in one sentence.`,
  problem: (a) => `What problem does ${name(a, 'it')} solve?`,
  motivation: () => 'What’s bringing you to build it?',
  alternatives: () => 'How do people deal with this today?',
  inspiration: () => 'Any products that inspire you?',
  differentiator: (a) => `What makes ${name(a)} different?`,
  monetization: () => 'Will it make money? How?',

  targetUsers: (a) => `Who is ${name(a)} for?`,
  scale: () => 'How many people do you expect to use it?',
  userJourney: () => 'Picture someone using it. What do they do, step by step?',
  userTechLevel: () => 'How comfortable are they with technology?',
  roles: () => 'Are there different kinds of users?',
  reach: () => 'Where in the world will it be used?',

  platform: () => 'What kind of thing are you building?',

  coreFeatures: (a) => `What must the first version of ${name(a)} be able to do?`,
  commonFeatures: () => 'Which of these building blocks will it need?',
  aiFeatures: () => 'What should the AI inside your app do?',
  aiProvider: () => 'Which AI provider should power it?',
  niceToHave: () => 'What can wait for a later version?',
  outOfScope: () => 'What should definitely not be built?',
  dataEntities: () => 'What information does the app keep track of?',
  integrations: () => 'Does it need to connect to other services?',
  edgeCases: () => 'Any rules or tricky situations to handle?',

  designStyle: (a) => `How should ${name(a)} feel?`,
  colors: () => 'Any colors, fonts, or branding in mind?',
  devices: () => 'Which screen sizes matter most?',
  references: () => 'Any designs you love?',

  experience: () => 'How much coding have you done so far?',
  os: () => 'What computer are you working on?',
  stackMode: () => 'Do you already have a tech stack in mind?',
  hosting: () => 'Where should it live once it’s built?',
  budget: () => 'What can you spend each month on services?',
  codebase: () => 'Are you starting fresh or adding to something?',

  timeline: () => 'When would you like version 1 ready?',
  hours: () => 'How much time can you give it?',
  successCriteria: () => 'How will you know version 1 is done?',
  workStyle: () => 'How should the AI work with you?',
  extraNotes: () => 'Anything else the AI should know before it starts?',
};

export function askFor(q: Question, a: Answers): string {
  return ASKS[q.id]?.(a) ?? q.label;
}
