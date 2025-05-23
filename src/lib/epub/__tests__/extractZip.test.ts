import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import { extractZip } from "../extractZip";

describe("extractZip", () => {
	const testDir = path.join(process.cwd(), "test/fixtures/extract-test");

	beforeEach(async () => {
		await fs.rm(testDir, { recursive: true, force: true });
		await fs.mkdir(testDir, { recursive: true });
	});

	afterEach(async () => {
		await fs.rm(testDir, { recursive: true, force: true });
	});

	it("should extract zip contents to directory", async () => {
		const zipPath = path.join(process.cwd(), "test/fixtures/test.epub");
		await extractZip(zipPath, testDir);

		// Check if the directory exists and has content
		const stats = await fs.stat(testDir);
		expect(stats.isDirectory()).toBe(true);

		// List contents
		const contents = await fs.readdir(testDir);
		expect(contents.length).toBeGreaterThan(0);
	});
});
