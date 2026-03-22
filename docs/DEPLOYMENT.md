# Deployment

Arena Oracle uses GitHub Actions for CI/CD. All releases are built and published automatically via Electron Forge.

## How It Works

Every push to `main` and every pull request runs the CI pipeline:

- Type checking (`pnpm check`)
- Linting (`pnpm lint`)
- Tests with coverage (`pnpm test:coverage`)

A release is triggered by pushing a version tag. The release job only runs if CI passes.

## Publishing a Release

1. Bump the version in `package.json`:

```
   npm version patch   # 1.0.0 → 1.0.1
   npm version minor   # 1.0.0 → 1.1.0
   npm version major   # 1.0.0 → 2.0.0
```

This automatically commits the version bump and creates a local tag.

2. Push the commit and tag:

```
   git push origin main --follow-tags
```

3. GitHub Actions will:
   - Run the full CI suite
   - Build the Windows installer via Electron Forge
   - Publish a GitHub Release with the `.exe` installer attached

## Artifacts

Releases are published to [GitHub Releases](https://github.com/andgate/arena-oracle/releases) and include:

- `Setup.exe` — Windows installer (Squirrel)

## Requirements

No secrets need to be configured manually. The workflow uses the built-in `GITHUB_TOKEN` provided automatically by GitHub Actions.
