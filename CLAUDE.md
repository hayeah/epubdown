- Once you are satisfied with the code, commit it.
  - Always run pre-commit to clean up before commit.
- If I ask you to make changes, create a new commit for the amend after you are happy with the changes.

# File Naming Convention

- If a file primarily export a class or a component, name the file the same as the exported name.
  - For example `export BlobStore` should be named `BlobStore.ts`.
  - For example `export MyComponent` should be named `MyComponent.tsx`.
- test files (vitest) should be placed in the same directory as the source code.
  - tests for "src/BlobStore.ts" should be "src/BlobStore.test.ts"
- tests that should run in browser have the naming convention of: "src/BlobStore.test.browser.ts"

# Lint / Format

- `pnpm run check` to do automatic lint fixing, format.
