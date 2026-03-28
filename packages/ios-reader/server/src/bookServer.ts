import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Server } from "node:http";

interface BookEntry {
  filename: string;
  size: number;
}

export class BookServer {
  private server: Server | null = null;

  constructor(
    private dir: string,
    private port: number,
  ) {}

  async start(): Promise<void> {
    this.server = createServer((req, res) => this.handleRequest(req, res));
    await new Promise<void>((resolve) => {
      this.server!.listen(this.port, () => {
        console.log(`[book-server] http://localhost:${this.port} serving ${this.dir}`);
        resolve();
      });
    });
  }

  stop(): void {
    this.server?.close();
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", `http://localhost:${this.port}`);
    const pathname = url.pathname;

    try {
      if (pathname === "/index.json") {
        await this.serveIndex(res);
      } else if (pathname.startsWith("/books/")) {
        const filename = decodeURIComponent(pathname.slice("/books/".length));
        await this.serveBook(filename, res);
      } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
      }
    } catch (err) {
      console.error("[book-server] Error:", err);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal server error");
    }
  }

  private async serveIndex(res: ServerResponse): Promise<void> {
    const entries = await readdir(this.dir);
    const books: BookEntry[] = [];

    for (const entry of entries) {
      if (!entry.endsWith(".epub")) continue;
      const st = await stat(join(this.dir, entry));
      books.push({ filename: entry, size: st.size });
    }

    books.sort((a, b) => a.filename.localeCompare(b.filename));

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(books, null, 2));
  }

  private async serveBook(filename: string, res: ServerResponse): Promise<void> {
    const filepath = join(this.dir, filename);

    // Prevent path traversal
    if (filename.includes("..") || filename.includes("/")) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Invalid filename");
      return;
    }

    try {
      const data = await readFile(filepath);
      res.writeHead(200, {
        "Content-Type": "application/epub+zip",
        "Content-Length": data.length,
      });
      res.end(data);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Book not found");
    }
  }
}
