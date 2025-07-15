export interface SQLLikeDB {
  exec(sql: string, params?: unknown[]): Promise<void>;
  query<R = unknown>(sql: string, params?: unknown[]): Promise<{ rows: R[] }>;
  close?(): Promise<void>;
}

export interface Migration {
  name: string;
  up: string;
}

export class Migrator {
  constructor(private db: SQLLikeDB) {}

  /**
   * Run all pending migrations.
   */
  public async up(migrations: Migration[]): Promise<void> {
    // Create a table to track which migrations have been applied
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Get list of already-applied migrations
    const result: { rows: { name: string }[] } = await this.db.query(`
      SELECT name FROM migrations;
    `);
    const appliedMigrations = new Set(result.rows.map((row) => row.name));

    // Apply each migration that hasn't been applied yet
    for (const migration of migrations) {
      if (!appliedMigrations.has(migration.name)) {
        console.log(`Applying migration: ${migration.name}`);
        await this.db.exec(migration.up);

        // Mark the migration as applied
        await this.db.query("INSERT INTO migrations (name) VALUES (?)", [
          migration.name,
        ]);
      }
    }
  }
}
