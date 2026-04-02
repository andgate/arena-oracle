# Native Module ABI Notes

This repo uses `better-sqlite3`, which is a native Node addon. That means it is not just JavaScript. It compiles to a `.node` binary that is tied to the ABI of the runtime that built it.

## The core problem

This project uses two different runtimes:

- plain Node.js for install/test/tooling
- Electron for the desktop app runtime

Those runtimes do **not** share the same native module ABI.

Example from this project:

- `node v25.x` uses `NODE_MODULE_VERSION 141`
- `electron 41.x` uses `NODE_MODULE_VERSION 145`

So a single `better_sqlite3.node` binary cannot satisfy both at the same time.

If the binary was built for Node, Electron throws:

```text
was compiled against a different Node.js version using NODE_MODULE_VERSION 141.
This version of Node.js requires NODE_MODULE_VERSION 145.
```

If the binary was built for Electron, plain Node throws:

```text
was compiled against a different Node.js version using NODE_MODULE_VERSION 145.
This version of Node.js requires NODE_MODULE_VERSION 141.
```

That behavior is expected. It is not an Electron bug, not a Node bug, and not a `pnpm` bug.

## Why `package.json` looks noisy

The scripts in `package.json` intentionally rebuild `better-sqlite3` for the runtime that is about to use it.

- `pnpm start`, `pnpm package`, `pnpm make`, and `pnpm publish`
  rebuild for Electron first
- `pnpm test*`
  rebuild for plain Node first

That is why the scripts may look repetitive or overly defensive. They are doing ABI selection.

Without those rebuild steps, the repo becomes fragile:

- run tests first, then Electron breaks
- run Electron first, then Node-side tools break

## Why Forge rebuilds are not enough by themselves

Electron Forge does rebuild native modules for Electron during `start` and packaging flows. That is correct and necessary.

However, Forge only helps when Electron is the runtime about to execute. It does not solve plain Node tools or test runners that may import the same native dependency later.

The problem is not "Forge failed to rebuild". The problem is that the workspace has one shared native binary path:

```text
node_modules/better-sqlite3/build/Release/better_sqlite3.node
```

Only one ABI target can live there at a time.

## Why we did not "just pick matching versions"

There is no Electron major that matches Node 25's ABI in this project’s version range.

For example:

- Node 25 => ABI 141
- Electron 41 => ABI 145
- Electron 40 => ABI 143
- Electron 39 => ABI 140

So "downgrade Electron until it matches Node" is not a reliable strategy here.

## Practical rule

When touching native module setup in this repo:

1. Assume plain Node and Electron need different `better-sqlite3` builds.
2. Keep Electron commands rebuilding for Electron.
3. Keep Node-side test/tool commands rebuilding for Node.
4. Do not simplify the scripts unless you also remove the shared-native-binary constraint.

## If this becomes too painful

The cleaner long-term escape hatches are:

- move SQLite access behind a boundary so plain Node tests do not load the real native addon
- replace `better-sqlite3` with a library that uses ABI-stable N-API, if acceptable
- isolate Electron-only native dependencies from Node-only workflows more aggressively

Until then, the current script setup is deliberate, not accidental.
