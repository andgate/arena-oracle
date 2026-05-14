import Database from "better-sqlite3"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ISqlite3Service } from "../sqlite3/Sqlite3Service.interface"
import { AppDbService } from "./AppDbService"
import { Migration } from "./migrations"

vi.mock("electron", () => ({
  app: { getPath: vi.fn(() => "/tmp/test-userData") },
}))

class Sqlite3ServiceFake implements ISqlite3Service {
  open(_path: string, options?: Database.Options): Database.Database {
    return new Database(":memory:", options)
  }
}

class PersistentSqlite3ServiceFake implements ISqlite3Service {
  private instance: Database.Database | null = null

  open(_path: string, options?: Database.Options): Database.Database {
    if (!this.instance) {
      const db = new Database(":memory:", options)
      // Return the same DB instance across open() calls so tests can simulate a
      // service restart on the same database. close() is proxied to a no-op because
      // better-sqlite3 permanently destroys an in-memory DB when closed — there is
      // no way to reopen it. All other properties and methods are forwarded normally
      // to the real DB instance.
      this.instance = new Proxy(db, {
        get(target, prop) {
          if (prop === "close") return () => {}
          const val = target[prop as keyof Database.Database]
          return typeof val === "function" ? val.bind(target) : val
        },
      }) as Database.Database
    }
    return this.instance
  }
}

describe("AppDbService", () => {
  let service: AppDbService

  beforeEach(() => {
    service = new AppDbService(new Sqlite3ServiceFake())
  })

  afterEach(() => {
    service.stop()
    vi.restoreAllMocks()
  })

  describe("start", () => {
    it("exposes the db after start", () => {
      service.start()

      expect(service.db).toBeDefined()
    })
  })

  describe("db getter", () => {
    it("throws when db is accessed before start", () => {
      expect(() => service.db).toThrow("AppDbService not started")
    })
  })

  describe("sqlite", () => {
    it("throws if the same CREATE TABLE sql is executed twice", () => {
      service.start()
      const sql = "CREATE TABLE foo (id INTEGER PRIMARY KEY)"
      service.db.exec(sql)

      expect(() => service.db.exec(sql)).toThrow()
    })

    it("two instances share the same database when given the same PersistentSqlite3ServiceFake", () => {
      const sqlite3 = new PersistentSqlite3ServiceFake()
      const s1 = new AppDbService(sqlite3)
      s1.start()
      s1.db.exec("CREATE TABLE foo (id INTEGER PRIMARY KEY)")
      s1.db.prepare("INSERT INTO foo (id) VALUES (?)").run(42)
      s1.stop()

      const s2 = new AppDbService(sqlite3)
      s2.start()
      const row = s2.db.prepare("SELECT id FROM foo WHERE id = 42").get()
      expect(row).toBeDefined()

      s2.stop()
    })
  })

  describe("migrations table", () => {
    it("bootstraps the migrations table on start", () => {
      service.start()

      const row = service.db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'",
        )
        .get()

      expect(row).toBeDefined()
    })

    it("starts with schema version 0 when no migrations are defined", () => {
      service.start()

      const row = service.db
        .prepare<
          [],
          { currentVersion: number | null }
        >("SELECT MAX(version) AS currentVersion FROM migrations")
        .get()

      expect(row?.currentVersion).toBeNull()
    })
  })

  describe("applyMigrations", () => {
    it("applies pending migrations in order and records their versions", () => {
      const migrations: Migration[] = [
        { version: 1, sql: "CREATE TABLE foo (id INTEGER PRIMARY KEY)" },
        { version: 2, sql: "CREATE TABLE bar (id INTEGER PRIMARY KEY)" },
      ]

      service.start()
      service.applyMigrations(migrations)

      const versions = service.db
        .prepare<[], { version: number }>(
          "SELECT version FROM migrations ORDER BY version",
        )
        .all()
        .map((r) => r.version)

      expect(versions).toEqual([1, 2])

      const tables = service.db
        .prepare<[], { name: string }>(
          "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('foo','bar')",
        )
        .all()
        .map((r) => r.name)
        .sort()

      expect(tables).toEqual(["bar", "foo"])
    })

    it("skips migrations already applied", () => {
      const sqlite3 = new PersistentSqlite3ServiceFake()
      const s1 = new AppDbService(sqlite3)
      s1.start()
      s1.applyMigrations([
        { version: 1, sql: "CREATE TABLE foo (id INTEGER PRIMARY KEY)" },
      ])
      s1.stop()

      const s2 = new AppDbService(sqlite3)
      s2.start()
      s2.applyMigrations([
        { version: 1, sql: "CREATE TABLE foo (id INTEGER PRIMARY KEY)" },
        { version: 2, sql: "CREATE TABLE bar (id INTEGER PRIMARY KEY)" },
      ])

      const versions = s2.db
        .prepare<[], { version: number }>(
          "SELECT version FROM migrations ORDER BY version",
        )
        .all()
        .map((r) => r.version)

      expect(versions).toEqual([1, 2])

      s2.stop()
    })
  })

  describe("stop", () => {
    it("closes the db on stop and throws on subsequent access", () => {
      service.start()
      service.stop()

      expect(() => service.db).toThrow("AppDbService not started")
    })

    it("stop is a no-op when not started", () => {
      expect(() => service.stop()).not.toThrow()
    })
  })
})

