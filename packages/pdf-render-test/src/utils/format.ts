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

  // Show timing breakdown
  if (
    report.total_load_ms !== undefined &&
    report.total_render_ms !== undefined
  ) {
    lines.push(`Load Time: ${formatTime(report.total_load_ms)}`);
    lines.push(`Render Time: ${formatTime(report.total_render_ms)}`);
    lines.push(`Total Time: ${formatTime(report.total_ms)}`);
  } else {
    // Fallback for old reports
    lines.push(`Render Time: ${formatTime(report.total_render_ms)}`);
  }

  lines.push(`Render Rate: ${formatRate(report.pages_per_sec)}`);
  lines.push("");

  lines.push("Memory Usage:");
  lines.push(
    `  Canvas (estimated): ${formatBytes(report.canvas_estimated_delta_bytes)}`,
  );

  if (report.ua_delta_total_bytes !== null) {
    lines.push(
      `  UA Memory Delta: ${formatBytes(report.ua_delta_total_bytes)}`,
    );
  }

  if (
    report.memory_before?.js_heap_bytes !== null &&
    report.memory_after?.js_heap_bytes !== null
  ) {
    const heapDelta =
      report.memory_after.js_heap_bytes - report.memory_before.js_heap_bytes;
    lines.push(`  JS Heap Delta: ${formatBytes(heapDelta)}`);
  }

  lines.push("");

  if (report.memory_before?.ua) {
    lines.push("Memory Before:");
    lines.push(`  Total: ${formatBytes(report.memory_before.ua.total)}`);
    if (report.memory_before.ua.canvas) {
      lines.push(`  Canvas: ${formatBytes(report.memory_before.ua.canvas)}`);
    }
    if (report.memory_before.ua.js) {
      lines.push(`  JavaScript: ${formatBytes(report.memory_before.ua.js)}`);
    }
    lines.push("");
  }

  if (report.memory_after?.ua) {
    lines.push("Memory After:");
    lines.push(`  Total: ${formatBytes(report.memory_after.ua.total)}`);
    if (report.memory_after.ua.canvas) {
      lines.push(`  Canvas: ${formatBytes(report.memory_after.ua.canvas)}`);
    }
    if (report.memory_after.ua.js) {
      lines.push(`  JavaScript: ${formatBytes(report.memory_after.ua.js)}`);
    }
    lines.push("");
  }

  if (report.per_page && report.per_page.length > 0) {
    lines.push("Per-Page Details:");
    for (const page of report.per_page) {
      if (page.load_ms !== undefined) {
        const total = page.load_ms + page.render_ms;
        lines.push(
          `  Page ${page.page_index0 + 1}: ${formatTime(total)} (load: ${formatTime(page.load_ms)}, render: ${formatTime(page.render_ms)})`,
        );
      } else {
        // Fallback for old reports
        lines.push(
          `  Page ${page.page_index0 + 1}: ${formatTime(page.render_ms)}`,
        );
      }
    }
  }

  return lines.join("\n");
}
