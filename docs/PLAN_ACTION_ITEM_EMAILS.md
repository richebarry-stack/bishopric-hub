# Plan: email notifications for assigned action items

Status: **proposed, not built.** Written Aug 1, 2026.

Goal: when an action item is assigned to someone, email them at
`bishopric-hub@growinghomegreens.com`, staying on the Cloudflare **free** plan.

## Verdict

Achievable on the free plan, with one significant constraint: **every recipient's
email address must be a verified destination address in the Cloudflare account.**

Cloudflare Email Sending is listed as *not available* on the Workers Free plan and
costs $0.35/1,000 after 3,000/month on Workers Paid ($5/mo). The exception that makes
this free: sends **to verified destination addresses in your own account are free on
all plans**, don't count against any quota, and work with only Email Routing
configured — which this account already has (one verified address exists today).

So the free plan buys us "email the ~7 leaders who have clicked a verification link",
not "email anyone". That is exactly the use case here, but it does not extend to
emailing ward members generally.

## Architecture

A **separate Worker**, not a change to the existing Pages app.

Pages Functions do not support the `send_email` binding (Pages supports only a subset:
KV, D1, R2, DO, Vectorize, AI, service bindings, queues, Hyperdrive, Analytics Engine,
vars, secrets). Rather than migrate the app off Pages, add:

```
bishopric-hub-mailer   (new Worker, free plan)
├── cron trigger: daily, e.g. 13:00 UTC (07:00 MT)
├── binding DB     -> the same bishopric-hub-db D1 database
└── binding EMAIL  -> send_email, from bishopric-hub@growinghomegreens.com
```

It reads D1 directly, so the hub app and its deploy pipeline are untouched. Cron
triggers and multiple Workers are both free-plan features.

Rejected alternatives:
- *Service binding from Pages to a mailer Worker* — works, but adds a hop and still
  needs the second Worker; the cron approach needs no Pages change at all.
- *Email Sending REST API from the Pages Function* — needs a stored API token and hits
  the same entitlement question.
- *Migrating Pages -> Workers static assets* so the binding works in-app — the cleanest
  end state, but a much larger change than this feature justifies.
- *Third-party provider (Resend free tier: 3,000/mo, 100/day)* — no per-recipient
  verification, but adds a third-party account and API key. Keep as fallback if the
  verification friction proves unworkable.

## Delivery model: daily digest, not per-write

One email per person per day, listing only items that are **new since their last
email**. Reasons: the "assignment" lives in free-text fields across ~8 tables that get
edited repeatedly, so per-write emails would be noisy and need dedupe anyway; a digest
needs one code path instead of eight; and it caps volume at ~7 emails/day.

Requires a small ledger so items aren't re-sent:

```sql
CREATE TABLE email_notifications_sent (
  user_id INTEGER NOT NULL,
  item_id TEXT NOT NULL,      -- the ActionItem.id, e.g. "interview-setup-42"
  sent_at TEXT NOT NULL,
  PRIMARY KEY (user_id, item_id)
);
```

Prune rows whose item no longer appears for that user, so a re-assigned item can
notify again later.

## The main piece of work: one shared action-item calculation

`src/lib/myActions.ts` currently computes action items in the browser, mixing three
things: fetching (`useTable`), hub gating (`useAuth`), and the actual rules. The Worker
needs the rules only.

Extract a pure function — `computeActionItems({ user, tasks, callings, interviews, ... })
-> ActionItem[]` — into a module both sides import. The hook keeps fetching and gating
and calls it; the Worker queries D1 and calls the same function. Writing a second copy
in the Worker would guarantee drift (that file changed twice in one day this week).

This is the largest and riskiest chunk; everything else is plumbing.

## Setup steps (in order)

0. **Confirm Email Routing is already on `growinghomegreens.com`** — check for
   Cloudflare MX records on the zone. It appears to be (a verified destination address
   was created Aug 1, 2026). If routing is *not* already enabled, enabling it adds MX
   records and would take over inbound mail for that domain — do not do that blind.
1. **Prove a send works on the free plan** before building anything: deploy a throwaway
   Worker with a `send_email` binding and send one email from
   `bishopric-hub@growinghomegreens.com` to the already-verified address. If this
   fails with an entitlement error, the free path is closed and the options are Workers
   Paid ($5/mo) or a third-party provider.
2. Add each leader's address as a verified destination address; each person clicks the
   verification link Cloudflare emails them.
3. Migration: `email_notifications_sent` table + a per-user opt-out column on `users`
   (e.g. `email_notifications INTEGER DEFAULT 1`) — no such column exists today.
4. Extract `computeActionItems` (above).
5. Build and deploy the mailer Worker; log each run's results to D1.
6. Surface results on the Automation & Notifications page, replacing the "Email sending
   not yet enabled" banner: last run, emails sent, and **failures** — particularly
   "recipient not verified", which is otherwise silent.
7. Admin UI for the opt-out toggle and the send time (an `email_settings` blob in
   `ui_settings` already exists, unused).

## Decisions needed before building

- **Recipients**: the 7 bishopric-hub accounts only, or all 14 non-guest accounts
  (including Ward Council)? Every address added needs its own verification click.
- **Send time** (default 07:00 MT).
- **Scope of "action item"**: everything My Actions shows (tasks, calling pipeline,
  interview setup, sacrament assignments, clerk items), or a subset?
- **New leaders**: anyone added later receives nothing until their address is verified.
  Accepted, given the failure is reported on the Automation page?

## Cost

$0/month while every recipient is verified. ~210 emails/month if all 7 get a daily
digest — for reference that is well inside the 3,000/month included on Workers Paid,
so the paid plan ($5/mo, no verification requirement, can email anyone) stays a cheap
escape hatch if the verification model gets in the way.
