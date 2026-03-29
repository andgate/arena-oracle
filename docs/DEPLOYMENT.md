# Deployment

Arena Oracle uses GitHub Actions for CI and Electron Forge for Windows release publishing.

## How It Works

Pushes to `master` and pull requests targeting `master` run two separate workflows:

- Validation on `windows-latest` for:
  - Type checking (`pnpm check`)
  - Linting (`pnpm lint`)
  - Unit tests with coverage (`pnpm test:ci`)
- E2E on `windows-latest` for:
  - Packaging the Electron app
  - Playwright end-to-end coverage

Releases are separate from CI. Pushing a version tag such as `v0.0.1` triggers the `Publish` workflow on Windows, which:

- Builds and publishes the installer through Electron Forge
- Creates or updates the GitHub Release

This assumes tags are only pushed for commits that have already passed CI on `master`.

## Publishing a Release

1. Make sure the target commit is already merged to `master` and CI is green.

2. Bump the version in `package.json`:

```bash
npm version patch   # 1.0.0 -> 1.0.1
npm version minor   # 1.0.0 -> 1.1.0
npm version major   # 1.0.0 -> 2.0.0
```

This automatically commits the version bump and creates a local tag.

3. Push the commit and tag:

```bash
git push origin master --follow-tags
```

4. GitHub Actions will:

- Build the Windows installer via Electron Forge
- Publish a GitHub Release with the `.exe` installer attached

5. After the release is published, fill in the release notes manually using the template in [`.github/RELEASE_TEMPLATE.md`](../.github/RELEASE_TEMPLATE.md).

## Artifacts

Releases are published to [GitHub Releases](https://github.com/andgate/arena-oracle/releases) and include:

- `Setup.exe` - Windows installer (Squirrel)

## Requirements

- No extra secrets are required. GitHub Actions provides `GITHUB_TOKEN`.
- The `Publish` workflow must declare `permissions: contents: write` so Electron Forge can create releases.
- Auto-updating from GitHub is not available for private repositories through `update.electronjs.org`.

## Changelog Strategy

Release notes are currently manual. Use [`.github/RELEASE_TEMPLATE.md`](../.github/RELEASE_TEMPLATE.md) as the starting point for each GitHub Release body.

If this becomes too manual later, changelog automation should be evaluated separately with an explicit workflow and standards for the input data it depends on.
