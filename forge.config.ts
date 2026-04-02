import { MakerSquirrel } from "@electron-forge/maker-squirrel"
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives"
import { FusesPlugin } from "@electron-forge/plugin-fuses"
import { VitePlugin } from "@electron-forge/plugin-vite"
import { PublisherGithub } from "@electron-forge/publisher-github"
import type { ForgeConfig } from "@electron-forge/shared-types"
import { FuseV1Options, FuseVersion } from "@electron/fuses"
import { DepType, Walker } from "flora-colossus"
import { cp, mkdir } from "node:fs/promises"
import path from "node:path"

const externalNativeDependencies = ["better-sqlite3"]

type WalkerWithModules = {
  modules: Array<{ name: string }>
  walkDependenciesForModule: (
    modulePath: string,
    depType: DepType,
  ) => Promise<void>
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
  },
  rebuildConfig: {
    force: true,
    onlyModules: externalNativeDependencies,
  },
  hooks: {
    // see https://github.com/electron/forge/issues/3738#issuecomment-3369076264
    async packageAfterCopy(_forgeConfig, buildPath) {
      const sourceNodeModulesPath = path.resolve(__dirname, "node_modules")
      const destNodeModulesPath = path.resolve(buildPath, "node_modules")
      const depsToCopy = new Set<string>()

      for (const dep of externalNativeDependencies) {
        const rootModulePath = path.join(sourceNodeModulesPath, dep)
        const walker = new Walker(
          rootModulePath,
        ) as unknown as WalkerWithModules

        await walker.walkDependenciesForModule(rootModulePath, DepType.PROD)

        depsToCopy.add(dep)
        for (const mod of walker.modules) {
          depsToCopy.add(mod.name)
        }
      }

      await Promise.all(
        Array.from(depsToCopy, async (packageName) => {
          const sourcePath = path.join(sourceNodeModulesPath, packageName)
          const destPath = path.join(destNodeModulesPath, packageName)

          await mkdir(path.dirname(destPath), { recursive: true })
          await cp(sourcePath, destPath, {
            recursive: true,
            preserveTimestamps: true,
          })
        }),
      )
    },
  },
  makers: [new MakerSquirrel({ name: "ArenaOracle" })],
  publishers: [
    new PublisherGithub({
      repository: {
        owner: "andgate",
        name: "arena-oracle",
      },
    }),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: "src/main/main.ts",
          config: "config/vite.main.config.ts",
          target: "main",
        },
        {
          entry: "src/preload/preload.ts",
          config: "config/vite.preload.config.ts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "config/vite.renderer.config.ts",
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
}

export default config
