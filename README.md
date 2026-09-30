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

Docker:

```bash
docker build -t sparkforge-kids .
docker run -p 3001:3001 -v sparkforge-data:/app/data -e ANTHROPIC_API_KEY=... sparkforge-kids
```

On phones, open the site and choose **Add to Home Screen**: SparkForge installs as an app (PWA).

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
- `SPARKFORGE_SECRET` — key for encrypting connector credentials (otherwise a key file is created in `data/`).
- `SMTP_URL`, `SMTP_FROM` — send emails to parent-approved contacts (otherwise they wait in the parent's outbox).
- `PUBLIC_URL` — base URL used in emailed links.

If a live AI call fails or the model declines, the gateway falls back to practice mode for that request and tells the child.

## Checks

```bash
npm test             # engines, safety, Claude provider glue, and the full V1 end-to-end API flow
npm run typecheck
```

## What's in it

Everything in the spec's **MVP "Must have"** and **"Should have"** lists, and the **"Later"** list (see *Not included* below for the two exceptions):

| Area | What works |
|---|---|
| Accounts | Parent registration/login (scrypt), families, child profiles (age, avatar, experience, interests). Children enter through the parent's session; leaving kid mode needs the parent password. |
| Permissions | Granular per-child permissions with age-aware defaults: AI questions, pictures, stories, games, apps, AI guides in apps, Code Mode, AI agents, web access, family/friend/public sharing, remix, share approval, showing the creator's name, friends, reactions, preset comments, building together, the Creator Feed, contacts, GitHub, homework photos, homework mode (teach/hints/answers) and a daily AI limit. |
| Explore | Chat with Spark (the AI mentor) that adapts to age, skill and help level, labels how certain it is, suggests how to check facts, and offers next steps: *learn more · make a picture · quiz me · make a game · build an app · write a story · start a mission*. |
| Learn | Homework helper that follows the parent's homework setting and respects "don't give me the answer". Optional worksheet photos (live AI only). |
| Create | AI-composed pictures (structured scenes rendered as vector art, where the child can drag things around) and short illustrated stories. |
| Games | A constrained game model (player, collectibles with real facts, hazards, rules, levels, quiz), a canvas runtime for **catcher**, **explorer** and **quiz** games, AI generation, **PLAY / BUILD / EXPLAIN / CODE / TEST / SHARE / HISTORY** tabs, AI changes ("add rocks", "add 2 levels") with engineering explanations, and a hands-on editor. |
| Apps | Plan → approve → build: screens made of heading/text/picture/card/button/list/search/input/facts/AI-guide blocks, data collections, a phone-frame runtime, and an editor. |
| Testing & debugging | Automatic play-tests ("Can the player win in time?", "Does every button go somewhere?"). Each bug offers **Let me try · Give me a hint · Explain why · Fix it for me**. Fixing a bug yourself earns *Problem Solver*. |
| Explain My Project | My idea · AI helped me with · I changed · I learned · Problems I solved · My code, plus "explain it in your own words" feedback. |
| Code view | The project shown as readable JavaScript/JSX-style code that matches each BUILD control, plus the raw JSON the engine reads. |
| Versions | Every change is a version (by AI, by me, or a fix). Look at any version and go back to it. |
| Progress | Creator levels (Explorer → Creator → Builder → Engineer → AI Engineer → Inventor) based on what the child can do, 19 medals and 5 hidden surprise achievements, concepts discovered in context, and a Creator Passport. |
| Missions | Mars Explorer (8 levels), Star Catcher, Animal Explorer, Code Breaker, Ship It, Build Together and AI Detective. Steps complete automatically from real activity. |
| AI Detective | Three statements, one wrong: teaches that AI can be wrong. |
| Sharing | Private family/friend links, optional public pages (`/p/<name>/<project>`), optional parent approval, remix into your own copy, notifications like "Someone tried your game!", and email to parent-approved contacts (sent via SMTP when configured; otherwise kept in the parent's outbox). |
| Code Mode | Open any game as **real JavaScript** (`game.onCollect(…)`, `game.onHit(…)`…) or start from a starter program. It runs in a sandboxed iframe (no network, no storage, no same-origin access) with error messages mapped to the child's line numbers. AI can help with code or give hints, depending on help level. |
| Export & deploy | Download any game, app or code project as a single web page that works offline. With the GitHub connector, save it as a repository (each save is a commit) and, if public publishing is allowed, deploy it with GitHub Pages. |
| Friends | Connected by parents only: one parent makes a one-time friend code, the other parent enters it. Children can send creations to a friend's inbox and react with emojis or **preset** kind comments (no free-text chat between children). Unfriending also ends collaboration. |
| Building together | Invite a friend to a project with a role ("Level Designer"). They can build, test and ask AI for changes, and every version records who made it. A shared task list can assign work to a friend or to AI. Helping earns *Community Helper*. |
| Creator Feed | Optional feed of public creations, newest first. No likes, views, rankings or infinite scroll. |
| AI agents | Give a bigger goal ("make it harder and add aliens"). The agent plans 2–5 steps, the child approves or removes steps, then it builds one step at a time, saving a version after each. |
| Web access | With permission and live AI, Spark can search a short list of kid-safe sites (NASA, Nat Geo Kids, Britannica…) and shows its sources. |
| Planner | Turns a goal ("get ready for my science test") into a short checklist the child edits and ticks off. |
| Installable & grown-up look | PWA (add to home screen, shell works offline). From age 12 the kid area switches to a calmer "studio" look. |
| Parent dashboard | Per child: projects, topics, skills, medals, friends, activity, AI usage, safety status. Also safety alerts (short excerpts with personal info removed), approvals, links, friend codes, contacts, the email outbox, the GitHub connector and settings. |

## Architecture

```
web/ (React + Vite)           server/ (Express, TypeScript)                 shared/
 Kid app · Parent area ─────▶  routes/  kid · parent · shares · social     game.ts  model, tests, fixes, diffs
 Game & app runtimes                    extras (agents, planner, GitHub)    app.ts   model, tests, fixes
 Editors · Code view · PWA     engines/ projects · progress · missions      creations.ts scenes, stories, code
 Code Mode (sandboxed iframe)           social · exporter · children        export.ts eject-to-JS, web pages
                               ai/      gateway ─▶ provider (Claude|offline) runtime/ engine.js · app.js
                                        prompts (layered) · knowledge                (vanilla JS runtimes)
                               connectors/ github · email                    types.ts permissions, medals,
                               safety.ts · auth.ts · secrets.ts · db.ts               concepts, missions
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

## Not included

- **Pixel image generation.** Pictures are AI-composed emoji scenes. A real image model needs a vendor choice; the scene/`ImageAsset` boundary is where it would plug in.
- **A native iOS/Android app.** The PWA installs on both platforms. A React Native / Expo shell could wrap the same API later.
