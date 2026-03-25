export interface ScannedFile {
  relativePath: string;
  name: string;
  size: number;
  lastModified: number;
}

export async function scanDirectory(
  dir: FileSystemDirectoryHandle,
  prefix = "",
): Promise<ScannedFile[]> {
  const results: ScannedFile[] = [];

  for await (const [name, handle] of dir) {
    const path = prefix ? `${prefix}/${name}` : name;

    if (handle.kind === "file") {
      const ext = name.split(".").pop()?.toLowerCase();
      if (ext === "epub") {
        const file = await (handle as FileSystemFileHandle).getFile();
        results.push({
          relativePath: path,
          name: file.name,
          size: file.size,
          lastModified: file.lastModified,
        });
      }
    } else if (handle.kind === "directory") {
      const nested = await scanDirectory(handle as FileSystemDirectoryHandle, path);
      results.push(...nested);
    }
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}
