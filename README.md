# PGen: starter prompts for AI builders

A free, single-page tool that turns an app idea into a well-engineered starter prompt for any AI: ChatGPT, Claude, Gemini, or coding agents like Cursor, Claude Code, Codex, and Copilot.
People cook their prompt in an illustrated kitchen: one conversational question at a time, where every answer is a cooking action (chopping, stirring, picking jars, dragging ingredients into the pot) and the finished prompt is served on an order ticket. No AI calls, no backend, and answers never leave the browser.

## Features

- **Three prompt levels:** Beginner (plain language, guided), Intermediate (structured brief), Advanced (XML-tagged, spec-grade brief with engineering standards)
- **Two targets:** AI chat or AI coding agent. Agent prompts add `PLAN.md`, a tool-specific instructions file (`CLAUDE.md`, `AGENTS.md`, Cursor rules, Copilot instructions), run-and-verify, and git steps
- **Four goals:** refine the idea, plan it, plan and build, or learn while building
- **Adaptive questions:** follow-ups change with the project type (web, mobile, extension, API, CLI, bot, game, automation)
- **Live preview**, prompt strength score with tips, copy, `.md` download, and share links (answers encoded in the URL)
- **Kitchen experience:** four stations with camera glides, a reacting chef, a taste test flavor profile, synthesized sound and haptics (mutable), a cloche reveal, and a shareable recipe card image. **Quick mode** (in the menu) switches to a plain form
- **Autosave** to localStorage, three example projects, and follow-up prompts for after the AI replies

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # outputs static files to dist/
```

## Deploy

`dist/` is a static site. Deploy it to Vercel, Netlify, Cloudflare Pages, or GitHub Pages with build command `npm run build` and output directory `dist`.

## Where things live

| File | Purpose |
|---|---|
| `src/data/steps.ts` | Every chapter and question, with level and conditional visibility |
| `src/data/asks.ts` | Conversational wording shown for each question in the journey |
| `src/lib/generate.ts` | Prompt engine: intro, brief sections, instructions, deliverables |
| `src/lib/tools.ts` | Supported AI tools, their how-to steps and instruction file names |
| `src/lib/strength.ts` | Prompt strength checks and tips |
| `src/data/examples.ts` | Example projects |
| `src/components/World.tsx` | The illustrated kitchen: stations, camera, flights, finale objects |
| `src/components/Controls.tsx` | Cooking controls for each question type |
| `src/lib/sound.ts` | Synthesized kitchen sounds and haptics |
| `src/styles.css` | Design tokens and all styles |

To add a question, add it to `steps.ts`, then reference its `id` in `generate.ts`.
