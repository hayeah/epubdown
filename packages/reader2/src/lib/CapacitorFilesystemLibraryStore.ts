import { EPub } from "@epubdown/core";
import type { SQLiteDB } from "@hayeah/sqlite-browser";
import type { BookMetadata, FileType, LibraryStore } from "./LibraryStore";
import { rowToBookMetadata } from "./LibraryStore";
import { SecureDirectory } from "./SecureDirectoryPlugin";

interface NativeFileEntry {
  relativePath: string;
  fileType: FileType;
  size: number;
  mtime: number;
}

/**
 * LibraryStore backed by the SecureDirectory native plugin.
 * Uses a bookmarkId to access a security-scoped directory on iOS.
 */
export class CapacitorFilesystemLibraryStore implements LibraryStore {
  private lastSyncAt: number | null = null;
  private static readonly STALE_MS = 30_000;

  constructor(
    private readonly db: SQLiteDB,
    private readonly libraryId: string,
    private readonly bookmarkId: string,
  ) {}

  async listBooks(opts?: { match?: string }): Promise<BookMetadata[]> {
    if (
      !this.lastSyncAt ||
      Date.now() - this.lastSyncAt > CapacitorFilesystemLibraryStore.STALE_MS
    ) {
      await this.sync();
    }

    const match = opts?.match?.trim();
    let sql: string;
    let params: any[];

    if (match) {
      const pattern = `%${match.toLowerCase()}%`;
      sql = `SELECT * FROM books WHERE library_id = ? AND (LOWER(title) LIKE ? OR LOWER(author) LIKE ?)
             ORDER BY title COLLATE NOCASE ASC`;
      params = [this.libraryId, pattern, pattern];
    } else {
      sql = `SELECT * FROM books WHERE library_id = ?
             ORDER BY COALESCE(last_opened_at, created_at) DESC, id DESC`;
      params = [this.libraryId];
    }

    const result = await this.db.query(sql, params);
    return result.rows.map(rowToBookMetadata);
  }

  async loadBook(id: string): Promise<{ blob: Blob; metadata: BookMetadata }> {
    const result = await this.db.query(
      "SELECT * FROM books WHERE id = ? AND library_id = ?",
      [id, this.libraryId],
    );
    if (result.rows.length === 0) throw new Error(`Book not found: ${id}`);

    const metadata = rowToBookMetadata(result.rows[0]);

    const readResult = await SecureDirectory.readFile({
      bookmarkId: this.bookmarkId,
      path: metadata.filename,
    });
    const binary = base64ToArrayBuffer(readResult.data);
    const blob = new Blob([binary], {
      type: mimeForFileType(metadata.fileType),
    });

    await this.db.exec("UPDATE books SET last_opened_at = ? WHERE id = ?", [
      Date.now(),
      id,
    ]);
    return { blob, metadata };
  }

  async sync(): Promise<number> {
    const onDisk = await this.walkDirectory("");
    const indexResult = await this.db.query(
      "SELECT id, filename, mtime FROM books WHERE library_id = ?",
      [this.libraryId],
    );
    const indexMap = new Map<string, { id: number; mtime: number }>(
      indexResult.rows.map((r: any) => [
        r.filename,
        { id: r.id, mtime: r.mtime },
      ]),
    );

    const toAdd: NativeFileEntry[] = [];
    const toUpdate: { entry: NativeFileEntry; existingId: number }[] = [];
    const toRemove: number[] = [];

    for (const entry of onDisk) {
      const cached = indexMap.get(entry.relativePath);
      if (!cached) {
        toAdd.push(entry);
      } else if (cached.mtime !== entry.mtime) {
        toUpdate.push({ entry, existingId: cached.id });
      }
      indexMap.delete(entry.relativePath);
    }
    for (const { id } of indexMap.values()) {
      toRemove.push(id);
    }

    for (const entry of toAdd) {
      const meta = await this.parseMetadata(entry);
      await this.db.exec(
        `INSERT OR IGNORE INTO books (library_id, title, author, filename, file_size, file_type, mtime, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          this.libraryId,
          meta.title,
          meta.author || null,
          entry.relativePath,
          entry.size,
          entry.fileType,
          entry.mtime,
          meta.metadata || null,
          Date.now(),
        ],
      );
    }

    for (const { entry, existingId } of toUpdate) {
      const meta = await this.parseMetadata(entry);
      await this.db.exec(
        `UPDATE books SET title = ?, author = ?, file_size = ?, file_type = ?, mtime = ?, metadata = ? WHERE id = ?`,
        [
          meta.title,
          meta.author || null,
          entry.size,
          entry.fileType,
          entry.mtime,
          meta.metadata || null,
          existingId,
        ],
      );
    }

    for (const id of toRemove) {
      await this.db.exec("DELETE FROM books WHERE id = ?", [id]);
    }

    this.lastSyncAt = Date.now();
    return onDisk.length;
  }

  private async walkDirectory(subpath: string): Promise<NativeFileEntry[]> {
    const entries: NativeFileEntry[] = [];

    const result = await SecureDirectory.listFiles({
      bookmarkId: this.bookmarkId,
      path: subpath || undefined,
    });

    for (const fileInfo of result.files) {
      const relativePath = subpath
        ? `${subpath}/${fileInfo.name}`
        : fileInfo.name;

      if (fileInfo.type === "file") {
        const ext = fileInfo.name.split(".").pop()?.toLowerCase();
        if (ext === "epub" || ext === "pdf") {
          entries.push({
            relativePath,
            fileType: ext as FileType,
            size: fileInfo.size,
            mtime: fileInfo.mtime,
          });
        }
      } else if (fileInfo.type === "directory") {
        const subEntries = await this.walkDirectory(relativePath);
        entries.push(...subEntries);
      }
    }

    return entries;
  }

  private async parseMetadata(
    entry: NativeFileEntry,
  ): Promise<{ title: string; author?: string; metadata?: string }> {
    if (entry.fileType === "epub") {
      try {
        const readResult = await SecureDirectory.readFile({
          bookmarkId: this.bookmarkId,
          path: entry.relativePath,
        });
        const arrayBuffer = base64ToArrayBuffer(readResult.data);
        const epub = await EPub.fromZip(arrayBuffer);
        const meta = epub.metadata.toJSON();
        return {
          title: meta.title || titleFromFilename(entry.relativePath),
          author: meta.creator || meta.author,
          metadata: JSON.stringify(meta),
        };
      } catch {
        return { title: titleFromFilename(entry.relativePath) };
      }
    }
    return { title: titleFromFilename(entry.relativePath) };
  }
}

function titleFromFilename(filename: string): string {
  const basename = filename.split("/").pop() || filename;
  return basename.replace(/\.(epub|pdf)$/i, "");
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function mimeForFileType(fileType: FileType): string {
  return fileType === "epub" ? "application/epub+zip" : "application/pdf";
}
