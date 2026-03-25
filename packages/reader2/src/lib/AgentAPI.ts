// Agent API for controlling ASCII matrix animations via browser eval

export interface AnimHandle {
  /** Start/resume the animation from current position */
  start(): void;
  /** Pause the animation loop */
  pause(): void;
  /** Stop and reset to frame 0 */
  reset(): void;
  /** Whether currently paused */
  paused(): boolean;
  /** Scrub to a specific elapsed time (ms within one cycle). Pauses automatically. */
  scrub(elapsed: number): void;
  /** Render a single frame at current or given elapsed time, returns render duration in ms */
  renderOnce(elapsed?: number): number;
  /** Get current animation state */
  state(): { elapsed: number; fortuneIdx: number; cols: number; rows: number; cycleTotal: number };
}

interface EpubAgentAPI {
  /** The active animation handle (set by whichever component mounts) */
  anim: AnimHandle | null;
  navigate(path: string): void;
  route(): string;
}

declare global {
  interface Window {
    __epub: EpubAgentAPI;
  }
}

export function registerAgentAPI(): void {
  (window as any).__epub = {
    anim: null,

    navigate(path: string) {
      window.location.pathname = path;
    },

    route() {
      return window.location.pathname;
    },
  } satisfies EpubAgentAPI;
}
