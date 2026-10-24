# Releasing

All `@open-seats/*` packages (`core`, `renderer`, `viewer`, `editor`, `angular`) are
versioned together and published to npm by the
[`release.yml`](.github/workflows/release.yml) workflow whenever a `v*.*.*` tag is pushed.
Publishing uses [npm trusted publishing](https://docs.npmjs.com/trusted-publishers), so no
npm token is stored in GitHub, and every release gets a provenance attestation.

## Cutting a release

From an up-to-date `main` with a clean working tree:

```bash
# Bump all packages, update CHANGELOG.md, commit and tag (vX.Y.Z)
npx nx release patch --skip-publish     # or: minor | major | 1.2.3

# Optionally edit CHANGELOG.md and amend before pushing
git push --follow-tags
```

The workflow then checks that the tag matches every `libs/*/package.json` version, runs
lint, typecheck, test and build for the packages, and publishes them. Versions that already
exist on npm are skipped, so re-running a failed workflow is safe.

Preview a release without changing anything with `--dry-run`.

## One-time setup

npm can only attach a trusted publisher to a package that already exists, so the first
release of new packages is published from your machine.

1. **Log in** as an owner of the `@open-seats` scope:

   ```bash
   npm login
   npm whoami
   ```

2. **Version, build and publish the first release locally** (0.0.1 of `@open-seats/core`
   is already taken on npm, so start at 0.1.0 or higher):

   ```bash
   npx nx release 0.1.0 --first-release --skip-publish
   npx nx run-many -t build --projects='tag:layer:*'
   npx nx release publish --otp=<your 2FA code>
   ```

3. **Configure a trusted publisher** for each of the five packages on npmjs.com
   (_package → Settings → Trusted Publisher → GitHub Actions_):

   | Field             | Value         |
   | ----------------- | ------------- |
   | Organization/user | `mataai`      |
   | Repository        | `Seated`      |
   | Workflow filename | `release.yml` |
   | Environment       | `npm`         |

4. **Push the release commit and tag**: `git push --follow-tags`. The workflow runs, skips
   the already-published 0.1.0 packages, and proves the pipeline works end to end.

5. **Lock it down (recommended)**: in each package's _Settings → Publishing access_, choose
   _Require two-factor authentication and disallow tokens_. Trusted publishing keeps working.

The `npm` GitHub environment is created automatically on the first run. You can add
protection rules to it (e.g. required reviewers) under _Settings → Environments_.
