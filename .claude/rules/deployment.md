# Deployment Rules — Asteroid Bonanza

## Phase 8 only
- Deployment is Phase 8 scope exclusively — no skeleton deploys, no preview environments before Phase 8
- The "Deployment is Phase 8 only" decision is in CLAUDE.md Key Decisions — do not re-litigate

## Infrastructure
- **Backend**: Railway — `railway.toml` exists at repo root; env config via Railway dashboard variables
- **Frontend**: Vercel — `vercel.json` exists at repo root; env config via Vercel project settings
- **Database**: Supabase — shared instance; migrations run via `npm run migrate` before deploy
- Never use `.env` files in production — all credentials via platform environment variables

## Environment variables
- Backend env vars (Railway): `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `PORT`
- Frontend env vars (Vercel): `NG_APP_API_BASE_URL` pointing to the Railway backend URL
- Never commit `.env` files — they are gitignored; see `.claude/settings.json` deny rules
- Local dev: use `.env` file with `dotenv`; never copy local `.env` to CI or platform config

## Build pipeline
- Backend build: `npm run build --workspace=server` → compiles TypeScript to `server/dist/`
- Frontend build: `npm run build --workspace=client` → outputs to `client/dist/`
- Both must pass `npm run typecheck` before deploy
- Run `npm run test` and verify all tests pass before any production deploy

## Database migrations
- Always run migrations against the target Supabase instance before deploying new code that depends on schema changes
- Migration order matters: `server/src/db/migrations/` files run in numeric sequence (0001 → 0007+)
- Never run a migration rollback (`down`) in production without explicit approval

## Smoke test
- After deployment, verify: `GET /api/health` returns 200, search returns results, analysis endpoint responds
- Apophis page (`/defense/apophis`) should load and display live countdown — confirm on mobile viewport

## CORS
- Backend must allow requests from the Vercel frontend domain — configure `CORS_ORIGIN` env var
- During development: `CORS_ORIGIN=http://localhost:4200`

## See also
- `.claude/rules/database.md` — migration conventions
- `project-specs/roadmap/PHASE_8_HARDENING.md` — full Phase 8 deployment checklist
