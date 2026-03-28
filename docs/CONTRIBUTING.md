# Contributing

This document describes the development workflow for contributing to this project.

## Overview

All changes are made on feature branches and merged into `master` via pull request. Direct pushes to `master` are not allowed. CI must pass before a PR can be merged.

## Local setup

This project uses Git LFS for committed database fixtures. Install and enable it before cloning, pulling, or switching branches:

```bash
git lfs install
```

Recommended first-time setup:

```bash
git clone <repo-url>
cd <repo-dir>
git lfs pull
pnpm install
pnpm approve-builds
pnpm install
```

If you already cloned the repo before installing Git LFS, run `git lfs pull` after `git lfs install` to fetch any LFS-backed assets.

When `pnpm approve-builds` opens, approve build scripts for:

- `better-sqlite3`
- `esbuild`

This is not an every-install step. You only need to approve builds when `pnpm` reports ignored build scripts or when a new script-running dependency is added.

If a native dependency was installed before its build script was approved, repair it with:

```bash
pnpm rebuild better-sqlite3
```

## Linear & GitHub Integration

Linear and GitHub are integrated. Linear will automatically transition issue statuses based on branch and PR activity:

- When a branch is pushed, the linked issue moves to **In Progress**
- When the PR is merged to `master`, the linked issue moves to **Done**

To link a PR to a Linear issue, include the issue ID in the **branch name** and use a magic word + issue ID in the **PR title or description**.

### Magic Words

Use a magic word followed by the issue ID (e.g. `Fixes GOO-123`) in the PR title or description.

**Closing magic words** (automatically moves issue to Done on merge):
`close`, `closes`, `closed`, `closing`, `fix`, `fixes`, `fixed`, `fixing`, `resolve`, `resolves`, `resolved`, `resolving`, `complete`, `completes`, `completed`, `completing`

**Non-closing magic words** (links the issue without auto-closing):
`ref`, `refs`, `references`, `part of`, `related to`, `contributes to`, `toward`, `towards`

## Workflow

### 1. Pick up an issue

Find an issue in Linear assigned to you in the current cycle. Move it to **In Progress** if it isn't already.

### 2. Create a branch

Use Linear's **Copy git branch name** action (Cmd/Ctrl Shift `.`) on the issue to get a pre-formatted branch name with the issue ID included. Create that branch locally off of `master`:

```bash
git checkout master
git pull
git checkout -b goo-123-my-issue-title
```

### 3. Make your changes

Keep commits focused. Use the following commit message format:

```text
fix GOO-123 short description of what changed
```

The commit message should start with a type (`fix`, `feat`, `chore`, `refactor`, etc.), followed by the Linear issue ID, followed by a brief description. No punctuation at the end.

### 4. Open a pull request

When ready, push your branch and open a PR against `master`. The PR should include:

- A **title** containing the Linear issue ID
- A **summary** of what changed and why
- A **changes** section listing the files modified
- A `Closes GOO-123` line to link and auto-close the Linear issue on merge

CI will run automatically on the PR. The PR cannot be merged until all checks pass.

### 5. Merge

Once CI is green, squash and merge the PR. The issue will automatically be moved to Done in Linear.

## CI Pipeline

The following checks run on every PR:

- **Type check** - `pnpm check`
- **Lint** - `pnpm lint`
- **Tests with coverage** - `pnpm test:ci`

All checks must pass before merging.

## Releases

Releases are triggered by pushing a version tag. See [DEPLOYMENT.md](./DEPLOYMENT.md) for details.
