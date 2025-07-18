- Once you are satisfied with the code, commit it.
  - Run relevant tests before commiting.
    - When you work on a workspace package (e.g. `packages/core`), remember to cd into it to run tests.
    - `cd packages/core && pnpm run check`
  - Always run pre-commit to clean up before commit.
  - If I ask you to make changes, create a new commit for the amend after you are happy with the changes.
- If you are in a git work tree, YOU MUST not cd out of the work tree into the root repo, or other work trees.
  - The work trees are typically named `.forks/001`, `.forks/002`. DO NOT cd or make changes out of these by accident.

# Typescript Style Guide

## Typescript Class

- how you should write typescript class
  - Use `constructor(public foo: str, public bar number)` to declare and assign to instance properties
  - Prefer composition & injection into the constructor, rather than constructing complex classes inside the constructor
  - if a property requires async to initialize, create an async factory method on the class, then inject the awaited value into a normal constructor
    - this avoids an `init` instance method
  - Example code:

```
private readonly dbName: string;
  private readonly storeName: string;

  constructor(
    private readonly db: IDBDatabase,
    config: BlobStoreConfig,
  ) {
    this.dbName = config.dbName;
    this.storeName = config.storeName;
  }

  static async create(config: BlobStoreConfig): Promise<BlobStore> {
    const dbName = config.dbName;
    const storeName = config.storeName;
    const version = BlobStore.CURRENT_DB_VERSION;

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      // ...
    });

    return new BlobStore(db, config);
  }
```

# Make Notes

- When making complex or tricky changes to a file, you should make notes beside the source file.
- If the file is named `BlobStore.ts`, name your note `BlobStore.md`. Replace extension with `.md`.
- Make sure that the notes are up to date, current with the latest implementation.
- Commit your notes along with the code changes.

# File Naming Convention

- If a file primarily export a class or a component, name the file the same as the exported name.
  - For example `export BlobStore` should be named `BlobStore.ts`.
  - For example `export MyComponent` should be named `MyComponent.tsx`.
- test files (vitest) should be placed in the same directory as the source code.
  - tests for "src/BlobStore.ts" should be "src/BlobStore.test.ts"
- tests that should run in browser have the naming convention of: "src/BlobStore.test.browser.ts"

# Lint / Format

- If you worked on typescript, run `tsc` to type check and fix errors.
  - run in package root
- `pnpm run check` to do automatic lint fixing, format.
  - run in repo root

# Commit Message

- you MUST NOT include this in

```
🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```
