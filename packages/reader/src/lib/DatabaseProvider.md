# DatabaseProvider

This module provides a singleton pattern for managing a shared SQLite database instance across the entire reader package.

## Design Decisions

1. **Memoization Pattern**: The `getDb()` function lazily creates and caches a single SQLiteDB instance, ensuring all database accessor classes share the same connection.

2. **Explicit Cleanup**: The `closeDb()` function allows for proper cleanup in tests and during app shutdown.

3. **Status Check**: The `isDbOpen()` function helps with debugging and test assertions.

## Usage Pattern

```typescript
// In database accessor classes
const db = await getDb();
const bookDb = await BookDatabase.create(db);

// In tests (afterAll hook)
await closeDb();
```

## Future Considerations

- Could be extended to support multiple named databases if needed
- Could add connection pooling or retry logic
- Could integrate with a dependency injection framework