/**
 * Format milliseconds to human-readable time string
 */
export function formatTime(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(2)}ms`;
  }
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(2)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toFixed(2)}s`;
}

/**
 * Format bytes to human-readable size string
 */
export function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === undefined) {
    return "N/A";
  }
  if (bytes === 0) {
    return "0 B";
  }
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / k ** i).toFixed(2)} ${sizes[i]}`;
}

/**
 * Format bytes with sign for deltas (handles negative values)
 */
export function formatBytesSigned(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "N/A";
  const sign = bytes < 0 ? "-" : "";
  const abs = Math.abs(bytes);
  if (abs === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(abs) / Math.log(k));
  return `${sign}${(abs / k ** i).toFixed(2)} ${sizes[i]}`;
}

/**
 * Format memory (bytes) to human-readable size string (alias for formatBytes)
 * @deprecated Use formatBytes instead
 */
export function formatMemory(bytes: number | undefined): string {
  if (bytes === undefined) return "N/A";
  return formatBytes(bytes);
}

/**
 * Format pages per second rate
 */
export function formatRate(pagesPerSec: number): string {
  return `${pagesPerSec.toFixed(2)} pages/sec`;
}

/**
 * Format a number with precision
 */
export function formatNumber(num: number, precision = 2): string {
  return num.toFixed(precision);
}

/**
 * Format a complete BatchReport with human-readable values
 */
export function formatBatchReport(report: any): string {
  const lines: string[] = [];

  lines.push(`Engine: ${report.engine}`);
  lines.push(`Pages: ${report.pages_rendered}/${report.pages_requested}`);
  lines.push("");

  // Show timing breakdown with real-world UX phases
  lines.push("Performance Breakdown:");
  if (report.total_load_ms !== undefined) {
    lines.push(
      `  Load Time:      ${formatTime(report.total_load_ms).padStart(10)} (parsing page structure)`,
    );
  }
  if (report.total_render_ms !== undefined) {
    lines.push(
      `  Render Time:    ${formatTime(report.total_render_ms).padStart(10)} (engine painting pixels)`,
    );
  }
  if (report.total_composite_ms !== undefined) {
    lines.push(
      `  Composite Time: ${formatTime(report.total_composite_ms).padStart(10)} (browser GPU/display)`,
    );
  }
  if (report.total_ux_ms !== undefined) {
    lines.push(
      `  Total UX Time:  ${formatTime(report.total_ux_ms).padStart(10)} (real user experience)`,
    );
  }

  // Calculate percentages
  if (report.total_ux_ms > 0) {
    const loadPct = ((report.total_load_ms / report.total_ux_ms) * 100).toFixed(
      1,
    );
    const renderPct = (
      (report.total_render_ms / report.total_ux_ms) *
      100
    ).toFixed(1);
    const compositePct = (
      (report.total_composite_ms / report.total_ux_ms) *
      100
    ).toFixed(1);
    lines.push("");
    lines.push("Time Distribution:");
    lines.push(`  Load:      ${loadPct}%`);
    lines.push(`  Render:    ${renderPct}%`);
    lines.push(`  Composite: ${compositePct}%`);
  }

  lines.push("");
  lines.push(`Throughput: ${formatRate(report.pages_per_sec)}`);
  lines.push("");

  lines.push("Memory Usage:");
  lines.push(
    `  Canvas (estimated): ${formatBytesSigned(report.canvas_estimated_delta_bytes)}`,
  );

  if (report.ua_delta_total_bytes !== null) {
    lines.push(
      `  UA Memory Delta: ${formatBytesSigned(report.ua_delta_total_bytes)}`,
    );
  }

  if (
    report.memory_before?.js_heap_bytes !== null &&
    report.memory_after?.js_heap_bytes !== null
  ) {
    const heapDelta =
      report.memory_after.js_heap_bytes - report.memory_before.js_heap_bytes;
    lines.push(`  JS Heap Delta: ${formatBytesSigned(heapDelta)}`);
  }

  lines.push("");

  if (report.memory_before?.ua) {
    lines.push("Memory Before:");
    lines.push(`  Total: ${formatBytes(report.memory_before.ua.total_bytes)}`);
    if (report.memory_before.ua.canvas_bytes !== null) {
      lines.push(
        `  Canvas: ${formatBytes(report.memory_before.ua.canvas_bytes)}`,
      );
    }
    if (report.memory_before.ua.js_bytes !== null) {
      lines.push(
        `  JavaScript: ${formatBytes(report.memory_before.ua.js_bytes)}`,
      );
    }
    if (report.memory_before.ua.wasm_bytes !== null) {
      lines.push(`  WASM: ${formatBytes(report.memory_before.ua.wasm_bytes)}`);
    }
    lines.push("");
  }

  if (report.memory_after?.ua) {
    lines.push("Memory After:");
    lines.push(`  Total: ${formatBytes(report.memory_after.ua.total_bytes)}`);
    if (report.memory_after.ua.canvas_bytes !== null) {
      lines.push(
        `  Canvas: ${formatBytes(report.memory_after.ua.canvas_bytes)}`,
      );
    }
    if (report.memory_after.ua.js_bytes !== null) {
      lines.push(
        `  JavaScript: ${formatBytes(report.memory_after.ua.js_bytes)}`,
      );
    }
    if (report.memory_after.ua.wasm_bytes !== null) {
      lines.push(`  WASM: ${formatBytes(report.memory_after.ua.wasm_bytes)}`);
    }
    lines.push("");
  }

  if (report.per_page && report.per_page.length > 0) {
    lines.push("Per-Page Details:");
    for (const page of report.per_page) {
      if (page.composite_ms !== undefined) {
        // New format with composite timing
        lines.push(
          `  Page ${page.page_index0 + 1}: ${formatTime(page.total_ux_ms)} (load: ${formatTime(page.load_ms)}, render: ${formatTime(page.render_ms)}, composite: ${formatTime(page.composite_ms)})`,
        );
      } else if (page.load_ms !== undefined) {
        // Old format without composite
        const total = page.load_ms + page.render_ms;
        lines.push(
          `  Page ${page.page_index0 + 1}: ${formatTime(total)} (load: ${formatTime(page.load_ms)}, render: ${formatTime(page.render_ms)})`,
        );
      } else {
        // Fallback for very old reports
        lines.push(
          `  Page ${page.page_index0 + 1}: ${formatTime(page.render_ms)}`,
        );
      }
    }
  }

  return lines.join("\n");
}
