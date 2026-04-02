import Database from "better-sqlite3"

export const ISqlite3Service = Symbol("ISqlite3Service")

export interface ISqlite3Service {
  open(path: string, options?: Database.Options): Database.Database
}
