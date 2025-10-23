# Repository Guidelines

## Project Structure & Module Organization
- `monitor-whale-api.js` — main loop: fetch positions, diff, Telegram notify.
- `test-telegram.js` — send a test message to verify credentials.
- `debug-api.js` — probe API endpoints and preview JSON.
- `.env` / `.env.example` — configuration; never commit secrets.
- State files: `.hyperliquid_state_*.json` (auto-generated, git-ignored).

## Build, Test, and Development Commands
- `npm install` — install dependencies.
- `npm start` — start continuous monitoring.
- `npm run start:once` — single polling cycle, then exit (debug).
- `npm run test:telegram` — verify Telegram connectivity.
- `npm run debug:api` — test API URLs; pass full URLs or set `ADDRESS`/`API_CANDIDATES`.

## Coding Style & Naming Conventions
- Node.js 18+; CommonJS modules. Indent 2 spaces, include semicolons, prefer single quotes.
- Filenames: kebab-case (e.g., `monitor-whale-api.js`). Constants `UPPER_SNAKE_CASE`; functions/vars `camelCase`.
- Keep console output and user-facing messages in Chinese. Minimize dependencies; stick to `dotenv`, `undici`.

## Testing Guidelines
- No formal test framework. Use scripts:
  - Connectivity: `npm run test:telegram`, `npm run debug:api`.
  - Logic sanity: `npm run start:once` and inspect console output.
- When changing message formats, paste sample Telegram output in PR description.

## Commit & Pull Request Guidelines
- Prefer Conventional Commits: `feat: …`, `fix: …`, `docs: …`, `chore: …` (Chinese message bodies welcome).
- PRs must include: purpose, key changes, env vars touched, how to run locally, and sample logs/screenshots.
- Do not commit `.env` or `.hyperliquid_state_*.json`. Update `.env.example` when adding config.

## Security & Configuration Tips
- Secrets live in `.env` (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`).
- Optional proxy: set `HTTPS_PROXY` (or `HTTP_PROXY`).
- Respect API limits: default `POLL_SECONDS >= 30`; avoid tight loops.

## Agent-Specific Instructions
- Keep changes surgical; avoid framework switches or broad refactors.
- Preserve Chinese messaging and existing field semantics.
- Align with current patterns before adding utilities; document any new script in `package.json` and `README.md`.

