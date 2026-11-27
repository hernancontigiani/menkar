# Contributing to Menkar

Thank you for helping. Menkar is GPL-3.0-or-later; a contribution is accepted under the same
licence, certified by the sign-off below. There is no CLA.

## Before you start

For anything larger than a small fix, open an issue first, so the change is agreed before it is
written. How the code is organised, and the rules it must hold, are in `AGENTS.md` and the
documents its tables point to.

## Make the change

1. Fork the repository and create a branch from `main`: `feature/<short-name>` or
   `fix/<short-name>`.
2. Install the dependencies (Node 22 LTS and npm, on Linux):

   ```sh
   npm ci
   ```

3. Make the change, with its tests.
4. Run the gate, and make it pass:

   ```sh
   npm run ci
   ```

   For anything a user sees, also run the app's end-to-end checks (they need `xvfb-run`, from the
   `xvfb` package):

   ```sh
   npm run ui-check
   ```

5. Commit with a sign-off (below):

   ```sh
   git commit -s
   ```

6. Push the branch and open a **draft** pull request against `main`.
7. Mark it **Ready for review** when it should be checked: the checks run on a pull request that is
   ready, not on a draft.

Everything in the repository is written in English: code, comments, documentation and commit
messages. User-visible text is English in the code and translated through the i18n catalogs.

## Sign your commits

Every commit carries a `Signed-off-by:` line with your name and email, which `git commit -s` adds;
the email must be the commit author's. A pull request with an unsigned commit fails its checks;
`git commit --amend -s` signs the last one, and `git rebase --signoff main` every commit of the
branch.

The sign-off certifies the [Developer Certificate of Origin](https://developercertificate.org/),
version 1.1:

```text
Developer Certificate of Origin
Version 1.1

Copyright (C) 2004, 2006 The Linux Foundation and its contributors.

Everyone is permitted to copy and distribute verbatim copies of this
license document, but changing it is not allowed.


Developer's Certificate of Origin 1.1

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
    have the right to submit it under the open source license
    indicated in the file; or

(b) The contribution is based upon previous work that, to the best
    of my knowledge, is covered under an appropriate open source
    license and I have the right under that license to submit that
    work with modifications, whether created in whole or in part
    by me, under the same open source license (unless I am
    permitted to submit under a different license), as indicated
    in the file; or

(c) The contribution was provided directly to me by some other
    person who certified (a), (b) or (c) and I have not modified
    it.

(d) I understand and agree that this project and the contribution
    are public and that a record of the contribution (including all
    personal information I submit with it, including my sign-off) is
    maintained indefinitely and may be redistributed consistent with
    this project or the open source license(s) involved.
```

## Report a bug or ask for a feature

Use the repository's issue forms. For a bug, say the version from Settings › About, your
distribution, the steps, what you expected and what you saw, and attach the relevant lines of the
log, `~/.cache/menkar/menkar.log`.
