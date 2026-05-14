export interface Migration {
  version: number
  sql: string
}

// Add new migrations in order. Each sub-issue appends one entry here.
// The runner bootstraps the `migrations` table itself — entries below are for app schema.
export const MIGRATIONS: Migration[] = []
