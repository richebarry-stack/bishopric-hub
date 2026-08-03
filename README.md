# Bishopric Hub

A private tool for LDS bishopric coordination — sacrament meeting planning, calling pipeline, interview tracking, missionary pipeline, member needs, and more.

Built with **React 19 + TypeScript + Tailwind CSS v4**, deployed on **Cloudflare Pages** with **Cloudflare D1** (SQLite) as the database.

Want to show someone how it works without exposing any real ward data? See
[**docs/DEPLOY_DEMO_INSTANCE.md**](docs/DEPLOY_DEMO_INSTANCE.md) for a
step-by-step guide to standing up a separate demo copy with fictional sample
data, on its own database and web address.

---

## Features

- **Sacrament Meeting Planning** — speakers, music, prayers, themes, announcements; past/current/future split view
- **Current Sacrament Agenda** — live drag-and-drop agenda builder with printable view; past meetings show frozen snapshots
- **Calling Pipeline** — track callings and releases through each step with assigned-to bishopric member
- **Interview Pipeline** — recommend expiry dates, interview scheduling, and status tracking
- **Missionary Pipeline** — pre-mission through return, linked to farewell/homecoming sacrament talks
- **Member Needs** — confidential pastoral notes
- **Bishop Schedule** — weekly calendar with drag-to-resize appointments
- **Important Links** — shared team link library
- **Users & Roles** — app roles (admin/editor) and church roles (bishop, counselors, clerk, etc.)

---

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4 |
| Routing | React Router v7 |
| Data fetching | TanStack React Query v5 |
| Backend | Cloudflare Pages Functions (single `functions/api/[[route]].ts` handler) |
| Database | Cloudflare D1 (SQLite) |
| Auth | Session-based (HTTP-only cookie), SHA-256 password hashing |
| Deployment | Cloudflare Pages via Wrangler CLI |

---

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier is sufficient)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/): `npm install -g wrangler`
- [GitHub CLI](https://cli.github.com/) (optional, for Claude-assisted setup)

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/bishopric-hub.git
cd bishopric-hub
npm install
```

### 2. Create a Cloudflare D1 database

```bash
wrangler login
wrangler d1 create bishopric-hub-db
```

Copy the `database_id` from the output.

### 3. Configure Wrangler

```bash
cp wrangler.jsonc.example wrangler.jsonc
```

Edit `wrangler.jsonc` and fill in your `database_name` and `database_id`.

### 4. Run migrations

```bash
npm run migrate
```

This runs `wrangler d1 migrations apply bishopric-hub-db --remote`, which applies every committed migration in `migrations/` in order and records each one in D1's own `d1_migrations` tracking table. Always use this (not `wrangler d1 execute --file=`) for schema migrations, so the tracking table can't drift from what's actually applied. It's safe to re-run — it only applies files that haven't been recorded yet.

### 5. Create the first admin user

Use the Wrangler CLI to insert an admin user. Generate a SHA-256 hash of your chosen password first:

```bash
node -e "const c=require('crypto');console.log(c.createHash('sha256').update('yourpassword').digest('hex'))"
```

Then insert the user:

```bash
npx wrangler d1 execute bishopric-hub-db --remote --command="INSERT INTO users (name, email, password_hash, role) VALUES ('Your Name', 'your@email.com', 'PASTE_HASH_HERE', 'admin');"
```

### 6. Configure D1 binding in Cloudflare dashboard

For GitHub Actions deployment (see [Deployment](#deployment)), the D1 binding must be set in the Cloudflare dashboard:

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **bishopric-hub** → **Settings** → **Bindings**
2. Add a D1 Database binding: Variable name `DB`, Database = your database name

### 7. Deploy

```bash
npm run build
npx wrangler pages deploy dist --branch main
```

Cloudflare will print a deployment URL. After this first manual deploy, push to `master` on GitHub to trigger automatic deployments (once you complete the GitHub Actions setup in [Deployment](#deployment)).

---

## Local Development

Start the Vite dev server:

```bash
npm run dev
```

For full API support locally (Cloudflare Worker runtime + D1), run in a separate terminal after building:

```bash
npm run build
npx wrangler pages dev dist --d1 DB=YOUR_DATABASE_NAME
```

Replace `YOUR_DATABASE_NAME` with the `database_name` value from your `wrangler.jsonc`.

---

## Deployment

### Automatic deployment via GitHub Actions (recommended)

Every push to `master` automatically builds and deploys via `.github/workflows/deploy.yml`. One-time setup:

1. **Create a Cloudflare API token**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **My Profile** → **API Tokens** → **Create Token**
   - Use the **Edit Cloudflare Workers** template, or create a custom token with **Cloudflare Pages: Edit** permission
   - Copy the token value

2. **Find your Cloudflare Account ID**
   - Any Cloudflare dashboard page → right sidebar shows **Account ID**

3. **Add secrets to GitHub**
   - Go to your repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
   - Add `CLOUDFLARE_API_TOKEN` (the token from step 1)
   - Add `CLOUDFLARE_ACCOUNT_ID` (from step 2)

After that, every `git push` deploys automatically. No local build step needed.

### Manual deployment

```bash
npm run build
npx wrangler pages deploy dist --branch main
```

### The action-item mailer (separate Worker)

`workers/mailer/` is a second, independent Worker — not part of the Pages app — that
emails leaders when they're assigned an action item and sends a weekly digest on a
cron trigger. It has its own `wrangler.jsonc` (gitignored, same reasons as the root
one) and needs its own one-time setup:

```bash
cp workers/mailer/wrangler.jsonc.example workers/mailer/wrangler.jsonc
```

Fill in your `database_id` (same D1 database as the main app) and a `FROM_ADDRESS` on
a domain with Cloudflare Email Routing enabled. Sending to arbitrary recipients
requires the Workers Paid plan; on the Free plan, only recipients added as **verified
destination addresses** on the account can receive mail (`wrangler email routing
addresses create <email>`, then the recipient clicks the verification link Cloudflare
sends them) — see [Email Service pricing](https://developers.cloudflare.com/email-service/platform/pricing/).

Deploy with `npm run deploy:mailer`. GitHub Actions deploys it automatically alongside
the Pages app, generating `workers/mailer/wrangler.jsonc` from the committed `.example`
on **every** run (it's gitignored locally, same policy as the root config) — so nothing
identity-bearing (database, domain, From address) can live in that committed file, or
every fork would inherit whoever wrote it. Instead CI fills those in from your own
repo's secrets/variables (Settings → Secrets and variables → Actions):

| Name | Kind | Value |
|---|---|---|
| `CLOUDFLARE_D1_DATABASE_ID` | Secret | Same `database_id` as your local `wrangler.jsonc` |
| `MAILER_D1_DATABASE_NAME` | Variable | Optional — defaults to `bishopric-hub-db` |
| `MAILER_HUB_BASE_URL` | Variable | Your Pages URL, e.g. `https://your-project.pages.dev` |
| `MAILER_FROM_ADDRESS` | Variable | Your `FROM_ADDRESS`, on a domain with Email Routing enabled |
| `MAILER_FROM_NAME` | Variable | Optional — defaults to `Bishopric Hub` |
| `MAILER_MODE` | Variable | Optional — defaults to `seed`; set to `live` only once you've verified the ledger |

If `CLOUDFLARE_D1_DATABASE_ID`, `MAILER_HUB_BASE_URL`, or `MAILER_FROM_ADDRESS` is
unset, CI skips the mailer deploy entirely rather than deploying with a placeholder —
better a mailer that doesn't run than one emailing links to someone else's site.

**First deploy is always in `seed` mode** (the `MAILER_MODE` var/variable) — it computes
and records what's already assigned to everyone without sending anything, so the entire
existing backlog doesn't email at once. Flip it to `live` (locally in `wrangler.jsonc`,
or via the `MAILER_MODE` repo variable if you deploy through CI) once you've checked
`action_item_notifications` looks right, then redeploy.

### With Claude Code assistance

This project was built and is maintained with [Claude Code](https://claude.ai/code). To continue development with AI assistance:

1. Install Claude Code: download the desktop app from [claude.ai/code](https://claude.ai/code) or install the VS Code extension
2. Open the project directory in Claude Code
3. Claude has full context of the architecture and can add features, fix bugs, run migrations, build, and deploy

Example prompts that work well with Claude Code:

- *"Add a new page for tracking [X]"*
- *"Run the migration and deploy"*
- *"Scan for defects"*
- *"Make sure the code has no personal information before I push to GitHub"*
- *"Split the sacrament planning view into past, current, and future sections"*

Claude can read and edit source files, run migrations against your remote D1 database, build the project, and deploy — all in one conversation without switching terminals.

---

## Database Migrations

Migrations live in `migrations/` and are numbered sequentially (`0001_schema.sql`, `0002_sessions.sql`, …). Apply pending ones with:

```bash
npm run migrate
```

Wrangler tracks which migrations have already run in D1's own `d1_migrations` table, so this command is always safe to re-run — it only applies files that haven't been recorded yet. Run it before `npm run deploy` whenever a new migration file was added, not as part of deploy itself (a remote schema change shouldn't run unattended as a deploy side effect).

### Schema vs. data migrations

**Schema migrations** live directly in `migrations/` and are committed to the repo — this is exactly the set of files `npm run migrate` will ever see.

**Data import/seed migrations** (ward-specific data — member names, events, callings) live in `migrations/data/` instead, are **gitignored**, and are never tracked by `d1_migrations`. Apply them manually, after any schema migrations they depend on:

```bash
npx wrangler d1 execute bishopric-hub-db --remote --file=migrations/data/XXXX_name.sql
```

These are generated locally (or by Claude) when importing from external sources and are not shared. Run them against your own database but do not commit them.

---

## Security Notes

- All personal data (member names, callings, notes) lives only in the database — nothing is hardcoded in source code
- Cloudflare D1 encrypts data at rest and in transit (TLS) by default
- Sessions use HTTP-only cookies with a 30-day expiry
- `wrangler.jsonc` is gitignored — it contains your database ID and must not be committed
- Data import/seed migrations (`migrations/data/*.sql`) are gitignored — they may contain member names and ward-specific event details
- The `scripts/` directory is gitignored for the same reason
- `.env` and `.env.*` files are gitignored — never commit API keys or secrets
- Data exports (`*.csv`, `exports/`, `data-export/`) are gitignored — CSV/JSON dumps may contain member data
- Ward-specific image assets should not be committed to a public repo

---

## Project Structure

```
bishopric-hub/
├── functions/
│   └── api/
│       └── [[route]].ts      # Cloudflare Pages Function — all API routes in one file
├── migrations/               # D1 SQL migrations, applied in numeric order
├── src/
│   ├── components/           # Layout, Modal, FormFields, StatusBadge, etc.
│   ├── lib/                  # api.ts (types + fetch), auth.tsx, useTable.ts, constants.ts
│   └── pages/                # One file per feature page
├── wrangler.jsonc.example    # Copy to wrangler.jsonc and fill in your D1 details
└── vite.config.ts
```

---

## License

MIT — free to use, modify, and deploy for your own ward or unit.
