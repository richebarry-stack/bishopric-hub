# Deploying a Public Demo of Bishopric Hub

This guide walks you through publishing a **second, separate copy** of Bishopric
Hub — one with made-up sample data instead of real ward information — so you can
show people how the app works without exposing anyone's personal information.

The demo lives completely separately from your real (production) copy:

- It has its own database, filled with fictional members, callings, and interviews.
- It runs on its own web address (`bishopric-hub-demo.pages.dev` or similar).
- Nothing you do in the demo can ever affect your real ward's data, and vice versa.

You do **not** need to know how to code to follow this guide. Every command
below is meant to be copied and pasted exactly as written. Where you need to
type your own value (like your database's name), it will be clearly marked.

If at any point a command "doesn't work" — an error appears in red, or nothing
happens — stop and re-read the step. Most problems come from a step being
skipped or a value being copied incorrectly, not from something being broken.

---

## What you'll end up with

- A live website, publicly viewable by anyone with the link
- A login screen with:
  - A **Demo Bishop** account (full access) — email `bishop@demo.example`, password `DemoPass2026`
  - Two **guest** buttons (no password needed) for the read-only youth and sacrament views
- Ward Members, Callings, and Interviews pages already populated with fictional
  people so the app doesn't look empty

---

## Before you start: things to install

You only need to install these once.

### 1. Node.js

Node.js lets your computer run the tools this project needs.

1. Go to **https://nodejs.org**
2. Click the button labeled **LTS** (it will say something like "20.x.x LTS")
3. Run the installer you downloaded, clicking "Next" through the default options

To check it worked, open a terminal (see below) and type:

```
node --version
```

You should see something like `v20.11.0`. If you see an error instead, the
install didn't finish — try again.

**What's a terminal?**
- **Windows**: Click the Start menu, type `PowerShell`, press Enter.
- **Mac**: Open **Terminal** from Applications → Utilities, or press
  `Cmd+Space`, type `Terminal`, press Enter.

Every command in this guide gets typed into that window, followed by Enter.

### 2. Git

Git downloads a copy of the project's code to your computer.

- **Windows**: Download and install from **https://git-scm.com/download/win**
  (accept all the default options during install)
- **Mac**: Open Terminal and type `git --version` — if it's not already
  installed, your Mac will offer to install it for you

### 3. A Cloudflare account

Cloudflare is the company that will host your demo website for free.

1. Go to **https://dash.cloudflare.com/sign-up**
2. Enter your email and create a password
3. Verify your email (check your inbox for a confirmation link)

### 4. A GitHub account (only if you don't already have access to the repo)

If someone gave you a link to the `bishopric-hub` GitHub repository and you
can already see the code, skip this. Otherwise go to **https://github.com/join**
and create a free account.

---

## Step 1 — Download the project's code

In your terminal, type the following, replacing `YOUR_GITHUB_USERNAME` with
the actual GitHub username or organization that owns the repo (whoever gave
you this guide can tell you the correct address):

```
git clone https://github.com/YOUR_GITHUB_USERNAME/bishopric-hub.git
cd bishopric-hub
```

The second line moves your terminal "into" the project folder. Every command
from here on assumes you're still inside that folder — if you close and
reopen your terminal, type `cd bishopric-hub` again first (or navigate into
wherever you saved the folder).

Now switch to the **demo** branch — a special version of the code set up
specifically for this kind of demo:

```
git checkout demo
```

Then install the project's dependencies (small pieces of code it relies on):

```
npm install
```

This may take a minute or two and will print a lot of text. That's normal.

---

## Step 2 — Install the Cloudflare command-line tool

This tool (called "Wrangler") lets you create and manage things on your
Cloudflare account from the terminal.

```
npm install -g wrangler
```

Then log in — this opens a browser window where you approve access:

```
wrangler login
```

Click **Allow** in the browser tab that opens, then return to your terminal.

---

## Step 3 — Create a database for the demo

This creates an empty database on Cloudflare to hold the demo's fake data.

```
npx wrangler d1 create bishopric-hub-demo-db
```

This prints something like:

```
✅ Successfully created DB 'bishopric-hub-demo-db' in region WNAM

{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "bishopric-hub-demo-db",
      "database_id": "2bdd7b6c-d222-4ef9-a171-125d1edd4b67"
    }
  ]
}
```

**Copy the `database_id` value** (the long string of letters and numbers) —
you'll need it in the next step. In this example it's
`2bdd7b6c-d222-4ef9-a171-125d1edd4b67`, but yours will be different.

---

## Step 4 — Tell the project about your new database

Copy the example configuration file to create your own:

- **Windows (PowerShell)**:
  ```
  copy wrangler.jsonc.example wrangler.jsonc
  ```
- **Mac**:
  ```
  cp wrangler.jsonc.example wrangler.jsonc
  ```

Now open the new `wrangler.jsonc` file in a text editor (in File Explorer or
Finder, find the `bishopric-hub` folder and double-click `wrangler.jsonc` —
if it asks what program to open it with, choose Notepad on Windows or
TextEdit on Mac).

It will look like this:

```json
{
  "name": "bishopric-hub",
  "compatibility_date": "2024-12-01",
  "pages_build_output_dir": "./dist",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "YOUR_DATABASE_NAME",
      "database_id": "YOUR_DATABASE_ID"
    }
  ]
}
```

Change it to match yours:

- Change `"name": "bishopric-hub"` to `"name": "bishopric-hub-demo"`
- Change `"database_name": "YOUR_DATABASE_NAME"` to `"database_name": "bishopric-hub-demo-db"`
- Change `"database_id": "YOUR_DATABASE_ID"` to the `database_id` you copied in Step 3

Save the file and close it.

---

## Step 5 — Build the database structure

The project's `migrations` folder contains a numbered list of instructions
that build up the database's structure (its tables and columns) step by
step. You need to run all of them, in order, against your new demo database.

- **Windows (PowerShell)** — paste this whole block at once:
  ```powershell
  Get-ChildItem migrations\*.sql | Sort-Object Name | ForEach-Object {
    npx wrangler d1 execute bishopric-hub-demo-db --remote --file=$_.FullName
  }
  ```
- **Mac (Terminal)** — paste this whole block at once:
  ```bash
  for f in migrations/*.sql; do
    npx wrangler d1 execute bishopric-hub-demo-db --remote --file="$f"
  done
  ```

This will take a few minutes and print a lot of output as each file runs.
That's expected — as long as you don't see the word `ERROR` in red, it's
working. When it finishes, your prompt will return to normal.

---

## Step 6 — Load the fake demo data

Now fill the empty database with made-up ward members, callings, and
interviews (see `demo-data/seed-demo-data.sql` in the project if you're
curious what's in it — it's all fictional):

```
npx wrangler d1 execute bishopric-hub-demo-db --remote --file=demo-data/seed-demo-data.sql
```

---

## Step 7 — Build the website files

```
npm run build
```

This compiles the app into a `dist` folder, ready to publish.

---

## Step 8 — Create the Cloudflare Pages project

This creates the actual website "slot" on Cloudflare that will host your demo:

```
npx wrangler pages project create bishopric-hub-demo --production-branch=demo
```

Then publish your built files to it:

```
npx wrangler pages deploy dist --project-name=bishopric-hub-demo
```

When it finishes, it prints a web address like:

```
✨ Deployment complete! Take a peek over at https://e68176c6.bishopric-hub-demo.pages.dev
```

Your permanent link (which stays the same on every future deploy) is:

```
https://bishopric-hub-demo.pages.dev
```

(If that name is already taken by someone else's Cloudflare account, Wrangler
will automatically pick a slightly different one and tell you what it is —
use whatever address it gives you.)

---

## Step 9 — Try it out

1. Open the link from Step 8 in your browser
2. Log in with:
   - Email: `bishop@demo.example`
   - Password: `DemoPass2026`
3. You should see fictional ward members, callings, and interviews already there
4. Log out and try the **"Continue as guest"** options too, if the login
   screen offers them — no password needed

If the page loads but login fails, double-check Step 5 and Step 6 actually
completed without errors — the login account is created by the migrations
and seed data, not by anything else.

---

## Updating the demo later

If the project's code changes and you want to update your demo to match:

```
git checkout demo
git pull
npm install
npm run build
npx wrangler pages deploy dist --project-name=bishopric-hub-demo
```

Your demo's database (the fake data) is untouched by this — only the app's
code and appearance update. If a future update adds new database columns,
you'd re-run Step 5 for just the new migration file(s), the same way as
Step 5 above but pointed at the one new file.

---

## Prefer to have Claude do this for you?

If you have access to **Claude Code** (Anthropic's AI coding assistant) and
would rather not run every command by hand, you can hand this entire guide
to Claude instead:

1. Install Claude Code — download it from **https://claude.ai/code** (desktop
   app), or install it as a VS Code extension
2. Open the `bishopric-hub` project folder in Claude Code
3. Give it a prompt like:

   > *"Set up and deploy a public demo instance of this app, following the
   > steps in docs/DEPLOY_DEMO_INSTANCE.md. I have a Cloudflare account
   > already — walk me through logging in if you need me to do anything
   > manually, otherwise handle the rest yourself."*

Claude can run the terminal commands, create the database, edit
configuration files, and deploy for you — pausing to ask only when
something genuinely requires your input (like approving the Cloudflare
login in your browser). This is exactly how this particular demo instance
was originally set up.

If something goes wrong partway through, you can also just paste the exact
error message you're seeing back to Claude and ask it to fix it — that's
often faster than troubleshooting it yourself.

---

## Troubleshooting

**"command not found: npx" or "npx is not recognized"**
Node.js isn't installed correctly, or you need to close and reopen your
terminal after installing it.

**"ERROR" during Step 5 mentioning a table or column that already exists**
You may have accidentally run the same migration file twice. This is usually
harmless — check the very first error in the output; if everything after it
also failed, your database may be in a partial state. Easiest fix: delete
the database (`npx wrangler d1 delete bishopric-hub-demo-db`) and start over
from Step 3 with a fresh one.

**Login says "Invalid credentials"**
Make sure Step 6 (loading the fake demo data) completed without errors —
that step is what creates the `bishop@demo.example` account.

**The page loads but looks broken / shows a blank screen**
Check that Step 4 was saved correctly — a typo in `wrangler.jsonc` (like a
missing comma) will stop the site's backend from working, even though the
static page still loads.

**I want to tear the whole demo down**
```
npx wrangler pages project delete bishopric-hub-demo
npx wrangler d1 delete bishopric-hub-demo-db
```
Both ask you to confirm before deleting anything.
