import Database from "better-sqlite3"
import { injectable, singleton } from "tsyringe"
import { ISqlite3Service } from "./Sqlite3Service.interface"

@injectable()
@singleton()
export class Sqlite3Service implements ISqlite3Service {
  open(path: string, options?: Database.Options): Database.Database {
    return new Database(path, options)
  }
}
