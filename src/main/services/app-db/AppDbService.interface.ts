import Database from "better-sqlite3"
import { Migration } from "./migrations"

export const IAppDbService = Symbol("IAppDbService")

export interface IAppDbService {
  readonly db: Database.Database
  applyMigrations(migrations: Migration[]): void
}
