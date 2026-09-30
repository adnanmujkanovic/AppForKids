# ✨ SparkForge Kids

**Ask. Create. Build. Share.** — an AI-native creation and learning platform where children turn curiosity into things they can proudly say *"I made this"* about.

A child starts with a question ("Why is Mars red?"), turns it into a picture, then a playable game, improves it with AI, finds and fixes a bug, sees the code behind it, earns medals, and shares it safely. Parents set everything up, control permissions and sharing, and get useful summaries and safety alerts without reading every conversation.

## Quick start

Requires Node.js 22.5+ (uses the built-in `node:sqlite`).

```bash
npm install
npm run dev          # API on :3001 + web app on http://localhost:5173 (hot reload)
```

Open http://localhost:5173 → **Create a family account** → add a child → **Start creating**.

Production build:

```bash
npm run build        # builds the web app into dist/web
npm start            # serves API + web app on http://localhost:3001
```

### AI provider

| Setting | Behavior |
|---|---|
| `ANTHROPIC_API_KEY` set | Live AI via Claude (`claude-opus-5-5` by default). |
| no key | **Practice mode**: a built-in, rule-based helper that knows a few topics (Mars, space, volcanoes, animals, ocean, dinosaurs, robots/AI) and understands simple change requests. The UI labels this clearly. |

Environment variables (see `.env.example`):

- `ANTHROPIC_API_KEY` — enables live AI.
- `SPARKFORGE_AI` — `auto` (default), `claude` or `offline`.
- `SPARKFORGE_MODEL` — override the Claude model id.
- `SPARKFORGE_DB` — SQLite file path (default `data/sparkforge.db`).
- `PORT` — API port (default `3001`).

If a live AI call fails or the model declines, the gateway falls back to practice mode for that request and tells the child.

## Checks

```bash
npm test             # engines, safety, Claude provider glue, and the full V1 end-to-end API flow
npm run typecheck
```

## What's in V1

Everything in the spec's **MVP "Must have"** and **"Should have"** lists, plus a few "Later" items that were cheap to do safely:

| Area | What works |
|---|---|
| Accounts | Parent registration/login (scrypt), families, child profiles (age, avatar, experience, interests). Children enter through the parent's session; leaving kid mode needs the parent password. |
| Permissions | Granular per-child permissions with age-aware defaults: AI questions, pictures, stories, games, apps, AI guides in apps, family/friend/public sharing, remix, share approval, showing the creator's name, contacts, homework photos, homework mode (teach/hints/answers), and a daily AI limit. GitHub, web access and agents are listed as coming later and can't be turned on yet. |
| Explore | Chat with Spark (the AI mentor) that adapts to age, skill and help level, labels how certain it is, suggests how to check facts, and offers next steps: *learn more · make a picture · quiz me · make a game · build an app · write a story · start a mission*. |
| Learn | Homework helper that follows the parent's homework setting and respects "don't give me the answer". Optional worksheet photos (live AI only). |
| Create | AI-composed pictures (structured scenes rendered as vector art, where the child can drag things around) and short illustrated stories. |
| Games | A constrained game model (player, collectibles with real facts, hazards, rules, levels, quiz), a canvas runtime for **catcher**, **explorer** and **quiz** games, AI generation, **PLAY / BUILD / EXPLAIN / CODE / TEST / SHARE / HISTORY** tabs, AI changes ("add rocks", "add 2 levels") with engineering explanations, and a hands-on editor. |
| Apps | Plan → approve → build: screens made of heading/text/picture/card/button/list/search/input/facts/AI-guide blocks, data collections, a phone-frame runtime, and an editor. |
| Testing & debugging | Automatic play-tests ("Can the player win in time?", "Does every button go somewhere?"). Each bug offers **Let me try · Give me a hint · Explain why · Fix it for me**. Fixing a bug yourself earns *Problem Solver*. |
| Explain My Project | My idea · AI helped me with · I changed · I learned · Problems I solved · My code, plus "explain it in your own words" feedback. |
| Code view | The project shown as readable JavaScript/JSX-style code that matches each BUILD control, plus the raw JSON the engine reads. |
| Versions | Every change is a version (by AI, by me, or a fix). Look at any version and go back to it. |
| Progress | Creator levels (Explorer → Creator → Builder → Engineer → AI Engineer → Inventor) based on what the child can do, 17 medals and 5 hidden surprise achievements, concepts discovered in context, and a Creator Passport. |
| Missions | Mars Explorer (8 levels), Star Catcher, Animal Explorer and AI Detective. Steps complete automatically from real activity. |
| AI Detective | Three statements, one wrong: teaches that AI can be wrong. |
| Sharing | Private family/friend links, optional public pages (`/p/<name>/<project>`), optional parent approval, remix into your own copy, notifications like "Someone tried your game!", and parent-approved contacts (kept in an outbox; no email is actually sent in V1). |
| Parent dashboard | Per child: projects, topics, skills, medals, activity, AI usage, safety status. Also safety alerts (short excerpts with personal info removed), approvals, links, contacts and settings. |

## Architecture

```
web/ (React + Vite)           server/ (Express, TypeScript)                 shared/
 Kid app · Parent area ─────▶  routes/  kid · parent · shares               game.ts  model, tests, fixes, diffs
 Game & app runtimes           engines/ projects · progress · missions      app.ts   model, tests, fixes
 Editors · Code view                    children (context)                  creations.ts scenes & stories
                               ai/      gateway ─▶ provider (Claude|offline) types.ts permissions, medals,
                                        prompts (layered) · knowledge                 concepts, missions
                               safety.ts · auth.ts · db.ts (SQLite)
```

- **AI Gateway** (`server/ai/gateway.ts`): the only way the app reaches a model. It handles daily limits, provider routing, fallback, output safety scanning and logging (`ai_log`). Providers implement a task-level interface (`chat`, `scene`, `story`, `game`, `modifyGame`, `appPlan`, `app`, `modifyApp`, `detective`, `checkUnderstanding`, `moderate`).
- **Claude provider** (`server/ai/anthropic.ts`): every call uses structured outputs validated with Zod schemas, adaptive effort per task, and server-side refusal fallbacks.
- **Layered prompts** (`server/ai/prompts.ts`): Global safety + age + skill + help level + mode + project context + task.
- **Child context**: age, experience, level, interests, help level, discovered concepts and homework mode. The child's name, family and contact details are never sent to a model.
- **Constrained generation**: AI produces game and app *data*; the runtimes render it. Every AI output is normalized (values clamped, ids fixed) before it's saved, and never runs as code.
- **Safety engine** (`server/safety.ts`): deterministic checks on everything the child types and everything AI returns. Personal info is removed before it reaches the model. Wellbeing concerns get a supportive reply and a high-priority parent alert. Stranger contact, dangerous instructions, adult content, substances and unkind words are blocked and logged.
- **Progress engine**: events (`asked`, `modified`, `tested`, `bug_fixed`, `shared`…) drive medals, concepts, levels and missions. Rewards come from creating, testing, fixing and sharing, never from time spent.
- **Persistence**: SQLite via `node:sqlite`. All SQL is behind `server/db.ts` and the engines, so moving to PostgreSQL is a contained change.
- **Web security**: httpOnly SameSite cookies; state-changing API calls must be JSON (CSRF defense); login throttling; family-scoped access checks; share pages expose a first name only (if allowed) and disable AI guides for anonymous viewers.

## Roadmap (from the spec's "Later" list)

GitHub connector and deployment, real email delivery, friend accounts and invitations, collaboration, a curated public gallery, AI agents, a real code editor ("write this part yourself"), pixel image generation through an image-model provider (the `ImageAsset`/scene boundary is ready for it), and a native mobile shell (the web app already works at phone width).
