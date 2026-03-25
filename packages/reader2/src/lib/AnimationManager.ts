/** Global Animation Synchronizer — single rAF loop shared by all animations. */

export type FrameCallback = (t: number) => void;

interface Task {
  callback: FrameCallback;
  interval: number;
  lastFrame: number;
}

class AnimationManager {
  private tasks = new Map<FrameCallback, Task>();
  private animId: number | null = null;

  private run = (t: number) => {
    this.animId = requestAnimationFrame(this.run);
    for (const task of this.tasks.values()) {
      if (t - task.lastFrame < task.interval) continue;
      task.lastFrame = t;
      task.callback(t);
    }
  };

  /** Register a callback to be called every `interval` ms (0 = every frame). */
  register(callback: FrameCallback, interval = 0) {
    this.tasks.set(callback, { callback, interval, lastFrame: 0 });
    if (this.tasks.size === 1) {
      this.animId = requestAnimationFrame(this.run);
    }
  }

  unregister(callback: FrameCallback) {
    this.tasks.delete(callback);
    if (this.tasks.size === 0 && this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }
}

export const animationManager = new AnimationManager();
