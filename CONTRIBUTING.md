# Contributing

Thanks for your interest in Bishopric Hub! Bug reports, ideas and fixes are all
welcome.

## Before you start

- **Protect member privacy.** Never put real member names, callings, interview
  notes, screenshots of real data, or other ward information in issues or pull
  requests. Use made-up examples.
- **Security problems** go through private reporting, not issues. See
  [SECURITY.md](SECURITY.md).
- Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## Reporting bugs and suggesting ideas

[Open an issue](https://github.com/richebarry-stack/bishopric-hub/issues/new/choose)
using the bug report or idea template.

## Pull requests

- **Small fixes** (typos, clear bugs): open a pull request directly.
- **Bigger changes** (new pages, changes to how data is stored, new
  automation): please open an issue first so we can agree on the approach.
- **Changes only your ward needs:** you're welcome to keep them in your own
  copy instead. The project is MIT-licensed, so you can fork it and adapt it
  freely.

### Setting up

Follow the README's [Setup](README.md#setup) and
[Local Development](README.md#local-development) sections. Use a separate
database with made-up data for development. See
[docs/DEPLOY_DEMO_INSTANCE.md](docs/DEPLOY_DEMO_INSTANCE.md).

### Checks

Run these before opening a pull request. GitHub runs them too.

```sh
npm run lint
npm run build   # typechecks the app, API and mailer, runs the tests, checks for stray scrollbars, then builds
```

### Conventions

- **Database changes** go in a new numbered file in `migrations/`. Don't edit
  a migration that has already been released.
- **Add a Version History entry** for any change people will notice, in
  `shared/versionHistory.ts` under today's date. It appears on the Help page
  and in the weekly update email to admins, so write it in plain language.
- **Scrollbars:** only add a scroll area where it's truly needed (see
  `tools/check-scrollbars.mjs`). Many users are on phones and small laptops.
- Keep pull requests focused on one change, and explain what it does and why.
