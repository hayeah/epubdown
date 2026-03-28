// ── Request types (agent/CLI → app) ──

export interface GetStateRequest {
  id: string;
  type: "get_state";
}

export interface SetRequest {
  id: string;
  type: "set";
  path: string;
  value: unknown;
}

export interface ActionRequest {
  id: string;
  type: "action";
  name: string;
  params?: Record<string, unknown>;
}

export interface ScreenshotRequest {
  id: string;
  type: "screenshot";
}

export interface PresetRequest {
  id: string;
  type: "preset";
  name: string;
}

export type AgentRequest =
  | GetStateRequest
  | SetRequest
  | ActionRequest
  | ScreenshotRequest
  | PresetRequest;

// ── Response types (app → agent/CLI) ──

export interface StateResponse {
  id: string;
  type: "state";
  data: unknown;
}

export interface OkResponse {
  id: string;
  type: "ok";
  data?: unknown;
}

export interface ErrorResponse {
  id: string;
  type: "error";
  message: string;
}

export interface ScreenshotResponse {
  id: string;
  type: "screenshot";
  data: string; // base64 PNG
  format: "png";
  width: number;
  height: number;
}

export type AgentResponse =
  | StateResponse
  | OkResponse
  | ErrorResponse
  | ScreenshotResponse;

// ── Registration (app → relay on connect) ──

export interface RegisterMessage {
  type: "register";
  role: "app";
}

// ── Events (app → agent, unsolicited) ──

export interface StateChangedEvent {
  type: "event";
  name: "state_changed";
  path: string;
  value: unknown;
}

export interface NavigationEvent {
  type: "event";
  name: "navigation";
  screen: string;
  sessionIndex?: number;
}

export type AgentEvent = StateChangedEvent | NavigationEvent;

// ── Union of all messages ──

export type AgentMessage = AgentRequest | AgentResponse | AgentEvent | RegisterMessage;

// ── Helpers ──

export function parseMessage(line: string): AgentMessage {
  return JSON.parse(line) as AgentMessage;
}

export function serializeMessage(msg: AgentMessage): string {
  return JSON.stringify(msg);
}

let nextID = 1;
export function generateID(): string {
  return String(nextID++);
}
