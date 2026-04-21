# Pok Deng + PromptPay

Multiplayer online Pok Deng (ป็อกเด้ง) card game with PromptPay QR code payment settlement. Players create game sessions, play rounds against a rotating dealer, and settle debts via Thai PromptPay QR codes.

**Live:** [pokdeng.sirin.dev](https://pokdeng.sirin.dev)

## Tech Stack

- **Framework:** TanStack Start (full-stack React + SSR)
- **Database:** Turso (libSQL)
- **Hosting:** Cloudflare Workers
- **Styling:** Tailwind CSS v4
- **Validation:** Zod v4
- **Build:** Vite 8 + Bun
- **Testing:** Vitest + Testing Library
- **Linting:** Biome

## Architecture

```
src/
├── routes/                 # TanStack Router file-based routes
│   ├── index.tsx           # Lobby (create/join sessions)
│   ├── game.$sessionId.tsx # Main game page (all phases + settlement)
│   ├── history.tsx         # Player session history
│   └── api/                # SSE endpoint, beacon leave, cron cleanup
├── components/             # PlayingCard (squeeze mechanic), Sidebar, LoginForm, etc.
├── hooks/                  # use-sse (real-time), use-sounds (Web Audio synthesis)
├── lib/
│   ├── game-engine.ts      # Pure in-memory Pok Deng logic (hand eval, deck, scoring)
│   ├── db-engine.ts        # Database-backed game engine (optimistic concurrency + retry)
│   ├── db.ts               # Turso connection, schema init, cleanup
│   ├── server-fns.ts       # TanStack server functions (API layer with validation + rate limiting)
│   ├── promptpay.ts        # EMVCo PromptPay QR payload generator (zero-dependency)
│   ├── promptpay-validator.ts  # Thai phone/Citizen ID validation
│   ├── validators.ts       # Zod schemas
│   ├── auth.tsx            # Client-side auth context (guest mode)
│   ├── i18n.tsx            # English/Thai internationalization
│   ├── session-token.ts    # HMAC-signed player tokens (24h TTL)
│   ├── rate-limit.ts       # In-memory rate limiter
│   ├── retry.ts            # Optimistic concurrency retry with backoff
│   └── scheduled.ts        # Cloudflare Workers cron handler
├── __tests__/              # Unit tests
└── integrations/           # TanStack Query provider
```

### Database Schema (Turso)

6 tables: `sessions`, `session_decks`, `session_players`, `settlements`, `emojis`, `session_history`. Writes use optimistic concurrency (`updated_at` as version) with automatic retry on conflict.

### Real-Time

Server-Sent Events (`/api/events/$sessionId`) polls DB for changes every 2s, client polls every 8s as fallback. Heartbeats every 10s; disconnected players auto-stand after 60s. Sessions with all players disconnected for 60s auto-close. Cloudflare cron runs cleanup every 5 minutes.

### Game Rules

Standard Pok Deng: mod-10 scoring, hand types (Pok > Tong > Sam Lueang > Normal), Deng multipliers (pair 2x, flush 3x, straight 3x, straight flush 5x, three-of-a-kind 5x). Max 17 players per session, dealer rotates each round.

## Getting Started

```bash
bun install
cp .env.example .dev.vars  # fill in secrets
bun --bun run dev
```

### Required Secrets

Set in `.dev.vars` for local dev, or via `wrangler secret put` for production:

- `TURSO_DATABASE_URL` — Turso database URL
- `TURSO_AUTH_TOKEN` — Turso auth token
- `SESSION_SECRET` — HMAC key for player session tokens

## Commands

| Command | Description |
|---|---|
| `bun --bun run dev` | Start dev server |
| `bun --bun run build` | Production build |
| `bun --bun run test` | Run tests |
| `bun --bun run lint` | Lint with Biome |
| `bun --bun run format` | Format with Biome |
| `bun --bun run check` | Lint + format check |
| `bunx wrangler deploy` | Deploy to Cloudflare Workers |

## Deployment

Configured in `wrangler.jsonc` — deploys to Cloudflare Workers with custom domain `pokdeng.sirin.dev`. Cron trigger (`*/5 * * * *`) handles session cleanup, auto-forfeit, and auto-close.

## Key Design Decisions

- **Two game engines:** `game-engine.ts` (pure, for testing) and `db-engine.ts` (production, DB-backed)
- **Zero-dependency PromptPay:** EMVCo QR spec implemented from scratch
- **No WebSocket library:** SSE + polling works natively on Cloudflare Workers
- **Client-side auth:** Guest mode with HMAC-signed tokens (no server auth session)
- **Card squeeze mechanic:** Drag-to-peel card reveal simulating real card play
- **Sound synthesis:** Web Audio API generates all sounds — no audio file dependencies
