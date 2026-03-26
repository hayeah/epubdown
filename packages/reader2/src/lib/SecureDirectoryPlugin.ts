import { registerPlugin } from "@capacitor/core";

export interface PickDirectoryResult {
  bookmarkId: string;
  name: string;
  path: string;
}

export interface FileEntry {
  name: string;
  type: "file" | "directory";
  size: number;
  mtime: number;
}

export interface ListFilesResult {
  files: FileEntry[];
}

export interface ReadFileResult {
  data: string; // base64
}

export interface BookmarkEntry {
  bookmarkId: string;
  name: string;
  path: string;
}

export interface ListBookmarksResult {
  bookmarks: BookmarkEntry[];
}

export interface SecureDirectoryPluginInterface {
  pickDirectory(): Promise<PickDirectoryResult>;
  listFiles(options: { bookmarkId: string; path?: string }): Promise<ListFilesResult>;
  readFile(options: { bookmarkId: string; path: string }): Promise<ReadFileResult>;
  listBookmarks(): Promise<ListBookmarksResult>;
  removeBookmark(options: { bookmarkId: string }): Promise<void>;
}

export const SecureDirectory = registerPlugin<SecureDirectoryPluginInterface>("SecureDirectory");
