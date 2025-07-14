import type { SQLiteDB } from "./SQLiteDB";

/**
 * Serialize a SQLite database to a binary format using sqlite3_serialize.
 * This creates a consistent snapshot of the database that can be restored later.
 *
 * @param db The SQLiteDB instance to serialize
 * @param schema The database schema to serialize (default: "main")
 * @returns A Uint8Array containing the serialized database
 */
export async function serialize(
  db: SQLiteDB,
  schema = "main",
): Promise<Uint8Array> {
  const driver = db.driver;
  const module = driver.module;

  // Allocate space for the size pointer
  const sizePtr = module._malloc(8);

  try {
    // Call sqlite3_serialize - returns a pointer to the serialized data
    // The function signature is: sqlite3_serialize(db, schema, piSize, flags)
    // flags = 0 for default behavior
    const schemaPtr = allocateString(module, schema);
    const dataPtr = module._sqlite3_serialize(
      driver.handle,
      schemaPtr,
      sizePtr,
      0,
    );
    module._free(schemaPtr);

    if (dataPtr === 0) {
      throw new Error("Failed to serialize database");
    }

    // Get the size of the serialized data
    const size = module.HEAP32[sizePtr >> 2];

    // Create a copy of the data from WASM memory
    const data = new Uint8Array(module.HEAPU8.buffer, dataPtr, size);
    const copy = new Uint8Array(data);

    // Free the serialized data allocated by SQLite
    module._sqlite3_free(dataPtr);

    return copy;
  } finally {
    module._free(sizePtr);
  }
}

/**
 * Deserialize a binary database into an existing SQLiteDB instance using sqlite3_deserialize.
 * This replaces the current database content with the deserialized data.
 *
 * @param db The SQLiteDB instance to deserialize into
 * @param bytes The serialized database data
 * @param schema The database schema to deserialize (default: "main")
 * @returns Promise that resolves when deserialization is complete
 */
export async function deserialize(
  db: SQLiteDB,
  bytes: Uint8Array,
  schema = "main",
): Promise<void> {
  const driver = db.driver;
  const module = driver.module;

  // Allocate memory and copy the serialized data
  const dataPtr = module._malloc(bytes.length);
  module.HEAPU8.set(bytes, dataPtr);

  // Call sqlite3_deserialize
  // The function signature is: sqlite3_deserialize(db, schema, data, size, size_used, flags)
  // flags: SQLITE_DESERIALIZE_FREEONCLOSE = 1, SQLITE_DESERIALIZE_RESIZEABLE = 2
  // With flags=1, SQLite takes ownership of the buffer and will free it when the database is closed
  const schemaPtr = allocateString(module, schema);
  const rc = module._sqlite3_deserialize(
    driver.handle,
    schemaPtr,
    dataPtr,
    bytes.length,
    bytes.length,
    1, // SQLITE_DESERIALIZE_FREEONCLOSE - SQLite takes ownership
  );
  module._free(schemaPtr);

  if (rc !== 0) {
    // Only free on error, since SQLite didn't take ownership
    module._free(dataPtr);
    throw new Error(`Failed to deserialize database: SQLite error code ${rc}`);
  }
}

/**
 * Convert a Uint8Array to a Blob for browser downloads
 *
 * @param bytes The serialized database bytes
 * @param fileName Optional filename for the blob
 * @returns A Blob containing the database
 */
export function toBlob(bytes: Uint8Array, fileName = "database.sqlite"): Blob {
  return new Blob([bytes], { type: "application/x-sqlite3" });
}

/**
 * Helper function to allocate a string in WASM memory
 */
function allocateString(module: any, str: string): number {
  const utf8 = new TextEncoder().encode(str);
  const ptr = module._malloc(utf8.length + 1);
  module.HEAPU8.set(utf8, ptr);
  module.HEAPU8[ptr + utf8.length] = 0;
  return ptr;
}
