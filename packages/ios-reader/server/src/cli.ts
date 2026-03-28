#!/usr/bin/env bun

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { writeFile } from "node:fs/promises";
import { BookServer } from "./bookServer.ts";
import { AgentRelay } from "./agentRelay.ts";
import { AgentClient } from "./agentClient.ts";

const DEFAULT_BOOK_DIR = "./epubs";
const DEFAULT_BOOK_PORT = 8765;
const DEFAULT_AGENT_PORT = 9876;

yargs(hideBin(process.argv))
  .scriptName("epubreader-agent")
  .usage("$0 <command> [options]")

  // ── serve ──
  .command(
    "serve",
    "Start book server and agent relay",
    (y) =>
      y
        .option("book-dir", { type: "string", default: DEFAULT_BOOK_DIR, describe: "EPUB directory" })
        .option("book-port", { type: "number", default: DEFAULT_BOOK_PORT, describe: "HTTP port" })
        .option("agent-port", { type: "number", default: DEFAULT_AGENT_PORT, describe: "TCP relay port" }),
    async (argv) => {
      const bookServer = new BookServer(argv.bookDir, argv.bookPort);
      const relay = new AgentRelay(argv.agentPort);
      await bookServer.start();
      await relay.start();

      process.on("SIGINT", () => {
        console.log("\nShutting down...");
        bookServer.stop();
        relay.stop();
        process.exit(0);
      });
    },
  )

  // ── state ──
  .command(
    "state",
    "Get current app state",
    (y) => y.option("port", { type: "number", default: DEFAULT_AGENT_PORT }),
    async (argv) => {
      const client = new AgentClient("localhost", argv.port);
      const resp = await client.request({ type: "get_state" });
      if (resp.type === "state") {
        console.log(JSON.stringify(resp.data, null, 2));
      } else {
        console.error(resp);
        process.exit(1);
      }
    },
  )

  // ── set ──
  .command(
    "set <path> <value>",
    "Set a state property by dot path",
    (y) =>
      y
        .positional("path", { type: "string", demandOption: true })
        .positional("value", { type: "string", demandOption: true })
        .option("port", { type: "number", default: DEFAULT_AGENT_PORT }),
    async (argv) => {
      let value: unknown;
      try {
        value = JSON.parse(argv.value as string);
      } catch {
        value = argv.value;
      }
      const client = new AgentClient("localhost", argv.port);
      const resp = await client.request({ type: "set", path: argv.path as string, value });
      if (resp.type === "error") {
        console.error(resp.message);
        process.exit(1);
      }
      console.log("ok");
    },
  )

  // ── screenshot ──
  .command(
    "screenshot",
    "Capture a screenshot from the app",
    (y) =>
      y
        .option("o", { alias: "output", type: "string", describe: "Output PNG file" })
        .option("port", { type: "number", default: DEFAULT_AGENT_PORT }),
    async (argv) => {
      const client = new AgentClient("localhost", argv.port);
      const resp = await client.request({ type: "screenshot" });
      if (resp.type === "screenshot") {
        const buf = Buffer.from(resp.data, "base64");
        if (argv.o) {
          await writeFile(argv.o, buf);
          console.log(`Saved ${resp.width}x${resp.height} to ${argv.o}`);
        } else {
          process.stdout.write(buf);
        }
      } else {
        console.error(resp);
        process.exit(1);
      }
    },
  )

  // ── action ──
  .command(
    "action <name>",
    "Invoke a named action",
    (y) =>
      y
        .positional("name", { type: "string", demandOption: true })
        .option("port", { type: "number", default: DEFAULT_AGENT_PORT })
        .strict(false),
    async (argv) => {
      // Collect remaining args as params
      const { name, port: _port, _, $0: _$0, ...params } = argv;
      const client = new AgentClient("localhost", argv.port);
      const resp = await client.request({
        type: "action",
        name: name as string,
        params: Object.keys(params).length > 0 ? params : undefined,
      });
      if (resp.type === "error") {
        console.error(resp.message);
        process.exit(1);
      }
      if (resp.type === "ok" && resp.data) {
        console.log(JSON.stringify(resp.data, null, 2));
      } else {
        console.log("ok");
      }
    },
  )

  // ── preset ──
  .command(
    "preset <name>",
    "Load a named state preset",
    (y) =>
      y
        .positional("name", { type: "string", demandOption: true })
        .option("port", { type: "number", default: DEFAULT_AGENT_PORT }),
    async (argv) => {
      const client = new AgentClient("localhost", argv.port);
      const resp = await client.request({ type: "preset", name: argv.name as string });
      if (resp.type === "error") {
        console.error(resp.message);
        process.exit(1);
      }
      console.log("ok");
    },
  )

  // ── raw ──
  .command(
    "raw",
    "Read JSONL from stdin, forward to relay, print responses",
    (y) => y.option("port", { type: "number", default: DEFAULT_AGENT_PORT }),
    async (argv) => {
      const client = new AgentClient("localhost", argv.port);
      await client.connect();

      const { stdin } = process;
      stdin.setEncoding("utf-8");

      for await (const chunk of stdin) {
        const lines = (chunk as string).split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const resp = await client.send(JSON.parse(trimmed));
          console.log(JSON.stringify(resp));
        }
      }

      client.disconnect();
    },
  )

  .demandCommand(1, "Please specify a command")
  .strict()
  .help()
  .parse();
