/**
 * PerfHUD - Performance heads-up display for development
 */

import type { PerfSample } from "../types";

interface PerfHUDProps {
  sample: PerfSample;
}

function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined) return "N/A";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

export function PerfHUD({ sample }: PerfHUDProps) {
  return (
    <div className="perf-hud fixed bottom-4 left-4 bg-black bg-opacity-80 text-white text-xs font-mono p-3 rounded shadow-lg z-50 min-w-[250px]">
      <div className="font-bold mb-2 text-green-400">Performance Stats</div>

      <div className="space-y-1">
        <div className="flex justify-between">
          <span>Engine:</span>
          <span className="font-semibold">{sample.route.toUpperCase()}</span>
        </div>

        {sample.ttfp_ms !== undefined && (
          <div className="flex justify-between">
            <span>TTFP:</span>
            <span>{Math.round(sample.ttfp_ms)}ms</span>
          </div>
        )}

        {sample.lastRender_ms !== undefined && (
          <div className="flex justify-between">
            <span>Last Render:</span>
            <span>{Math.round(sample.lastRender_ms)}ms</span>
          </div>
        )}

        <div className="flex justify-between">
          <span>FPS (2s):</span>
          <span
            className={
              sample.framesLast2s && sample.framesLast2s < 50
                ? "text-yellow-400"
                : "text-green-400"
            }
          >
            {sample.framesLast2s || 0}
          </span>
        </div>

        <div className="flex justify-between">
          <span>Long Tasks (2s):</span>
          <span
            className={
              sample.longTasksLast2s && sample.longTasksLast2s > 5
                ? "text-red-400"
                : ""
            }
          >
            {sample.longTasksLast2s || 0}
          </span>
        </div>

        <div className="flex justify-between">
          <span>Pages Alive:</span>
          <span>{sample.pagesAlive}</span>
        </div>

        <div className="border-t border-gray-600 my-2" />

        <div className="flex justify-between">
          <span>JS Heap:</span>
          <span>{formatBytes(sample.jsHeap_bytes)}</span>
        </div>

        <div className="flex justify-between">
          <span>GPU Est:</span>
          <span>{formatBytes(sample.gpuEst_bytes)}</span>
        </div>

        {sample.wasm_bytes !== undefined && (
          <div className="flex justify-between">
            <span>WASM:</span>
            <span>{formatBytes(sample.wasm_bytes)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
