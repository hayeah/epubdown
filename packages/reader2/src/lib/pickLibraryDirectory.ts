import { isNative } from "./platform";

export interface PickedDirectory {
  /** Display name for the library */
  name: string;
  /** On web: FileSystemDirectoryHandle. On native: null. */
  handle: FileSystemDirectoryHandle | null;
  /** On native: absolute path. On web: null. */
  path: string | null;
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
  const { FilePicker } = await import("@capawesome/capacitor-file-picker");
  try {
    const result = await FilePicker.pickDirectory();
    // result.path is a native absolute path or content URI
    const name = result.path.split("/").filter(Boolean).pop() || "Library";
    return { name, handle: null, path: result.path };
  } catch {
    // User cancelled or plugin error
    return null;
  }
}

async function pickWeb(): Promise<PickedDirectory | null> {
  try {
    const handle = await window.showDirectoryPicker({ mode: "read" });
    return { name: handle.name, handle, path: null };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return null;
    throw e;
  }
}
