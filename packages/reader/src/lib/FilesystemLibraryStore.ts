import { EPub } from "@epubdown/core";
import type { SQLiteDB } from "@hayeah/sqlite-browser";
import type { FileType } from "./BookDatabase";
import { rowToBookMetadata } from "./IndexedDBLibraryStore";
import type { BookMetadata, LibraryStore } from "./LibraryStore";

interface FileEntry {
  relativePath: string;
  file: File;
  fileType: FileType;
}

/**
 * LibraryStore backed by a filesystem directory via File System Access API.
 * Metadata is indexed in SQLite; blobs are read from the directory handle on demand.
 */
export class FilesystemLibraryStore implements LibraryStore {
  private lastSyncAt: number | null = null;
  private static readonly STALE_MS = 30_000;

  constructor(
    private readonly db: SQLiteDB,
    private readonly libraryId: string,
    private readonly dirHandle: FileSystemDirectoryHandle,
  ) {}

  async listBooks(opts?: { match?: string }): Promise<BookMetadata[]> {
    // Auto-sync if stale
    if (
      !this.lastSyncAt ||
      Date.now() - this.lastSyncAt > FilesystemLibraryStore.STALE_MS
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
    // Get metadata from SQLite
    const result = await this.db.query(
      "SELECT * FROM books WHERE id = ? AND library_id = ?",
      [id, this.libraryId],
    );

    if (result.rows.length === 0) {
      throw new Error(`Book not found: ${id}`);
    }

    const metadata = rowToBookMetadata(result.rows[0]);

    // Read blob from filesystem
    const fileHandle = await this.resolveFileHandle(id);
    const file = await fileHandle.getFile();

    // Update last opened
    await this.db.exec("UPDATE books SET last_opened_at = ? WHERE id = ?", [
      Date.now(),
      id,
    ]);

    return { blob: file, metadata };
  }

  async sync(): Promise<number> {
    // Step 1: walk directory
    const onDisk = await this.walkDirectory();

    // Step 2: get current index
    const indexResult = await this.db.query(
      "SELECT id, mtime FROM books WHERE library_id = ?",
      [this.libraryId],
    );
    const indexMap = new Map<string, number>(
      indexResult.rows.map((r: any) => [r.id, r.mtime]),
    );

    // Step 3: diff
    const toAdd: FileEntry[] = [];
    const toUpdate: FileEntry[] = [];
    const toRemove: string[] = [];

    for (const entry of onDisk) {
      const cachedMtime = indexMap.get(entry.relativePath);
      if (cachedMtime === undefined) {
        toAdd.push(entry);
      } else if (cachedMtime !== entry.file.lastModified) {
        toUpdate.push(entry);
      }
      indexMap.delete(entry.relativePath);
    }
    toRemove.push(...indexMap.keys());

    // Step 4: process changes
    for (const entry of [...toAdd, ...toUpdate]) {
      const meta = await this.parseMetadata(entry);
      await this.db.exec(
        `INSERT OR REPLACE INTO books (id, library_id, title, author, filename, file_size, file_type, mtime, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.relativePath,
          this.libraryId,
          meta.title,
          meta.author || null,
          entry.file.name,
          entry.file.size,
          entry.fileType,
          entry.file.lastModified,
          meta.metadata || null,
          Date.now(),
        ],
      );
    }

    for (const id of toRemove) {
      await this.db.exec("DELETE FROM books WHERE id = ? AND library_id = ?", [
        id,
        this.libraryId,
      ]);
    }

    this.lastSyncAt = Date.now();
    return onDisk.length;
  }

  private async walkDirectory(): Promise<FileEntry[]> {
    const entries: FileEntry[] = [];
    for await (const entry of walkFiles(this.dirHandle)) {
      entries.push(entry);
    }
    return entries;
  }

  private async parseMetadata(
    entry: FileEntry,
  ): Promise<{ title: string; author?: string; metadata?: string }> {
    if (entry.fileType === "epub") {
      try {
        const arrayBuffer = await entry.file.arrayBuffer();
        const epub = await EPub.fromZip(arrayBuffer);
        const meta = epub.metadata.toJSON();
        return {
          title: meta.title || titleFromFilename(entry.file.name),
          author: meta.creator || meta.author,
          metadata: JSON.stringify(meta),
        };
      } catch {
        // Fall back to filename if EPUB parsing fails
        return { title: titleFromFilename(entry.file.name) };
      }
    }
    // PDF: use filename as title
    return { title: titleFromFilename(entry.file.name) };
  }

  private async resolveFileHandle(
    relativePath: string,
  ): Promise<FileSystemFileHandle> {
    const parts = relativePath.split("/");
    let dir: FileSystemDirectoryHandle = this.dirHandle;

    // Navigate to subdirectory
    for (let i = 0; i < parts.length - 1; i++) {
      dir = await dir.getDirectoryHandle(parts[i]!);
    }

    const fileName = parts[parts.length - 1]!;
    return dir.getFileHandle(fileName);
  }
}

function titleFromFilename(filename: string): string {
  return filename.replace(/\.(epub|pdf)$/i, "");
}

async function* walkFiles(
  dir: FileSystemDirectoryHandle,
  prefix = "",
): AsyncGenerator<FileEntry> {
  for await (const [name, handle] of dir as any) {
    const path = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === "file") {
      const ext = name.split(".").pop()?.toLowerCase();
      if (ext === "epub" || ext === "pdf") {
        const file = await (handle as FileSystemFileHandle).getFile();
        yield { relativePath: path, file, fileType: ext as FileType };
      }
    } else if (handle.kind === "directory") {
      yield* walkFiles(handle as FileSystemDirectoryHandle, path);
    }
  }
}
