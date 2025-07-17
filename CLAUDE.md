- Once you are satisfied with the code, commit it.
  - Run relevant tests before commiting.
    - When you work on a workspace package (e.g. `packages/core`), remember to cd into it to run tests.
    - `cd packages/core && pnpm run check`
  - Always run pre-commit to clean up before commit.
  - If I ask you to make changes, create a new commit for the amend after you are happy with the changes.
- If you are in a git work tree, YOU MUST not cd out of the work tree into the root repo, or other work trees.
  - The work trees are typically named `.forks/001`, `.forks/002`. DO NOT cd or make changes out of these by accident.

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
- `pnpm run check` to do automatic lint fixing, format.

# Commit Message

- you MUST NOT include this in

```
🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```
