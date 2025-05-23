import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { EPubParser } from "../EPubParser";
import { compareOrUpdateFixture } from "./testUtils";

describe("EPubParser", () => {
	describe("load()", () => {
		it("should throw error if file does not exist", async () => {
			await expect(EPubParser.load("nonexistent.epub")).rejects.toThrow(
				"File not found",
			);
		});

		it("should throw error if file is not a valid epub", async () => {
			await expect(
				EPubParser.load("test/fixtures/invalid.epub"),
			).rejects.toThrow("Invalid epub file");
		});
	});

	describe("metadata()", () => {
		it("should parse metadata from alice.epub", async () => {
			const parser = await EPubParser.load("test/fixtures/alice.epub");
			const metadata = await parser.metadata();

			expect(metadata).toEqual({
				title: "Alice's Adventures in Wonderland",
				author: "Lewis Carroll",
				language: "en-US",
				publisher: undefined,
				description: undefined,
				rights: "Public domain in the USA.",
				identifiers: ["edu.nyu.itp.future-of-publishing.alice-in-wonderland"],
				date: undefined,
			});
		});
	});

	describe("manifest()", () => {
		it("should parse manifest from alice.epub", async () => {
			const parser = await EPubParser.load("test/fixtures/alice.epub");
			const manifest = await parser.manifest();
			compareOrUpdateFixture("test/fixtures/alice-manifest.json", manifest);
		});
	});

	describe("spine()", () => {
		it("should parse spine from alice.epub", async () => {
			const parser = await EPubParser.load("test/fixtures/alice.epub");
			const spine = await parser.spine();
			compareOrUpdateFixture("test/fixtures/alice-spine.json", spine);
		});
	});

	describe("toc()", () => {
		it("should parse table of contents from alice.epub", async () => {
			const parser = await EPubParser.load("test/fixtures/alice.epub");
			const toc = await parser.toc();
			compareOrUpdateFixture("test/fixtures/alice-toc.json", toc);
		});
	});

	describe("chapters()", () => {
		it("should parse chapters from alice.epub", async () => {
			const parser = await EPubParser.load("test/fixtures/alice.epub");
			const chapters = await parser.chapters();
			compareOrUpdateFixture("test/fixtures/alice-chapters.json", chapters);
		});
	});
});
