# Publishing

Arena Oracle releases are published through Electron Forge and GitHub Releases.
The git tag is the sole source of truth for the release version. `package.json`
keeps a permanent placeholder version (`0.0.0`) and is never manually bumped.

## Publishing a Release

1. Make sure the target commit is already merged to `master` and has passed all
   required checks.

2. Tag the commit and push the tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

3. GitHub Actions will:
   - Stamp the build ephemerally with the tag version (never committed)
   - Build the Windows installer via Electron Forge
   - Upload the installer as a release asset
   - Create a **draft** GitHub Release for the tag

4. Open the draft release on GitHub. Click **"Generate release notes"** to
   auto-populate the PR list and full changelog link between this tag and the
   previous one.

5. Polish the release notes — edit by hand or feed the draft + relevant Linear
   issues into an AI to generate them. Publish when ready.

## If a Build Fails

If the publish workflow fails and nothing shipped, delete the tag and re-push it
once the issue is fixed:

```bash
git tag -d v0.1.0
git push origin :refs/tags/v0.1.0

# Fix the issue, then:
git tag v0.1.0
git push origin v0.1.0
```

If the build succeeded but the release itself is broken, cut a new patch tag
instead (`v0.1.1`) — don't rewrite a tag that already shipped.

## Artifacts

Releases are published to [GitHub Releases](https://github.com/andgate/arena-oracle/releases) and include:

- `Setup.exe` — Windows installer (Squirrel)

## Requirements

- No extra secrets required. GitHub Actions provides `GITHUB_TOKEN` automatically.
- Auto-updating via `update.electronjs.org` is not available for private repositories.
