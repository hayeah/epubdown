import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import JSZip from "jszip";

/**
 * Unzip a file to a directory
 * @param inputPath Path to the zip file
 * @param outputDir Directory to extract files to
 */
export async function unzip(
  inputPath: string | Buffer | Uint8Array,
  outputDir: string,
): Promise<void> {
  const data =
    typeof inputPath === "string" ? await fs.readFile(inputPath) : inputPath;
  const zip = await JSZip.loadAsync(data);

  // Extract all files
  for (const [relativePath, file] of Object.entries(zip.files)) {
    if (!file.dir) {
      const filePath = join(outputDir, relativePath);
      await fs.mkdir(dirname(filePath), { recursive: true });
      const content = await file.async("uint8array");
      await fs.writeFile(filePath, content);
    }
  }
}

/**
 * Zip a directory and write to output path
 * @param dir Directory to zip
 * @param outputPath Path to write the zip file
 */
export async function zip(dir: string, outputPath: string): Promise<void> {
  const zipData = await zipToBuffer(dir);
  await fs.writeFile(outputPath, zipData);
}

/**
 * Zip a directory and return as buffer
 * @param dir Directory to zip
 * @returns Zip data as Uint8Array
 */
export async function zipToBuffer(dir: string): Promise<Uint8Array> {
  const newZip = new JSZip();

  // Add all files from directory to zip
  async function addFilesToZip(currentDir: string, zipPath = "") {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      const zipFilePath = zipPath ? join(zipPath, entry.name) : entry.name;

      if (entry.isDirectory()) {
        await addFilesToZip(fullPath, zipFilePath);
      } else {
        const content = await fs.readFile(fullPath);
        newZip.file(zipFilePath, content);
      }
    }
  }

  await addFilesToZip(dir);

  // Generate final zip
  return await newZip.generateAsync({ type: "uint8array" });
}
