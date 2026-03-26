export type FileType = "epub" | "pdf";
export type LibraryType = "indexeddb" | "filesystem";

export interface BookMetadata {
  id: string;
  libraryId: string;
  title: string;
  author?: string;
  fileType: FileType;
  filename: string;
  fileSize: number;
  lastOpenedAt?: number;
  metadata?: string;
}

export interface LibraryConfig {
  id: string;
  name: string;
  type: LibraryType;
  createdAt: number;
  /** Native directory path (Capacitor only, null on web) */
  dirPath?: string | null;
}

export interface LibraryStore {
  listBooks(opts?: { match?: string }): Promise<BookMetadata[]>;
  loadBook(id: string): Promise<{ blob: Blob; metadata: BookMetadata }>;
}

export function rowToBookMetadata(row: any): BookMetadata {
  return {
    id: String(row.id),
    libraryId: row.library_id || "default",
    title: row.title,
    author: row.author || undefined,
    fileType: row.file_type || "epub",
    filename: row.filename,
    fileSize: row.file_size,
    lastOpenedAt: row.last_opened_at || undefined,
    metadata: row.metadata || undefined,
  };
}
