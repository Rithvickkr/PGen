import type { Answers, Option } from '../types';
import { str } from './answers';

export type Target = 'chat' | 'agent';

export interface Tool {
  value: string;
  label: string;
  /** Where to start a new chat (chat tools). */
  url?: string;
  /** Project instructions file the agent reads on every session (agent tools). */
  memoryFile?: string;
  /** Short steps for using the prompt with this tool. */
  howto: string[];
}

export const CHAT_TOOLS: Tool[] = [
  {
    value: 'chatgpt',
    label: 'ChatGPT',
    url: 'https://chatgpt.com/',
    howto: ['Copy the prompt.', 'Start a new chat in ChatGPT.', 'Paste the prompt and send it.', 'Answer its questions, then continue step by step.'],
  },
  {
    value: 'claude',
    label: 'Claude',
    url: 'https://claude.ai/new',
    howto: ['Copy the prompt.', 'Start a new chat in Claude.', 'Paste the prompt and send it.', 'Answer its questions, then continue step by step.'],
  },
  {
    value: 'gemini',
    label: 'Gemini',
    url: 'https://gemini.google.com/app',
    howto: ['Copy the prompt.', 'Start a new chat in Gemini.', 'Paste the prompt and send it.', 'Answer its questions, then continue step by step.'],
  },
  {
    value: 'other',
    label: 'Other',
    howto: ['Copy the prompt.', 'Start a new chat in your AI assistant.', 'Paste the prompt and send it.', 'Answer its questions, then continue step by step.'],
  },
];

export const AGENT_TOOLS: Tool[] = [
  {
    value: 'cursor',
    label: 'Cursor',
    memoryFile: '.cursor/rules/project.mdc',
    howto: ['Open your project folder in Cursor.', 'Open the chat panel in Agent mode.', 'Paste the prompt and send it.', 'Answer its questions, then review the plan before it builds.'],
  },
  {
    value: 'claudecode',
    label: 'Claude Code',
    memoryFile: 'CLAUDE.md',
    howto: ['Open a terminal in your project folder.', 'Run `claude` to start a session.', 'Paste the prompt and press Enter.', 'Answer its questions, then review the plan before it builds.'],
  },
  {
    value: 'codex',
    label: 'Codex',
    memoryFile: 'AGENTS.md',
    howto: ['Open a terminal in your project folder.', 'Run `codex` to start a session.', 'Paste the prompt and press Enter.', 'Answer its questions, then review the plan before it builds.'],
  },
  {
    value: 'copilot',
    label: 'GitHub Copilot',
    memoryFile: '.github/copilot-instructions.md',
    howto: ['Open your project folder in VS Code.', 'Open Copilot Chat and switch to Agent mode.', 'Paste the prompt and send it.', 'Answer its questions, then review the plan before it builds.'],
  },
  {
    value: 'other',
    label: 'Other',
    memoryFile: 'AGENTS.md',
    howto: ['Open your project folder in your coding agent.', 'Start a new agent session.', 'Paste the prompt and send it.', 'Answer its questions, then review the plan before it builds.'],
  },
];

export const toolOptions = (tools: Tool[]): Option[] => tools.map(({ value, label }) => ({ value, label }));

/** Older saved answers used `code` for coding agents. */
export function getTarget(a: Answers): Target {
  const t = str(a, 'target');
  return t === 'agent' || t === 'code' ? 'agent' : 'chat';
}

export function getTool(a: Answers): Tool {
  const target = getTarget(a);
  const list = target === 'agent' ? AGENT_TOOLS : CHAT_TOOLS;
  const value = str(a, target === 'agent' ? 'agentTool' : 'chatTool');
  return list.find((t) => t.value === value) ?? list[list.length - 1];
}

/** True when the person picked a specific product rather than "Other". */
export function hasNamedTool(a: Answers): boolean {
  return getTool(a).value !== 'other';
}
