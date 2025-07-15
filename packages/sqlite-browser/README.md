# SQLite Browser

A lightweight, promise-based wrapper around **wa-sqlite** that makes it simple to run SQLite entirely inside the browser – with optional persistence to IndexedDB for long-lived databases.

- Thin wrapper `Driver` that boots a WASM build of SQLite and wires up an **IndexedDB-backed VFS** when you want persistence
- Thin ORM-style helper `SQLiteDB` that gives you async `exec`, `query`, and `transaction` with automatic queuing so you do not have to worry about overlap
- A migration helper `Migrator` inspired by server frameworks
- A `destroy` helper that closes the connection **and** cleans up the backing IndexedDB store (handy for tests)

## Installing

```bash
npm install @hayeah/sqlite-browser wa-sqlite
# or
pnpm add @hayeah/sqlite-browser wa-sqlite
```

## Opening a database

```ts
import { SQLiteDB } from "@hayeah/sqlite-browser";

const db = await SQLiteDB.open(); // in-memory (fast, volatile)
const persistent = await SQLiteDB.open("todo-app"); // persists to IndexedDB
```

`SQLiteDB.open(name?)`

- `":memory:"` (default) keeps everything in RAM
- Any other string becomes an **IndexedDB store** named `sqlite://<name>`

You can later discover the store through `db.indexedDBStore`.

## Running simple statements

```ts
await db.exec(`
  CREATE TABLE tasks (
    id   INTEGER PRIMARY KEY,
    text TEXT NOT NULL,
    done INTEGER DEFAULT 0
  );
`);

await db.exec(`INSERT INTO tasks (text) VALUES (?)`, ["Write guide"]);
```

### Parameters

Use standard SQLite `?` placeholders for parameters:

```ts
const { rows } = await db.query(
  "SELECT * FROM tasks WHERE done = ? LIMIT ?",
  [0, 10]
);
```

Returned shape:

```ts
// rows is an array of plain objects
[{ id: 1, text: "Write guide", done: 0 }];
```

Binary `BLOB`s are copied out of WASM memory for safety – you can store ArrayBuffers without leaks.

## Transactions

All public methods are queued so operations never collide. For atomic work, wrap a function in `transaction`:

```ts
await db.transaction(async (tx) => {
  await tx.exec("INSERT INTO tasks (text) VALUES (?)", ["Add tests"]);
  await tx.exec("INSERT INTO tasks (text) VALUES (?)", ["Ship release"]);
});
```

- `BEGIN` and `COMMIT` are issued automatically
- Inside the callback, operations **skip** the outer queue so they run inside the same transaction

Nested transactions? Just start another `transaction` inside; SQLite gives you savepoints.

## Migrations

Create an array of `Migration` objects, then run them once on startup:

```ts
import { Migrator, type Migration } from "@hayeah/sqlite-browser";

const migrations: Migration[] = [
  {
    name: "001-create-tasks",
    up: `
      CREATE TABLE tasks (
        id   INTEGER PRIMARY KEY,
        text TEXT NOT NULL,
        done INTEGER DEFAULT 0
      );
    `,
  },
  {
    name: "002-add-priority",
    up: `ALTER TABLE tasks ADD COLUMN priority INTEGER DEFAULT 0;`,
  },
];

const db = await SQLiteDB.open("todo-app");
await new Migrator(db).up(migrations);
```

- A meta table `migrations` tracks what has already run
- Migrations are **idempotent**: only new entries execute
- Runs inside one overarching transaction to guarantee atomicity

## Cleaning up in tests

```ts
import { destroy } from "@hayeah/sqlite-browser";

let db: SQLiteDB;

beforeEach(async () => {
  db = await SQLiteDB.open("test-db");
});

afterEach(async () => {
  await destroy(db); // closes connection and deletes IndexedDB store
});
```

`destroy` accepts either a `SQLiteDB` or a raw `Driver`.

## Accessing low-level Driver

```ts
import { Driver } from "@hayeah/sqlite-browser";

const driver = await Driver.open("analytics");
driver.sqlite3.exec(driver.handle, "VACUUM");
await driver.close();
```

Useful when you need wa-sqlite APIs that `SQLiteDB` does not expose.

---

## Working with BLOBs

```ts
// store raw Uint8Array
await db.exec(`INSERT INTO files (name, data) VALUES (?, ?)`,
              ["logo.png", new Uint8Array([...])]);

// retrieve
const { rows } = await db.query(`SELECT data FROM files WHERE id = ?`, [1]);
const blob = rows[0].data as Uint8Array;
```

Because the wrapper copies every Uint8Array, it is safe to keep `blob` after the query returns.

## Binary snapshots

Export and import databases as binary files using SQLite's native serialization:

```ts
import { serialize, deserialize } from "@hayeah/sqlite-browser";

// Export database to binary
const bytes = await serialize(db);

// Create Blob for download
const blob = new Blob([bytes], { type: 'application/x-sqlite3' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'database.sqlite';
a.click();
URL.revokeObjectURL(url);

// Import from file
const file = event.target.files[0];
const importBytes = new Uint8Array(await file.arrayBuffer());
const db = await SQLiteDB.open();
await deserialize(db, importBytes);
```

The exported file is a standard SQLite database that can be opened by any SQLite tool. The snapshot is consistent because `sqlite3_serialize` creates an implicit transaction.

Note: `deserialize` replaces all existing data in the database with the imported content.

Binary serialization is much faster than text-based `.dump` commands and preserves the exact page structure of your database.

## Browser versus test environment

During Vitest runs (`process.env.NODE_ENV === "test"`):

- The WASM binary loads from `node_modules/wa-sqlite/dist/wa-sqlite-async.wasm`
- No IndexedDB, unless you provide a polyfill such as `fake-indexeddb`

In real browsers:

- Vite injects a URL for the `.wasm` file with `?url`
- If you pass a `databaseName` other than `":memory:"`, a new IndexedDB store is created automatically

## Common pitfalls

- **Do not** mix `db.exec` with direct `driver.sqlite3` calls inside the same operation unless you fully understand the queuing model.
- Remember that some browsers block IndexedDB in private windows.
- WASM instantiation is asynchronous; always await `SQLiteDB.open`.
- For schema changes use migrations; skipping them often leaves users with divergent schemas.

## FAQ

- **Q: Can I share one database between multiple tabs?**
  A: Yes, IndexedDB is shared. Each tab runs its own WASM instance, but the VFS coordinates access through atomic batches.

- **Q: How big can the database grow?**
  A: IndexedDB limits vary, but hundreds of megabytes are usually fine; the biggest limit is user quota.

- **Q: Can I bundle this in a service worker?**
  A: Yes – just ensure you await `SQLiteDB.open` before handling fetch events.
