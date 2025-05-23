import { createWriteStream } from "fs";
import path from "path";
import { promisify } from "util";
import fs from "fs/promises";
import { pipeline } from "stream/promises";
import yauzl from "yauzl";

const openZip = promisify<string, yauzl.Options, yauzl.ZipFile>(yauzl.open);

export async function extractZip(
	zipPath: string,
	targetDir: string,
): Promise<void> {
	const zipfile = await openZip(zipPath, { lazyEntries: true });

	// Create a single event handler that can be reused
	const nextEntry = () => {
		return new Promise<yauzl.Entry | null>((resolve, reject) => {
			const onEntry = (entry: yauzl.Entry) => {
				cleanup();
				resolve(entry);
			};

			const onEnd = () => {
				cleanup();
				resolve(null);
			};

			const onError = (err: Error) => {
				cleanup();
				reject(err);
			};

			const cleanup = () => {
				zipfile.removeListener("entry", onEntry);
				zipfile.removeListener("end", onEnd);
				zipfile.removeListener("error", onError);
			};

			zipfile.on("entry", onEntry);
			zipfile.on("end", onEnd);
			zipfile.on("error", onError);
			zipfile.readEntry();
		});
	};

	const openReadStream = (entry: yauzl.Entry) =>
		new Promise<NodeJS.ReadableStream>((resolve, reject) => {
			zipfile.openReadStream(entry, (err, stream) => {
				if (err) reject(err);
				else resolve(stream);
			});
		});

	try {
		let entry: yauzl.Entry | null;
		while ((entry = await nextEntry()) !== null) {
			const fullPath = path.join(targetDir, entry.fileName);
			const directory = path.dirname(fullPath);

			// Create directory if it doesn't exist
			await fs.mkdir(directory, { recursive: true });

			if (!entry.fileName.endsWith("/")) {
				const readStream = await openReadStream(entry);
				const writeStream = createWriteStream(fullPath);
				await pipeline(readStream, writeStream);
			}
		}
	} finally {
		zipfile.close();
	}
}
