import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ReadableStream } from "node:stream/web";
import type { NextHandleFunction } from "connect";
import type { Plugin } from "vite";

const ROUTE_PATH = "/__epubdown__/download";
const FORWARDED_HEADERS = new Set([
  "content-type",
  "content-length",
  "content-disposition",
  "content-encoding",
  "accept-ranges",
  "last-modified",
]);

export function downloadProxyPlugin(): Plugin {
  return {
    name: "epubdown-download-proxy",
    configureServer(server) {
      server.middlewares.use(createMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(createMiddleware());
    },
  };
}

function createMiddleware(): NextHandleFunction {
  return async (req: IncomingMessage, res: ServerResponse, next) => {
    if (!req.url || !req.url.startsWith(ROUTE_PATH)) {
      next();
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "text/plain");
      res.end("Method not allowed");
      return;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(req.url, "http://localhost");
    } catch (error) {
      console.error("[download-proxy] Failed to parse request url", error);
      res.statusCode = 400;
      res.setHeader("Content-Type", "text/plain");
      res.end("Invalid request URL");
      return;
    }

    const target = parsedUrl.searchParams.get("url");
    if (!target) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "text/plain");
      res.end("Missing url parameter");
      return;
    }

    let upstreamUrl: URL;
    try {
      upstreamUrl = new URL(target);
    } catch {
      res.statusCode = 400;
      res.setHeader("Content-Type", "text/plain");
      res.end("Invalid target URL");
      return;
    }

    if (upstreamUrl.protocol !== "http:" && upstreamUrl.protocol !== "https:") {
      res.statusCode = 400;
      res.setHeader("Content-Type", "text/plain");
      res.end("Unsupported protocol");
      return;
    }

    const controller = new AbortController();
    const abort = () => controller.abort();
    const removeAbortListener = () => {
      if (typeof req.off === "function") {
        req.off("close", abort);
      } else {
        req.removeListener("close", abort);
      }
    };
    req.on("close", abort);

    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(upstreamUrl, {
        method: req.method,
        headers: buildForwardHeaders(req),
        signal: controller.signal,
        redirect: "follow",
      });
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error(
          `[download-proxy] Failed to fetch upstream ${upstreamUrl}`,
          error,
        );
      }
      res.statusCode = 502;
      res.setHeader("Content-Type", "text/plain");
      res.end("Failed to reach upstream server");
      removeAbortListener();
      return;
    }

    res.statusCode = upstreamResponse.status;
    res.statusMessage = upstreamResponse.statusText;
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Proxy-For", upstreamUrl.origin);

    for (const [key, value] of upstreamResponse.headers) {
      if (FORWARDED_HEADERS.has(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    }

    if (req.method === "HEAD" || !upstreamResponse.body) {
      res.end();
      removeAbortListener();
      return;
    }

    try {
      const readable = Readable.fromWeb(
        upstreamResponse.body as unknown as ReadableStream<Uint8Array>,
      );
      await pipeline(readable, res);
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error(
          "[download-proxy] Failed while streaming upstream response",
          error,
        );
      }
      if (!res.headersSent) {
        res.statusCode = 502;
        res.setHeader("Content-Type", "text/plain");
        res.end("Failed to stream upstream response");
      } else {
        res.destroy(error as Error);
      }
    } finally {
      removeAbortListener();
    }
  };
}

function buildForwardHeaders(req: IncomingMessage): Record<string, string> {
  const headers: Record<string, string> = {};
  if (typeof req.headers.range === "string") {
    headers.range = req.headers.range;
  }
  if (typeof req.headers["if-modified-since"] === "string") {
    headers["if-modified-since"] = req.headers["if-modified-since"];
  }
  if (typeof req.headers["if-none-match"] === "string") {
    headers["if-none-match"] = req.headers["if-none-match"];
  }
  return headers;
}
