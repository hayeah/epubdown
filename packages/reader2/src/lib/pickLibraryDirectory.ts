import { isNative } from "./platform";

export interface PickedDirectory {
  /** Display name for the library */
  name: string;
  /** On web: FileSystemDirectoryHandle. On native: null. */
  handle: FileSystemDirectoryHandle | null;
  /** On native: bookmarkId for SecureDirectory plugin. On web: null. */
  bookmarkId: string | null;
}

/**
 * Opens a native or web directory picker.
 * Returns null if the user cancelled.
 */
export async function pickLibraryDirectory(): Promise<PickedDirectory | null> {
  if (isNative()) {
    return pickNative();
  }
  return pickWeb();
}

async function pickNative(): Promise<PickedDirectory | null> {
  const { SecureDirectory } = await import("./SecureDirectoryPlugin");
  try {
    const result = await SecureDirectory.pickDirectory();
    return { name: result.name, handle: null, bookmarkId: result.bookmarkId };
  } catch {
    // User cancelled
    return null;
  }
}

async function pickWeb(): Promise<PickedDirectory | null> {
  try {
    const handle = await window.showDirectoryPicker({ mode: "read" });
    return { name: handle.name, handle, bookmarkId: null };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return null;
    throw e;
  }
}
