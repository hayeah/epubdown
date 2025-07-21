export async function loadEpub(url: string): Promise<File> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch EPUB: ${response.statusText}`);
    }

    const blob = await response.blob();
    const filename = url.split("/").pop() || "book.epub";
    return new File([blob], filename, { type: "application/epub+zip" });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Timeout loading EPUB");
    }
    throw error;
  }
}
