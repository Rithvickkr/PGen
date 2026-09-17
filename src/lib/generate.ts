import type { Answers, Level } from '../types';
import { getLevel, hasUI, str } from './answers';
import { createReader, type Reader } from './reader';
import { getTarget, getTool, hasNamedTool } from './tools';

type Item = { label: string; value: string | string[]; numbered?: boolean };
type Section = { tag: string; title: string; friendlyTitle: string; items: Item[] };

const PLATFORM_NOUN: Record<string, string> = {
  webapp: 'web app',
  website: 'website',
  mobile: 'mobile app',
  desktop: 'desktop app',
  extension: 'browser extension',
  api: 'API / backend service',
  cli: 'command-line tool',
  bot: 'chatbot',
  game: 'game',
  automation: 'automation script',
};

const OS_NAME: Record<string, string> = { windows: 'Windows', mac: 'macOS', linux: 'Linux' };

function withArticle(noun: string): string {
  return `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`;
}

function item(label: string, value: string | string[], numbered = false): Item | null {
  const empty = Array.isArray(value) ? value.length === 0 : !value;
  return empty ? null : { label, value, numbered };
}

function compact<T>(xs: (T | null | undefined | false | '')[]): T[] {
  return xs.filter(Boolean) as T[];
}

/* ------------------------------------------------------------------ */
/* Brief sections                                                      */
/* ------------------------------------------------------------------ */

function buildSections(r: Reader): Section[] {
  const sections: Section[] = [];
  const add = (tag: string, title: string, friendlyTitle: string, items: (Item | null)[]) => {
    const kept = compact(items);
    if (kept.length) sections.push({ tag, title, friendlyTitle, items: kept });
  };

  add('project_overview', 'Project Overview', 'About my idea', [
    item('Name', r.text('projectName')),
    item('Summary', r.text('oneLiner')),
    item('Problem it solves', r.text('problem')),
    item('Why I’m building it', r.label('motivation')),
    item('How people solve this today', r.text('alternatives')),
    item('Similar products / inspiration', r.text('inspiration')),
    item('What makes it different', r.text('differentiator')),
    item('Business model', r.label('monetization')),
  ]);

  add('target_users', 'Target Users', 'Who it’s for', [
    item('Users', r.text('targetUsers')),
    item('Expected scale', r.label('scale')),
    item('Users’ technical level', r.label('userTechLevel')),
    item('Roles', r.text('roles')),
    item('Typical user journey', r.text('userJourney')),
    item('Localization & reach', r.labels('reach')),
  ]);

  add('platform', 'Platform', 'What I’m building', [
    item('Type', r.label('platform')),
    item('SEO', r.label('webSeo')),
    item('Pages', r.list('sitePages')),
    item('Content updates', r.label('siteContent')),
    item('Target phones', r.label('mobileOS')),
    item('Build approach', r.label('mobileApproach')),
    item('Device capabilities', r.labels('mobileCaps').join(', ')),
    item('Operating systems', r.labels('desktopOS').join(', ')),
    item('Browsers', r.labels('browsers').join(', ')),
    item('Extension surfaces', r.labels('extSurfaces').join(', ')),
    item('API consumers', r.text('apiConsumers')),
    item('API style', r.label('apiStyle')),
    item('Commands', r.list('cliCommands')),
    item('Distribution', r.label('cliDistribution')),
    item('Bot platforms', r.labels('botPlatforms').join(', ')),
    item('Bot behavior', r.text('botBehavior')),
    item('Core gameplay', r.text('gameLoop')),
    item('Style', r.label('gameDimension')),
    item('Played on', r.labels('gamePlatforms').join(', ')),
    item('Players', r.label('gameMultiplayer')),
    item('Engine', r.label('gameEngine')),
    item('Workflow', r.text('autoSteps')),
    item('Trigger', r.label('autoTrigger')),
    item('Works with', r.text('autoTools')),
  ]);

  add('features', 'Features & Scope', 'Features', [
    item('Must-have features (v1)', r.list('coreFeatures'), true),
    item('Building blocks needed', r.labels('commonFeatures').join(', ')),
    item('AI functionality', r.text('aiFeatures')),
    item('AI provider', r.label('aiProvider')),
    item('Nice-to-haves (design for these, don’t build yet)', r.list('niceToHave')),
    item('Out of scope (do not build)', r.list('outOfScope')),
    item('Data model (rough)', r.text('dataEntities')),
    item('Integrations', r.text('integrations')),
    item('Business rules & edge cases', r.text('edgeCases')),
  ]);

  add('design', 'Design & UX', 'Look and feel', [
    item('Style', r.label('designStyle')),
    item('Colors & branding', r.text('colors')),
    item('Screen sizes', r.labels('devices').join(', ')),
    item('Design references', r.text('references')),
    item('Key screens', r.list('keyScreens')),
    item('Styling approach', r.label('uiLibrary')),
    item('Accessibility', r.label('accessibility')),
    item('UX details', r.text('uxNotes')),
  ]);

  const prefs = r.is('stackMode', 'prefs');
  const stackGiven = prefs && ['languages', 'frontend', 'backend', 'database'].some((id) => r.text(id));
  add('tech_stack', 'Tech Stack & Environment', 'My setup', [
    item('My coding experience', r.label('experience')),
    item('My computer', r.label('os')),
    item(
      'Stack',
      r.is('stackMode', 'recommend') || (prefs && !stackGiven)
        ? 'No fixed preference. Recommend the best fit for this project.'
        : '',
    ),
    item('Languages', r.text('languages')),
    item('Frontend', r.text('frontend')),
    item('Backend', r.text('backend')),
    item('Database', r.text('database')),
    item('Avoid', r.text('avoid')),
    item('Hosting', r.label('hosting')),
    item('Monthly budget', r.label('budget')),
    item('Starting point', r.label('codebase')),
    item('Existing project', r.text('existingDetails')),
    item('Tools & accounts I have', r.text('tools')),
  ]);

  add('engineering_standards', 'Engineering Standards', 'Quality', [
    item('Testing', r.label('testing')),
    item('Security & data', r.labels('security').join(', ')),
    item('Documentation', r.labels('docs').join(', ')),
    item('Code standards', r.labels('codeStandards').join(', ')),
    item('Delivery & infrastructure', r.labels('devops').join(', ')),
    item('Monitoring', r.labels('observability').join(', ')),
    item('Performance targets', r.text('performance')),
  ]);

  add('timeline', 'Timeline & Definition of Done', 'Timeline', [
    item('Timeline', r.label('timeline')),
    item('Time available', r.label('hours')),
    item('Version 1 is done when', r.text('successCriteria')),
  ]);

  add('additional_context', 'Additional Context', 'Anything else', [item('Notes', r.text('extraNotes'))]);

  return sections;
}

/* ------------------------------------------------------------------ */
/* Intro, instructions, deliverables                                   */
/* ------------------------------------------------------------------ */

function intro(r: Reader, level: Level, outcome: string): string {
  const noun = PLATFORM_NOUN[r.text('platform')] ?? 'software project';
  const name = r.text('projectName');
  const thing = name ? `${withArticle(noun)} called “${name}”` : withArticle(noun);

  if (level === 'beginner') {
    const goal: Record<string, string> = {
      validate: 'figuring out whether it’s a good idea and how to make it better before I build anything',
      plan: 'turning it into a clear plan I can follow',
      build: 'planning it and then building the first version',
      learn: 'building it step by step while I learn how everything works',
    };
    const exp: Record<string, string> = {
      none: 'I’ve never coded before, so please be patient and explain everything in simple terms.',
      beginner: 'I’m still a beginner at coding, so please explain things simply.',
      comfortable: 'I’ve built a few projects, but I’d appreciate clear guidance.',
      pro: 'I’m a professional developer, so you can be direct.',
    };
    return `Hi! I have an idea for ${thing} and I’d love your help ${goal[outcome] ?? goal.build}. ${
      exp[r.text('experience')] ?? 'Please guide me clearly and explain things simply.'
    }\n\nHere’s everything I know so far:`;
  }

  const task: Record<string, string> = {
    validate: 'critically evaluate and refine the idea before any code is written',
    plan: 'turn the idea into a clear, build-ready plan',
    build: 'plan and then build the first working version',
    learn: 'build it with me step by step while teaching me how each part works',
  };

  if (level === 'intermediate') {
    return `You are an experienced full-stack engineer and product-minded tech lead. I’m working on ${thing}, and I want you to ${
      task[outcome] ?? task.build
    }. The project brief is below.`;
  }

  return `You are a principal software engineer and product architect with deep experience designing, building, and shipping production software. I’m working on ${thing}. Your task is to ${
    task[outcome] ?? task.build
  }.\n\nThe complete project brief is provided in XML tags below. Read all of it carefully before responding.`;
}

function instructions(r: Reader, a: Answers, level: Level, target: string, outcome: string): string[] {
  const out: string[] = [];
  const ws = (v: string) => r.includes('workStyle', v);
  const codeWork = outcome === 'build' || outcome === 'learn';
  const os = OS_NAME[r.text('os')];
  const existing = r.is('codebase', 'existing');

  // Level baseline
  if (level === 'beginner') {
    out.push('Avoid jargon. When a technical term is unavoidable, explain it in one simple sentence.');
    out.push('Recommend beginner-friendly, well-documented tools with generous free tiers.');
    if (codeWork) {
      out.push('After each step, tell me what I should see if it worked, and how to fix the most likely errors if it didn’t.');
    }
  } else if (level === 'intermediate') {
    out.push('Follow current best practices for the chosen stack, and keep the code clean, consistent, and well-organized.');
    out.push('Point out anything in this brief that is unclear, inconsistent, or likely to cause problems.');
  } else {
    out.push('Treat the engineering standards and scope boundaries in this brief, including out-of-scope items, as hard constraints.');
    out.push('Before designing around them, identify ambiguities, contradictions, or risky assumptions in this brief.');
    out.push('Prefer proven, well-supported technology. Design for the stated scale and no further, and avoid speculative abstractions.');
    out.push('For every significant decision, state what you chose, the main alternative you rejected, and why.');
  }

  // Working style
  if (ws('challenge')) {
    out.push('Push back on my assumptions. If a feature isn’t needed for v1, a requirement is unclear, or there’s a simpler approach, say so directly and propose an alternative.');
  }
  if (ws('explain') && level !== 'advanced') {
    out.push(
      level === 'beginner'
        ? 'Explain each decision in plain language: what it is and why we’re using it.'
        : 'Briefly justify key technical decisions and note the trade-offs.',
    );
  }
  if (ws('simplest')) {
    out.push('Choose the simplest approach that meets the requirements. Don’t add complexity I haven’t asked for.');
  }
  if (ws('phases') && outcome !== 'validate') {
    out.push('Break the work into small phases, each ending with something I can run and verify.');
  }
  if (ws('complete') && codeWork) {
    out.push(
      target === 'agent'
        ? 'Write complete, working implementations. No TODO stubs, placeholder logic, or mocked functionality unless I ask for it.'
        : 'Always give complete files with their full path above each code block. Never use placeholders like “// rest of the code here”.',
    );
  }
  if (ws('commands') && codeWork && target === 'chat') {
    out.push(`Give exact terminal commands${os ? ` for ${os}` : ''}, and tell me which folder to run them in.`);
  }
  if (ws('risks')) {
    out.push('Warn me early about risks, security pitfalls, and common mistakes, before I run into them.');
  }
  if (ws('concise')) {
    out.push('Keep explanations concise. Prioritize working output over long prose.');
  }

  // Target-specific
  if (target === 'agent') {
    const tool = getTool(a);
    const where = hasNamedTool(a) ? ` in ${tool.label}` : '';
    out.push(
      existing
        ? `You’re working directly in my existing project as a coding agent${where}. Start by exploring the codebase to understand its structure, conventions, and commands before proposing changes, and follow the patterns you find.`
        : `You’re working directly in my project folder as a coding agent${where}, starting from an empty directory.`,
    );
    if (outcome !== 'validate') {
      out.push(
        outcome === 'plan'
          ? 'Save the finished plan to `PLAN.md` in the project root.'
          : 'Before writing any code, save your plan to `PLAN.md` and wait for my approval.',
      );
    }
    if (codeWork) {
      out.push(`Create a \`${tool.memoryFile}\` file documenting the stack, key commands (install, dev, test, build), project structure, and conventions, and keep it updated as the project evolves.`);
      out.push('After each phase, run the app and any tests, fix the errors you find, and give me a short summary of what changed.');
      if (r.includes('codeStandards', 'commits') || level !== 'beginner') {
        out.push('Use git: commit after each completed phase with a clear, descriptive message.');
      }
      out.push('Ask before adding paid services, deleting files, or running anything that changes things outside this project.');
    }
  } else {
    out.push('Use clear headings. If a response would get too long, stop at a logical checkpoint and tell me what comes next.');
    if (codeWork && !ws('complete')) {
      out.push('Put the file path above every code block.');
    }
  }

  if (r.includes('commonFeatures', 'ai') && r.is('aiProvider', 'claude')) {
    out.push('For AI features, use the Claude API with the latest Claude models, and keep API keys on the server, never in client code.');
  }

  return out;
}

function deliverables(r: Reader, a: Answers, level: Level, target: string, outcome: string): { steps: string[]; closing: string } {
  const ui = hasUI(a);
  const recommend = !r.is('stackMode', 'prefs');
  const os = OS_NAME[r.text('os')];
  const platform = r.text('platform');
  const serverish = ['webapp', 'mobile', 'api', 'desktop', 'extension', 'bot'].includes(platform);
  const testing = r.text('testing');

  if (outcome === 'validate') {
    return {
      steps: compact([
        'Restate the idea in 2–3 sentences to confirm you understand it.',
        'Give an honest assessment: what’s strong, what’s weak, and whether it’s worth building as described.',
        level !== 'beginner' && 'Map the landscape: similar products, and how this can realistically stand out.',
        level === 'beginner'
          ? 'Explain the biggest challenges I’ll face building this, in plain language.'
          : 'List the biggest risks and assumptions (technical, product, and business) and a cheap way to test each.',
        'Suggest improvements, and name features I should cut or postpone.',
        'Propose a tightened MVP scope: the smallest version that proves the idea, as a prioritized feature list.',
        level === 'advanced' && 'Define 3–5 metrics that would show the MVP is working.',
        'Recommend concrete next steps.',
      ]),
      closing: 'Don’t write any code yet. Focus on making the idea as strong as possible.',
    };
  }

  if (outcome === 'plan') {
    return {
      steps: compact([
        'Restate the project in a short paragraph to confirm your understanding.',
        level === 'beginner'
          ? 'List the features for version 1 in plain language, and what we’ll save for later.'
          : level === 'intermediate'
            ? 'Define the MVP scope as user stories (“As a …, I want …, so that …”).'
            : 'Define the MVP scope as user stories with testable acceptance criteria, plus explicit non-goals.',
        recommend
          ? `Recommend a tech stack with a short reason for each choice${level === 'beginner' ? ', and why it suits a beginner' : ''}${level === 'advanced' ? ', including the alternatives you considered' : ''}.`
          : 'Confirm my preferred stack fits this project, or flag concerns and suggest adjustments.',
        level !== 'beginner' &&
          `Describe the architecture: main components and how data flows between them${level === 'advanced' ? ' (include a Mermaid diagram)' : ''}.`,
        level === 'beginner'
          ? 'Explain what data the app will store and how it connects.'
          : 'Design the data model: entities, key fields, types, and relationships.',
        level !== 'beginner' && serverish && 'Outline the API: endpoints or server actions, with inputs, outputs, and auth requirements.',
        ui && 'List the screens or pages and how users move between them.',
        'Show the project folder structure.',
        `Create a phased build roadmap with clear milestones${level === 'advanced' ? ', dependencies, and rough effort estimates' : ''}.`,
        level === 'advanced' && 'Describe the testing, security, deployment, and monitoring strategy.',
        'List risks and open questions.',
      ]),
      closing:
        target === 'agent'
          ? 'Don’t write implementation code yet. I’ll review `PLAN.md` first.'
          : 'Don’t write implementation code yet. I’ll review the plan first.',
    };
  }

  if (outcome === 'learn') {
    return {
      steps: compact([
        'Explain the big picture in plain language: what we’re building, the main parts, and how they fit together.',
        `Help me set up my computer${os ? ` (${os})` : ''} with exactly the tools I need, with step-by-step install instructions.`,
        'Break the project into small lessons. For each lesson: (a) what we’re building and why, (b) the code, explained line by line where it’s new, (c) how to run it and what I should see, and (d) one small exercise or question to check my understanding.',
        'Start with Lesson 1 only.',
      ]),
      closing: 'Wait for me to say I’m ready before moving to the next lesson.',
    };
  }

  // build
  return {
    steps: compact([
      level === 'beginner'
        ? 'Give me a short plan: what we’ll build first, the tools we’ll use and why, and the steps to get there.'
        : `Write a concise plan: confirm your understanding, ${recommend ? 'the recommended stack with reasons' : 'how you’ll use my preferred stack'}, the data model${level === 'advanced' ? ', architecture (Mermaid diagram), folder structure,' : ','} and a phased roadmap.`,
      target === 'agent'
        ? 'Once I approve the plan, scaffold the project and install dependencies.'
        : `Give setup instructions: prerequisites, the commands to create the project${os ? ` on ${os}` : ''}, and dependencies to install.`,
      'Implement Phase 1: the smallest end-to-end slice of the core features that actually runs.',
      target === 'chat' && 'Provide the complete code for every file in Phase 1, each with its file path.',
      level !== 'beginner' && testing && testing !== 'none' && 'Include tests for Phase 1 that match the testing requirements above.',
      'Explain how to run it and verify it works, including what I should see.',
      'Finish with what comes next: the remaining phases, in order.',
    ]),
    closing: 'Stop after Phase 1 so I can test it before we continue.',
  };
}

function clarifyLine(r: Reader, level: Level): string {
  if (r.includes('workStyle', 'clarify')) {
    if (level === 'beginner') {
      return 'Before you start, ask me up to 5 simple questions about anything that’s unclear or missing. Wait for my answers before continuing.';
    }
    if (level === 'intermediate') {
      return 'Before you start, ask me up to 7 clarifying questions about anything unclear, missing, or risky in this brief. Number them, and wait for my answers before continuing.';
    }
    return 'Before producing any deliverables, ask me up to 10 clarifying questions, prioritizing those whose answers would change the architecture, scope, or data model. Number them, suggest a sensible default answer for each, and wait for my replies.';
  }
  return level === 'beginner' ? '' : 'If anything is ambiguous, state your assumption explicitly and continue.';
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function renderItems(items: Item[], xml: boolean): string {
  const bold = (s: string) => (xml ? s : `**${s}**`);
  let out = '';
  let prevInline = false;
  for (const it of items) {
    let block: string;
    let inline = false;
    if (Array.isArray(it.value)) {
      const lines = it.value.map((v, i) => `${it.numbered ? `${i + 1}.` : '-'} ${v}`);
      block = `${bold(`${it.label}:`)}\n${lines.join('\n')}`;
    } else if (it.value.includes('\n')) {
      block = `${bold(`${it.label}:`)}\n${it.value}`;
    } else {
      block = `- ${bold(`${it.label}:`)} ${it.value}`;
      inline = true;
    }
    if (out) out += inline && prevInline ? '\n' : '\n\n';
    out += block;
    prevInline = inline;
  }
  return out;
}

function wrap(xml: boolean, tag: string, title: string, body: string): string {
  return xml ? `<${tag}>\n${body}\n</${tag}>` : `## ${title}\n\n${body}`;
}

export function generatePrompt(a: Answers): string {
  const r = createReader(a);
  const level = getLevel(a);
  const target = getTarget(a);
  const outcome = ['validate', 'plan', 'build', 'learn'].includes(str(a, 'outcome')) ? str(a, 'outcome') : 'build';
  const xml = level === 'advanced';

  const parts: string[] = [intro(r, level, outcome)];

  for (const s of buildSections(r)) {
    parts.push(wrap(xml, s.tag, level === 'beginner' ? s.friendlyTitle : s.title, renderItems(s.items, xml)));
  }

  const rules = instructions(r, a, level, target, outcome);
  if (rules.length) {
    parts.push(
      wrap(
        xml,
        'instructions',
        level === 'beginner' ? 'How I’d like you to help' : 'How to Work',
        rules.map((l) => `- ${l}`).join('\n'),
      ),
    );
  }

  const { steps, closing } = deliverables(r, a, level, target, outcome);
  parts.push(
    wrap(
      xml,
      'output_format',
      level === 'beginner' ? 'What I need from you' : 'Deliverables',
      `${level === 'beginner' ? 'Please do the following, in order:' : 'Respond with the following, in order:'}\n${steps
        .map((s, i) => `${i + 1}. ${s}`)
        .join('\n')}\n\n${closing}`,
    ),
  );

  const clarify = clarifyLine(r, level);
  if (clarify) parts.push(clarify);

  return parts.join('\n\n');
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
