# Deployment

Arena Oracle releases are published through Electron Forge and GitHub Releases.

## Publishing a Release

1. Make sure the target commit is already merged to `master` and has passed all required checks.

2. Bump the version in `package.json`:

```bash
pnpm version patch   # 0.0.1 -> 0.0.2
pnpm version minor   # 0.0.1 -> 0.1.0
pnpm version major   # 0.0.1 -> 1.0.0
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
- Auto-updating from GitHub is not available for private repositories through `update.electronjs.org`.

## Changelog Strategy

Release notes are currently manual. Use [`.github/RELEASE_TEMPLATE.md`](../.github/RELEASE_TEMPLATE.md) as the starting point for each GitHub Release body.

If this becomes too manual later, changelog automation should be evaluated separately with an explicit workflow and standards for the input data it depends on.
