import JSZip from "jszip";
import type { BlobStore } from "./BlobStore";
import type {
  CollectionDatabase,
  CollectionFile,
  CollectionFileType,
  CollectionMetadata,
} from "./CollectionDatabase";
import { getFileType, parseMarkdownFile } from "../utils/parseMarkdownFile";
import { sha256Bytes } from "../utils/sha256";
import { compareFileNames } from "../utils/compareFileNames";

export interface ProcessedFile {
  filePath: string;
  contentHash: Uint8Array;
  title?: string;
  frontmatter?: string;
  fileType: CollectionFileType;
  content: ArrayBuffer;
}

/**
 * Manages markdown collections: creating, updating, and exporting
 */
export class CollectionManager {
  constructor(
    private readonly db: CollectionDatabase,
    private readonly blobStore: BlobStore,
  ) {}

  /**
   * Get the blob store key for a collection
   */
  private getBlobKey(collectionId: number): string {
    return `collection-${collectionId}`;
  }

  /**
   * Process a file for inclusion in a collection
   */
  private async processFile(file: File): Promise<ProcessedFile | null> {
    const fileType = getFileType(file.name);
    if (fileType === null) {
      return null; // Skip unsupported files
    }

    const arrayBuffer = await file.arrayBuffer();
    const contentHash = await sha256Bytes(arrayBuffer);

    let title: string | undefined;
    let frontmatter: string | undefined;

    if (fileType === "markdown") {
      const text = new TextDecoder().decode(arrayBuffer);
      const parsed = parseMarkdownFile(text);
      title = parsed.title;
      if (parsed.frontmatter) {
        frontmatter = JSON.stringify(parsed.frontmatter);
      }
    }

    return {
      filePath: file.name,
      contentHash,
      title,
      frontmatter,
      fileType,
      content: arrayBuffer,
    };
  }

  /**
   * Create a new collection from files
   */
  async createCollection(
    name: string,
    files: File[],
  ): Promise<CollectionMetadata> {
    // Create the collection record
    const collectionId = await this.db.createCollection(name);

    // Create a new zip
    const zip = new JSZip();

    // Sort files naturally by name before processing
    const sortedFiles = [...files].sort((a, b) =>
      compareFileNames(a.name, b.name),
    );

    // Process and add files
    for (const file of sortedFiles) {
      const processed = await this.processFile(file);
      if (!processed) continue;

      // Add to zip
      zip.file(processed.filePath, processed.content);

      // Add to database
      await this.db.addFile({
        collectionId,
        filePath: processed.filePath,
        contentHash: processed.contentHash,
        title: processed.title,
        frontmatter: processed.frontmatter,
        fileType: processed.fileType,
      });
    }

    // Generate and store the zip blob
    const zipBlob = await zip.generateAsync({ type: "arraybuffer" });
    await this.blobStore.put(this.getBlobKey(collectionId), zipBlob);

    // Return the created collection
    const collection = await this.db.getCollection(collectionId);
    if (!collection) {
      throw new Error("Failed to retrieve created collection");
    }
    return collection;
  }

  /**
   * Add files to an existing collection
   * Skips files that already exist (based on content hash)
   */
  async addFilesToCollection(
    collectionId: number,
    files: File[],
  ): Promise<{ added: number; skipped: number }> {
    // Load the existing zip
    const zipData = await this.blobStore.getBytes(
      this.getBlobKey(collectionId),
    );
    if (!zipData) {
      throw new Error(`Collection ${collectionId} zip not found`);
    }

    const zip = await JSZip.loadAsync(zipData);

    let added = 0;
    let skipped = 0;

    // Sort files naturally by name before processing
    const sortedFiles = [...files].sort((a, b) =>
      compareFileNames(a.name, b.name),
    );

    for (const file of sortedFiles) {
      const processed = await this.processFile(file);
      if (!processed) {
        skipped++;
        continue;
      }

      // Check if file with same hash already exists
      const existing = await this.db.findFileByHash(
        collectionId,
        processed.contentHash,
      );
      if (existing) {
        skipped++;
        continue;
      }

      // Handle filename conflicts by appending number
      let filePath = processed.filePath;
      let counter = 1;
      while (zip.file(filePath) !== null) {
        const ext = filePath.lastIndexOf(".");
        if (ext > 0) {
          filePath = `${processed.filePath.slice(0, ext)}_${counter}${processed.filePath.slice(ext)}`;
        } else {
          filePath = `${processed.filePath}_${counter}`;
        }
        counter++;
      }

      // Add to zip
      zip.file(filePath, processed.content);

      // Add to database
      await this.db.addFile({
        collectionId,
        filePath,
        contentHash: processed.contentHash,
        title: processed.title,
        frontmatter: processed.frontmatter,
        fileType: processed.fileType,
      });

      added++;
    }

    // Re-generate and store the zip
    if (added > 0) {
      const zipBlob = await zip.generateAsync({ type: "arraybuffer" });
      await this.blobStore.put(this.getBlobKey(collectionId), zipBlob);
    }

    return { added, skipped };
  }

  /**
   * Remove a file from a collection
   */
  async removeFileFromCollection(
    collectionId: number,
    filePath: string,
  ): Promise<void> {
    // Load the existing zip
    const zipData = await this.blobStore.getBytes(
      this.getBlobKey(collectionId),
    );
    if (!zipData) {
      throw new Error(`Collection ${collectionId} zip not found`);
    }

    const zip = await JSZip.loadAsync(zipData);

    // Remove from zip
    zip.remove(filePath);

    // Remove from database
    await this.db.removeFile(collectionId, filePath);

    // Re-generate and store the zip
    const zipBlob = await zip.generateAsync({ type: "arraybuffer" });
    await this.blobStore.put(this.getBlobKey(collectionId), zipBlob);
  }

  /**
   * Get a file's content from a collection
   */
  async getFileContent(
    collectionId: number,
    filePath: string,
  ): Promise<Uint8Array | null> {
    const zipData = await this.blobStore.getBytes(
      this.getBlobKey(collectionId),
    );
    if (!zipData) return null;

    const zip = await JSZip.loadAsync(zipData);
    const file = zip.file(filePath);
    if (!file) return null;

    return file.async("uint8array");
  }

  /**
   * Get a file as a data URL (useful for images)
   */
  async getFileDataUrl(
    collectionId: number,
    filePath: string,
  ): Promise<string | null> {
    const content = await this.getFileContent(collectionId, filePath);
    if (!content) return null;

    // Determine MIME type from extension
    const ext = filePath.toLowerCase().split(".").pop() ?? "";
    const mimeTypes: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      svg: "image/svg+xml",
      webp: "image/webp",
      bmp: "image/bmp",
    };
    const mimeType = mimeTypes[ext] ?? "application/octet-stream";

    const blob = new Blob([content as BlobPart], { type: mimeType });
    return URL.createObjectURL(blob);
  }

  /**
   * Export collection as a downloadable zip file
   */
  async exportCollection(collectionId: number): Promise<Blob> {
    const zipData = await this.blobStore.getBytes(
      this.getBlobKey(collectionId),
    );
    if (!zipData) {
      throw new Error(`Collection ${collectionId} zip not found`);
    }
    return new Blob([zipData as BlobPart], { type: "application/zip" });
  }

  /**
   * Delete a collection and its blob
   */
  async deleteCollection(collectionId: number): Promise<void> {
    // Delete from database (files cascade deleted)
    await this.db.deleteCollection(collectionId);

    // Delete blob
    await this.blobStore.delete(this.getBlobKey(collectionId));
  }

  /**
   * Get all files in a collection
   */
  async getFiles(collectionId: number): Promise<CollectionFile[]> {
    return this.db.getFiles(collectionId);
  }

  /**
   * Get only markdown files in a collection
   */
  async getMarkdownFiles(collectionId: number): Promise<CollectionFile[]> {
    return this.db.getMarkdownFiles(collectionId);
  }

  /**
   * Check if collection zip exists
   */
  async hasBlob(collectionId: number): Promise<boolean> {
    const data = await this.blobStore.getBytes(this.getBlobKey(collectionId));
    return data !== null;
  }
}
