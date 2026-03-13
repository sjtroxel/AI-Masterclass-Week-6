# Asteroid Bonanza — Security & Deployment

*Secret management, layered defenses, Railway/Vercel deployment, and environment configuration.*

---

## Security — Layered Defense

No single security layer is sufficient. All three layers are required.

### Layer 1 — Deny rules (`.claude/settings.json`)

```json
{
  "permissions": {
    "deny": [
      "read:.env*",
      "read:secrets/**",
      "read:*.pem",
      "read:*.key",
      "read:.aws/**",
      "read:.ssh/**"
    ]
  }
}
```

Known limitation: Claude Code has been reported to load `.env` files despite deny rules (January 2026). Deny rules are a first line of defense, not a guarantee.

### Layer 2 — File structure isolation

All secrets and environment variables live outside the project directory. The project repo contains only `.env.example` with placeholder values. No real credentials ever enter the working directory.

### Layer 3 — CI/CD scanning

- **gitleaks**: Configured as a pre-commit hook and GitHub Actions step. Scans for API keys, tokens, and passwords in all committed files and git history.
- **Dependabot**: Enabled in GitHub repo settings. Monitors all npm dependencies against the GitHub Advisory Database.

---

## Environment Variables

```
# Server
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
VOYAGE_API_KEY=
NASA_API_KEY=
CORS_ORIGIN=

# Client (prefixed with NG_ for Angular, public — no secrets)
NG_APP_API_URL=
```

The `SUPABASE_SERVICE_ROLE_KEY` is server-side only. The client never receives it. If the frontend needs Supabase access, it uses the public `anon` key through the API — not directly.

---

## Deployment — Railway (Backend)

`railway.toml` configuration:
```toml
[build]
command = "npm ci --include=dev && npm run build --workspace=server"

[deploy]
startCommand = "node server/dist/server.js"
```

**Key lessons from prior Railway deployments**:
- `npm ci --include=dev` — `NODE_ENV=production` causes Railway to skip devDependencies by default, which means TypeScript is not installed and `tsc` fails. The `--include=dev` flag overrides this.
- Root Directory must be blank (not "server") — if set to "server", the `../shared/` directory doesn't exist at build time.
- `shared/types.d.ts` not `shared/types.ts` — a `.ts` file imported from outside `rootDir` causes TypeScript to expand `rootDir` to the common ancestor, shifting all compiled output from `dist/` to `dist/server/`.

---

## Deployment — Vercel (Frontend)

Angular builds to a static directory (`dist/client/browser/`). Vercel serves this as a static site with SPA fallback routing configured.

Environment variables set in Vercel dashboard. Only public variables (API URL) — no secrets.

---

## Deployment — Database

Supabase is the managed database layer. No Railway database is needed. Connection string stored as Railway environment variable, never hardcoded.

---

## Deployment Sequence

1. Push to `main` branch triggers GitHub Actions CI
2. If CI passes, Railway auto-deploys backend (webhook trigger)
3. Vercel auto-deploys frontend (git integration)
4. Migrations must be run manually against Supabase before deploying a build that requires them — this is a conscious decision, not an oversight

---

*Document created: 2026-03-13*
