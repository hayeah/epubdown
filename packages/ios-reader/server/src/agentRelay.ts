import { createServer, type Socket } from "node:net";
import { parseMessage, serializeMessage, type AgentMessage } from "./protocol.ts";

export class AgentRelay {
  private appSocket: Socket | null = null;
  private clientSockets = new Set<Socket>();
  /** Maps request ID → client socket that sent it */
  private pendingRequests = new Map<string, Socket>();
  private server: ReturnType<typeof createServer> | null = null;

  constructor(private port: number) {}

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = createServer((socket) => this.handleConnection(socket));
      this.server.listen(this.port, () => {
        console.log(`[agent-relay] tcp://localhost:${this.port}`);
        resolve();
      });
    });
  }

  stop(): void {
    for (const socket of this.clientSockets) socket.destroy();
    this.appSocket?.destroy();
    this.server?.close();
  }

  private handleConnection(socket: Socket): void {
    const addr = `${socket.remoteAddress}:${socket.remotePort}`;
    let buffer = "";
    let isApp = false;

    // Initially treat as client
    this.clientSockets.add(socket);
    console.log(`[agent-relay] new connection from ${addr}`);

    socket.on("data", (data) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      // Keep the last incomplete line in the buffer
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const msg = parseMessage(trimmed);
          this.routeMessage(msg, socket, () => {
            isApp = true;
          });
        } catch (err) {
          console.error(`[agent-relay] bad JSON from ${addr}:`, trimmed);
        }
      }
    });

    socket.on("close", () => {
      console.log(`[agent-relay] disconnected: ${addr}${isApp ? " (app)" : ""}`);
      this.clientSockets.delete(socket);
      if (isApp) {
        this.appSocket = null;
        // Notify all clients that the app disconnected
        const errMsg = serializeMessage({
          id: "",
          type: "error",
          message: "App disconnected",
        });
        for (const client of this.clientSockets) {
          client.write(errMsg + "\n");
        }
      }
      // Clean up pending requests from this socket
      for (const [id, s] of this.pendingRequests) {
        if (s === socket) this.pendingRequests.delete(id);
      }
    });

    socket.on("error", (err) => {
      console.error(`[agent-relay] socket error ${addr}:`, err.message);
    });
  }

  private routeMessage(msg: AgentMessage, sender: Socket, markAsApp: () => void): void {
    // App registration
    if (msg.type === "register" && "role" in msg && msg.role === "app") {
      if (this.appSocket && this.appSocket !== sender) {
        console.log("[agent-relay] replacing existing app connection");
        this.appSocket.destroy();
      }
      this.clientSockets.delete(sender);
      this.appSocket = sender;
      markAsApp();
      console.log("[agent-relay] app registered");
      return;
    }

    // If sender is the app, route response/event to client(s)
    if (sender === this.appSocket) {
      this.routeFromApp(msg);
      return;
    }

    // Sender is a client — forward request to app
    this.routeFromClient(msg, sender);
  }

  private routeFromClient(msg: AgentMessage, client: Socket): void {
    if (!this.appSocket) {
      const errMsg = serializeMessage({
        id: "id" in msg ? (msg.id as string) : "",
        type: "error",
        message: "No app connected",
      });
      client.write(errMsg + "\n");
      return;
    }

    // Track which client sent this request
    if ("id" in msg && typeof msg.id === "string") {
      this.pendingRequests.set(msg.id, client);
    }

    // Forward to app
    this.appSocket.write(serializeMessage(msg) + "\n");
  }

  private routeFromApp(msg: AgentMessage): void {
    // If response has an ID, route to the specific client
    if ("id" in msg && typeof msg.id === "string" && msg.id) {
      const client = this.pendingRequests.get(msg.id);
      if (client) {
        client.write(serializeMessage(msg) + "\n");
        this.pendingRequests.delete(msg.id);
        return;
      }
    }

    // Events (no id) broadcast to all clients
    if (msg.type === "event") {
      const line = serializeMessage(msg) + "\n";
      for (const client of this.clientSockets) {
        client.write(line);
      }
      return;
    }
  }
}
