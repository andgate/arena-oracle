import Database from "better-sqlite3"
import { app } from "electron"
import path from "path"
import { inject, injectable, singleton } from "tsyringe"
import { IStartable, IStoppable } from "../lifecycle"
import { ISqlite3Service } from "../sqlite3/Sqlite3Service.interface"
import { IAppDbService } from "./AppDbService.interface"
import { Migration } from "./migrations"

@injectable()
@singleton()
export class AppDbService implements IAppDbService, IStartable, IStoppable {
  constructor(
    @inject(ISqlite3Service) private sqlite3Service: ISqlite3Service,
  ) {}

  private _db: Database.Database | null = null

  get db(): Database.Database {
    if (!this._db) throw new Error("AppDbService not started")
    return this._db
  }

  start(): void {
    const dbPath = path.join(app.getPath("userData"), "app.db")
    this._db = this.sqlite3Service.open(dbPath)
    this._db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        version    INTEGER PRIMARY KEY,
        applied_at TEXT    NOT NULL DEFAULT (datetime('now'))
      )
    `)
  }

  stop(): void {
    this._db?.close()
    this._db = null
  }

  applyMigrations(migrations: Migration[]): void {
    const db = this.db

    const row = db
      .prepare<[], { currentVersion: number | null }>(
        "SELECT MAX(version) AS currentVersion FROM migrations",
      )
      .get()

    const currentVersion = row?.currentVersion ?? 0

    const pending = migrations
      .filter((m) => m.version > currentVersion)
      .sort((a, b) => a.version - b.version)

    for (const migration of pending) {
      db.transaction(() => {
        db.exec(migration.sql)
        db.prepare("INSERT INTO migrations (version) VALUES (?)").run(
          migration.version,
        )
      })()
    }
  }
}
