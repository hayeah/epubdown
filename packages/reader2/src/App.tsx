import { useCallback, useEffect, useState } from "react";
import { loadHandle, saveHandle } from "./handleStore";
import { type ScannedFile, scanDirectory } from "./scanDirectory";

const LIBRARY_KEY = "default-library";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function App() {
  const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [files, setFiles] = useState<ScannedFile[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirName, setDirName] = useState<string | null>(null);

  const scan = useCallback(async (handle: FileSystemDirectoryHandle) => {
    setScanning(true);
    setError(null);
    try {
      const results = await scanDirectory(handle);
      setFiles(results);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setScanning(false);
    }
  }, []);

  // Try to restore saved handle on mount
  useEffect(() => {
    (async () => {
      const saved = await loadHandle(LIBRARY_KEY);
      if (!saved) return;

      const perm = await saved.queryPermission({ mode: "read" });
      if (perm === "granted") {
        setDirHandle(saved);
        setDirName(saved.name);
        scan(saved);
      } else {
        // Need user gesture to re-request — show the directory name so they know
        setDirName(saved.name);
        setDirHandle(saved);
      }
    })();
  }, [scan]);

  const pickDirectory = async () => {
    try {
      const handle = await window.showDirectoryPicker({ mode: "read" });
      await saveHandle(LIBRARY_KEY, handle);
      setDirHandle(handle);
      setDirName(handle.name);
      scan(handle);
    } catch (e) {
      // User cancelled the picker
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const requestPermission = async () => {
    if (!dirHandle) return;
    const perm = await dirHandle.requestPermission({ mode: "read" });
    if (perm === "granted") {
      scan(dirHandle);
    }
  };

  const hasPermission = dirHandle !== null && files.length > 0;

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-2xl font-bold">reader2</h1>

      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={pickDirectory}
          className="rounded bg-orange-600 px-4 py-2 text-white hover:bg-orange-700"
        >
          Pick Directory
        </button>

        {dirHandle && !hasPermission && (
          <button
            type="button"
            onClick={requestPermission}
            className="rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
          >
            Re-grant access to {dirName}
          </button>
        )}

        {dirName && <span className="text-sm text-gray-500">{dirName}</span>}
      </div>

      {error && <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {scanning && <p className="text-gray-500">Scanning...</p>}

      {files.length > 0 && (
        <div>
          <p className="mb-3 text-sm text-gray-500">
            {files.length} epub{files.length !== 1 ? "s" : ""} found
          </p>
          <ul className="space-y-1">
            {files.map((f) => (
              <li
                key={f.relativePath}
                className="flex items-baseline justify-between rounded px-3 py-2 hover:bg-gray-50"
              >
                <span className="font-medium">{f.name}</span>
                <span className="ml-4 text-sm text-gray-400 shrink-0">{formatSize(f.size)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!scanning && files.length === 0 && dirHandle && hasPermission && (
        <p className="text-gray-500">No .epub files found.</p>
      )}
    </div>
  );
}
