import type { FileType } from "./BookDatabase";

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

export interface LibraryStore {
  listBooks(opts?: { match?: string }): Promise<BookMetadata[]>;
  loadBook(id: string): Promise<{ blob: Blob; metadata: BookMetadata }>;
}

export type LibraryType = "indexeddb" | "filesystem";

export interface LibraryConfig {
  id: string;
  name: string;
  type: LibraryType;
  createdAt: number;
}
