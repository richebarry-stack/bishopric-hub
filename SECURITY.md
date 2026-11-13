# Security Policy

## Reporting a vulnerability

Please **don't open a public issue** for security problems.

Report them privately through GitHub instead:
[**Report a vulnerability**](https://github.com/richebarry-stack/bishopric-hub/security/advisories/new)
(the repo's Security tab → "Report a vulnerability").

Include what you found, how to reproduce it, and what someone could do with it.
**Leave out any real member or ward data.** Describe it with made-up examples.

You'll get a reply as soon as the maintainer can, usually within a week. Once a
fix is out, the advisory can be published with credit to you if you'd like.

## What's in scope

- This repository's code: the web app (`src/`), the API (`functions/`), the
  shared code (`shared/`), the mailer Worker (`workers/mailer/`) and the
  migrations.
- Problems such as signing in without the right password, seeing or changing
  data your role shouldn't allow, leaked secrets, or exposed member data.

## What's not in scope

- Each ward runs its own copy on its own Cloudflare account. Problems with one
  ward's setup (for example a weak password, or a shared database) are for
  that ward's admins, not this project.
- The Church's own websites and LCR.

## Supported versions

Only the latest code on the `master` branch is supported. If you run a copy,
update from `master` to get security fixes.
