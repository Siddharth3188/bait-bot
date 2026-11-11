# Bait Bot 🤖💀

A chaotic Discord entertainment bot with member-based jokes, built-in comedy templates, and optional AI-generated punchlines.

## Milestone 01

- `/roast member` — roast one member.
- `/duo member1 member2` — generate a two-member joke.
- `/group member1 member2 member3 [member4] [member5]` — generate a group joke for 3–5 unique members.
- Hybrid generation: AI is used at a configurable probability when an API key is present; otherwise templates are used. AI errors fall back to templates.
- Member mentions render in Discord but do not send notification pings.

## Requirements

- Node.js 20.11 or newer
- A Discord application and bot created in the [Discord Developer Portal](https://discord.com/developers/applications)
- Optional OpenAI API key for AI jokes

## Discord setup

1. Create an application in the Discord Developer Portal and add a Bot user.
2. Copy the bot token and application (client) ID.
3. Under **OAuth2 → URL Generator**, select `bot` and `applications.commands` scopes. Give it permission to view channels and send messages. Use the generated URL to invite it to your test server.
4. Copy `.env.example` to `.env` and fill in `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, and your test server's `DISCORD_GUILD_ID`.
5. Optionally add `OPENAI_API_KEY`.

Never commit `.env` or share your bot token publicly. If a token is exposed, reset it in the Developer Portal immediately.

## Install and run

```bash
npm install
npm run deploy:commands
npm run dev
```

For a production build:

```bash
npm run build
npm start
```

Guild commands update quickly in the configured test server. If `DISCORD_GUILD_ID` is omitted, commands are registered globally and may take longer to appear.

## Joke generation settings

`AI_JOKE_CHANCE` controls how often the bot tries AI when `OPENAI_API_KEY` is configured:

- `0` — templates only
- `0.5` — roughly half AI, half templates
- `1` — AI every time, with template fallback if generation fails

The bot uses safe, playful roast instructions and does not intentionally ping selected members.

## Architecture

- `src/commands/` — slash command definitions and interaction logic
- `src/handlers/` — command dispatch
- `src/events/` — Discord lifecycle events
- `src/services/` — joke engine, template engine, and AI provider
- `src/data/` — built-in joke templates
- `src/types/` — shared TypeScript contracts
- `scripts/` — slash-command deployment

## Roadmap

**Milestone 02:** opt-out preferences, cooldowns, persistent SQLite settings, more joke categories (`/ship`, `/aura`, `/fortune`, `/excuse`).

**Milestone 03:** mini-games, leaderboards, daily questions, server events, and configurable bot personality.
