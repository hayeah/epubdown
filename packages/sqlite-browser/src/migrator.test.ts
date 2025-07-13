import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Migration, Migrator, createSqliteDatabase } from "./";

describe("Migrator", () => {
  let db: Awaited<ReturnType<typeof createSqliteDatabase>>;
  let migrator: Migrator;

  beforeEach(async () => {
    // Create a fresh in-memory database for each test
    db = await createSqliteDatabase({
      databaseName: ":memory:",
    });
    migrator = new Migrator(db.db);
  });

  afterEach(async () => {
    await db.close();
  });

  it("should create migrations table on first run", async () => {
    await migrator.up([]);

    const result = await db.db.query<{ name: string }>(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='migrations'
    `);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe("migrations");
  });

  it("should apply migrations in order", async () => {
    const migrations: Migration[] = [
      {
        name: "001_create_users",
        up: `
          CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE
          );
        `,
      },
      {
        name: "002_add_posts",
        up: `
          CREATE TABLE posts (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
          );
        `,
      },
    ];

    await migrator.up(migrations);

    // Check that both tables were created
    const tables = await db.db.query<{ name: string }>(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name IN ('users', 'posts')
      ORDER BY name
    `);

    expect(tables.rows).toHaveLength(2);
    expect(tables.rows[0].name).toBe("posts");
    expect(tables.rows[1].name).toBe("users");

    // Check that migrations were recorded
    const appliedMigrations = await db.db.query<{ name: string }>(`
      SELECT name FROM migrations ORDER BY name
    `);

    expect(appliedMigrations.rows).toHaveLength(2);
    expect(appliedMigrations.rows[0].name).toBe("001_create_users");
    expect(appliedMigrations.rows[1].name).toBe("002_add_posts");
  });

  it("should not apply migrations twice", async () => {
    const migration: Migration = {
      name: "001_create_table",
      up: `
        CREATE TABLE test_table (
          id INTEGER PRIMARY KEY,
          counter INTEGER DEFAULT 0
        );
        INSERT INTO test_table (counter) VALUES (1);
      `,
    };

    // Apply migration first time
    await migrator.up([migration]);

    // Apply migration second time
    await migrator.up([migration]);

    // Check that the insert only happened once
    const result = await db.db.query<{ count: number }>(`
      SELECT COUNT(*) as count FROM test_table
    `);

    expect(result.rows[0].count).toBe(1);
  });

  it("should handle empty migration list", async () => {
    await expect(migrator.up([])).resolves.not.toThrow();
  });

  it("should handle migration errors gracefully", async () => {
    const badMigration: Migration = {
      name: "001_bad_migration",
      up: "INVALID SQL SYNTAX HERE;",
    };

    await expect(migrator.up([badMigration])).rejects.toThrow();

    // Check that the migration was not recorded
    const appliedMigrations = await db.db.query<{ name: string }>(`
      SELECT name FROM migrations
    `);

    expect(appliedMigrations.rows).toHaveLength(0);
  });

  it("should apply new migrations when some are already applied", async () => {
    const firstBatch: Migration[] = [
      {
        name: "001_initial",
        up: "CREATE TABLE initial (id INTEGER PRIMARY KEY);",
      },
    ];

    const secondBatch: Migration[] = [
      ...firstBatch,
      {
        name: "002_second",
        up: "CREATE TABLE second (id INTEGER PRIMARY KEY);",
      },
      {
        name: "003_third",
        up: "CREATE TABLE third (id INTEGER PRIMARY KEY);",
      },
    ];

    // Apply first batch
    await migrator.up(firstBatch);

    // Apply second batch (including the already-applied migration)
    await migrator.up(secondBatch);

    // Check that all tables were created
    const tables = await db.db.query<{ name: string }>(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name IN ('initial', 'second', 'third')
      ORDER BY name
    `);

    expect(tables.rows).toHaveLength(3);

    // Check that all migrations were recorded
    const appliedMigrations = await db.db.query<{ name: string }>(`
      SELECT name FROM migrations ORDER BY name
    `);

    expect(appliedMigrations.rows).toHaveLength(3);
  });
});
