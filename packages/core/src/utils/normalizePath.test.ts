import { describe, expect, it } from "vitest";
import { normalizePath } from "./normalizePath";

describe("normalizePath", () => {
  it("should handle already absolute paths", () => {
    expect(normalizePath("/base", "/absolute/path")).toBe("/absolute/path");
    expect(normalizePath("base", "/absolute/path")).toBe("/absolute/path");
  });

  it("should handle fragment-only hrefs", () => {
    expect(normalizePath("/base", "#fragment")).toBe("#fragment");
    expect(normalizePath("/base/dir", "#section")).toBe("#section");
  });

  it("should handle external URLs", () => {
    expect(normalizePath("/base", "http://example.com")).toBe(
      "http://example.com",
    );
    expect(normalizePath("/base", "https://example.com")).toBe(
      "https://example.com",
    );
    expect(normalizePath("/base", "ftp://example.com")).toBe(
      "ftp://example.com",
    );
  });

  it("should resolve relative paths", () => {
    expect(normalizePath("/OEBPS/Text", "chapter1.xhtml")).toBe(
      "/OEBPS/Text/chapter1.xhtml",
    );
    expect(normalizePath("OEBPS/Text", "chapter1.xhtml")).toBe(
      "/OEBPS/Text/chapter1.xhtml",
    );
    expect(normalizePath("/OEBPS", "Text/chapter1.xhtml")).toBe(
      "/OEBPS/Text/chapter1.xhtml",
    );
  });

  it("should handle . and .. segments", () => {
    expect(normalizePath("/OEBPS/Text", "./chapter1.xhtml")).toBe(
      "/OEBPS/Text/chapter1.xhtml",
    );
    expect(normalizePath("/OEBPS/Text", "../Images/cover.jpg")).toBe(
      "/OEBPS/Images/cover.jpg",
    );
    expect(normalizePath("/OEBPS/Text/Part1", "../../Images/cover.jpg")).toBe(
      "/OEBPS/Images/cover.jpg",
    );
  });

  it("should handle complex relative paths", () => {
    expect(normalizePath("/OEBPS/Text", "../Images/../Styles/style.css")).toBe(
      "/OEBPS/Styles/style.css",
    );
    expect(normalizePath("/OEBPS/Text", "./././chapter1.xhtml")).toBe(
      "/OEBPS/Text/chapter1.xhtml",
    );
  });

  it("should handle root-level paths", () => {
    expect(normalizePath("/", "file.xhtml")).toBe("/file.xhtml");
    expect(normalizePath("", "file.xhtml")).toBe("/file.xhtml");
  });

  it("should handle paths with fragments", () => {
    expect(normalizePath("/OEBPS/Text", "chapter1.xhtml#section1")).toBe(
      "/OEBPS/Text/chapter1.xhtml#section1",
    );
    expect(normalizePath("/OEBPS/Text", "../Images/fig.svg#id")).toBe(
      "/OEBPS/Images/fig.svg#id",
    );
  });

  it("should handle excessive .. segments gracefully", () => {
    expect(normalizePath("/OEBPS", "../../../file.xhtml")).toBe("/file.xhtml");
    expect(normalizePath("/", "../file.xhtml")).toBe("/file.xhtml");
  });
});
