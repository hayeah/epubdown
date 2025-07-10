# @hayeah/sqlite-browser

SQLite for browser with IndexedDB persistence using wa-sqlite.

## Features

- SQLite in the browser using WebAssembly
- Automatic persistence to IndexedDB
- Transaction support with proper rollback
- Queue-based execution for thread safety
- TypeScript support
- Parameterized queries with `$1, $2` syntax
- Database migrations

## Installation

```bash
npm install @hayeah/sqlite-browser wa-sqlite
```

## Usage

### Basic Usage

```typescript
import { createSqliteDatabase } from '@hayeah/sqlite-browser';

// Create a database instance
const { db, close } = await createSqliteDatabase({
  databaseName: 'myapp.db',
  storeName: 'myapp-store'
});

// Create tables
await db.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE
  )
`);

// Insert data
await db.query(
  'INSERT INTO users (name, email) VALUES ($1, $2)',
  ['John Doe', 'john@example.com']
);

// Query data
const result = await db.query<{ id: number; name: string; email: string }>(
  'SELECT * FROM users WHERE email = $1',
  ['john@example.com']
);

console.log(result.rows[0]); // { id: 1, name: 'John Doe', email: 'john@example.com' }

// Close the database when done
await close();
```

### Transactions

```typescript
await db.transaction(async (tx) => {
  await tx.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [100, 1]);
  await tx.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [100, 2]);
});
```

### Migrations

```typescript
import { Migrator } from '@hayeah/sqlite-browser';

const migrations = [
  {
    name: '001_create_users',
    up: `CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL
    )`
  },
  {
    name: '002_add_email',
    up: `ALTER TABLE users ADD COLUMN email TEXT`
  }
];

const migrator = new Migrator(db);
await migrator.up(migrations);
```

## API

### createSqliteDatabase(options?)

Creates a new SQLite database instance.

Options:
- `databaseName`: Name of the database file (default: "database.db")
- `storeName`: Name of the IndexedDB store for persistence (default: "sqlite-store")
- `useIndexedDB`: Whether to use IndexedDB for persistence (default: true, false in test environment)
- `wasmBinary`: Custom WASM binary as ArrayBuffer
- `wasmUrl`: Custom URL to load WASM from

### SQLiteDBWrapper

The main database interface with the following methods:

- `exec(sql: string)`: Execute SQL statements without returning results
- `query<T>(sql: string, params?: unknown[])`: Execute queries and return results
- `transaction<T>(fn: (tx: SQLiteDBWrapper) => Promise<T>)`: Run operations in a transaction

### Migrator

Database migration tool:

- `up(migrations: Migration[])`: Apply all pending migrations

## License

MIT