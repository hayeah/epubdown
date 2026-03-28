import { connect, type Socket } from "node:net";
import { generateID, parseMessage, serializeMessage, type AgentRequest, type AgentResponse } from "./protocol.ts";

/**
 * Short-lived TCP client for sending one request to the agent relay
 * and receiving the response.
 */
export class AgentClient {
  private socket: Socket | null = null;

  constructor(
    private host: string = "localhost",
    private port: number = 9876,
  ) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = connect({ host: this.host, port: this.port }, () => resolve());
      this.socket.on("error", reject);
    });
  }

  async send(request: Omit<AgentRequest, "id">): Promise<AgentResponse> {
    if (!this.socket) throw new Error("Not connected");

    const id = generateID();
    const msg = { ...request, id } as AgentRequest;

    return new Promise((resolve, reject) => {
      let buffer = "";

      const onData = (data: Buffer) => {
        buffer += data.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const resp = parseMessage(trimmed) as AgentResponse;
            if ("id" in resp && resp.id === id) {
              this.socket!.off("data", onData);
              resolve(resp);
            }
          } catch {
            // Skip malformed lines
          }
        }
      };

      this.socket!.on("data", onData);
      this.socket!.on("error", reject);
      this.socket!.write(serializeMessage(msg) + "\n");
    });
  }

  disconnect(): void {
    this.socket?.destroy();
    this.socket = null;
  }

  /** Send a request and disconnect. Returns the response. */
  async request(req: Omit<AgentRequest, "id">): Promise<AgentResponse> {
    await this.connect();
    try {
      return await this.send(req);
    } finally {
      this.disconnect();
    }
  }
}
