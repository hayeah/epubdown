import type { SQLiteDB } from "@hayeah/sqlite-browser";

export type CollectionFileType = "markdown" | "image" | "other";

export interface CollectionMetadata {
  id: number;
  name: string;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt?: number;
}

export interface CollectionFile {
  collectionId: number;
  filePath: string;
  contentHash: Uint8Array;
  title?: string;
  frontmatter?: string; // JSON string of parsed YAML frontmatter
  sortOrder: number;
  fileType: CollectionFileType;
}

export class CollectionDatabase {
  constructor(public readonly db: SQLiteDB) {}

  static async create(db: SQLiteDB): Promise<CollectionDatabase> {
    return new CollectionDatabase(db);
  }

  // Collection CRUD operations

  async createCollection(name: string): Promise<number> {
    const now = Date.now();
    const result = await this.db.query<{ id: number }>(
      `INSERT INTO collections (name, created_at, updated_at)
       VALUES (?, ?, ?)
       RETURNING id`,
      [name, now, now],
    );

    if (!result.rows[0]) {
      throw new Error("Failed to get auto-generated collection ID");
    }
    return result.rows[0].id;
  }

  async getCollection(id: number): Promise<CollectionMetadata | null> {
    const result = await this.db.query(
      "SELECT * FROM collections WHERE id = ?",
      [id],
    );

    if (result.rows.length === 0) return null;
    return this.rowToCollectionMetadata(result.rows[0]);
  }

  async getAllCollections(): Promise<CollectionMetadata[]> {
    const results = await this.db.query(
      "SELECT * FROM collections ORDER BY COALESCE(last_opened_at, created_at) DESC, id DESC",
    );
    return results.rows.map(this.rowToCollectionMetadata);
  }

  async searchCollections(query: string): Promise<CollectionMetadata[]> {
    if (!query.trim()) {
      return this.getAllCollections();
    }

    const searchPattern = `%${query.toLowerCase()}%`;
    const results = await this.db.query(
      "SELECT * FROM collections WHERE LOWER(name) LIKE ? ORDER BY COALESCE(last_opened_at, created_at) DESC, id DESC",
      [searchPattern],
    );
    return results.rows.map(this.rowToCollectionMetadata);
  }

  async updateCollectionName(id: number, name: string): Promise<void> {
    await this.db.exec(
      "UPDATE collections SET name = ?, updated_at = ? WHERE id = ?",
      [name, Date.now(), id],
    );
  }

  async updateLastOpened(id: number): Promise<void> {
    await this.db.exec(
      "UPDATE collections SET last_opened_at = ? WHERE id = ?",
      [Date.now(), id],
    );
  }

  async deleteCollection(id: number): Promise<void> {
    // Files are deleted via CASCADE
    await this.db.exec("DELETE FROM collections WHERE id = ?", [id]);
  }

  // Collection files operations

  async addFile(file: Omit<CollectionFile, "sortOrder">): Promise<void> {
    // Get the current max sort order for this collection
    const maxResult = await this.db.query<{ max_order: number | null }>(
      "SELECT MAX(sort_order) as max_order FROM collection_files WHERE collection_id = ?",
      [file.collectionId],
    );
    const nextOrder = (maxResult.rows[0]?.max_order ?? -1) + 1;

    await this.db.exec(
      `INSERT INTO collection_files (collection_id, file_path, content_hash, title, frontmatter, sort_order, file_type)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(collection_id, file_path) DO UPDATE SET
         content_hash = excluded.content_hash,
         title = excluded.title,
         frontmatter = excluded.frontmatter,
         file_type = excluded.file_type`,
      [
        file.collectionId,
        file.filePath,
        file.contentHash,
        file.title ?? null,
        file.frontmatter ?? null,
        nextOrder,
        file.fileType,
      ],
    );

    // Update collection's updated_at
    await this.db.exec("UPDATE collections SET updated_at = ? WHERE id = ?", [
      Date.now(),
      file.collectionId,
    ]);
  }

  async getFiles(collectionId: number): Promise<CollectionFile[]> {
    const results = await this.db.query(
      "SELECT * FROM collection_files WHERE collection_id = ? ORDER BY sort_order ASC",
      [collectionId],
    );
    return results.rows.map(this.rowToCollectionFile);
  }

  async getMarkdownFiles(collectionId: number): Promise<CollectionFile[]> {
    const results = await this.db.query(
      "SELECT * FROM collection_files WHERE collection_id = ? AND file_type = 'markdown' ORDER BY sort_order ASC",
      [collectionId],
    );
    return results.rows.map(this.rowToCollectionFile);
  }

  async getMediaFiles(collectionId: number): Promise<CollectionFile[]> {
    const results = await this.db.query(
      "SELECT * FROM collection_files WHERE collection_id = ? AND file_type IN ('image', 'other') ORDER BY sort_order ASC",
      [collectionId],
    );
    return results.rows.map(this.rowToCollectionFile);
  }

  async getFile(
    collectionId: number,
    filePath: string,
  ): Promise<CollectionFile | null> {
    const result = await this.db.query(
      "SELECT * FROM collection_files WHERE collection_id = ? AND file_path = ?",
      [collectionId, filePath],
    );

    if (result.rows.length === 0) return null;
    return this.rowToCollectionFile(result.rows[0]);
  }

  async findFileByHash(
    collectionId: number,
    contentHash: Uint8Array,
  ): Promise<CollectionFile | null> {
    const result = await this.db.query(
      "SELECT * FROM collection_files WHERE collection_id = ? AND content_hash = ?",
      [collectionId, contentHash],
    );

    if (result.rows.length === 0) return null;
    return this.rowToCollectionFile(result.rows[0]);
  }

  async removeFile(collectionId: number, filePath: string): Promise<void> {
    await this.db.exec(
      "DELETE FROM collection_files WHERE collection_id = ? AND file_path = ?",
      [collectionId, filePath],
    );

    // Update collection's updated_at
    await this.db.exec("UPDATE collections SET updated_at = ? WHERE id = ?", [
      Date.now(),
      collectionId,
    ]);
  }

  async updateFileSortOrder(
    collectionId: number,
    filePath: string,
    sortOrder: number,
  ): Promise<void> {
    await this.db.exec(
      "UPDATE collection_files SET sort_order = ? WHERE collection_id = ? AND file_path = ?",
      [sortOrder, collectionId, filePath],
    );
  }

  async getFileCount(collectionId: number): Promise<number> {
    const result = await this.db.query<{ count: number }>(
      "SELECT COUNT(*) as count FROM collection_files WHERE collection_id = ?",
      [collectionId],
    );
    return result.rows[0]?.count ?? 0;
  }

  async getMarkdownFileCount(collectionId: number): Promise<number> {
    const result = await this.db.query<{ count: number }>(
      "SELECT COUNT(*) as count FROM collection_files WHERE collection_id = ? AND file_type = 'markdown'",
      [collectionId],
    );
    return result.rows[0]?.count ?? 0;
  }

  /**
   * Fix file types for .mdx files that were incorrectly classified
   * This migration updates any .mdx files to have fileType = 'markdown'
   */
  async migrateMdxFileTypes(): Promise<number> {
    const result = await this.db.query<{ changes: number }>(
      `UPDATE collection_files
       SET file_type = 'markdown'
       WHERE file_type != 'markdown'
       AND (file_path LIKE '%.mdx')
       RETURNING *`,
    );
    return result.rows.length;
  }

  // Row conversion helpers

  private rowToCollectionMetadata(row: any): CollectionMetadata {
    return {
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastOpenedAt: row.last_opened_at,
    };
  }

  private rowToCollectionFile(row: any): CollectionFile {
    return {
      collectionId: row.collection_id,
      filePath: row.file_path,
      contentHash: row.content_hash,
      title: row.title,
      frontmatter: row.frontmatter,
      sortOrder: row.sort_order,
      fileType: row.file_type,
    };
  }
}
