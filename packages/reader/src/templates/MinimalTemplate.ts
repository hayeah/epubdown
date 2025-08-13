// Promise-aware dot-path lookup with correct getter receiver
function isObjectLike(x: unknown): boolean {
  return x !== null && (typeof x === "object" || typeof x === "function");
}

function toTarget(x: unknown): object {
  return isObjectLike(x) ? (x as object) : Object(x); // box primitives
}

async function getPath(
  obj: unknown,
  dotted: string | undefined,
): Promise<unknown> {
  if (!dotted || dotted === "") return obj;
  let cur: unknown = obj;
  let lastTarget: object | null = null;

  for (const raw of dotted.split(".")) {
    const seg = /^[0-9]+$/.test(raw) ? Number(raw) : raw;
    cur = await cur;
    if (cur == null) return undefined;
    const target = toTarget(cur);
    lastTarget = target;
    cur = Reflect.get(target, seg, target);
  }

  // If the final value is a function, call it with proper context
  if (typeof cur === "function" && lastTarget) {
    cur = cur.call(lastTarget);
  }

  return await cur;
}

const MUSTACHE = /{{\s*([^}]+?)\s*}}/g;

// A tiny, safe filter registry
export const filters = {
  upper: (v: unknown) => (v == null ? "" : String(v).toUpperCase()),
  lower: (v: unknown) => (v == null ? "" : String(v).toLowerCase()),
  default: (v: unknown, d = "") => (v == null || v === "" ? d : v),
  h: (s: unknown) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c] || c,
    ),
  json: (v: unknown) => JSON.stringify(v),
  date: (
    v: unknown,
    locale = "en-US",
    style: "short" | "medium" | "long" | "full" = "medium",
  ) => {
    const d = v instanceof Date ? v : new Date(v as string | number);
    try {
      return new Intl.DateTimeFormat(locale, { dateStyle: style }).format(d);
    } catch {
      return Number.isNaN(+d) ? "" : d.toISOString();
    }
  },
  join: (arr: unknown, sep = ", ") =>
    Array.isArray(arr) ? arr.join(sep) : String(arr ?? ""),
  map: async (arr: unknown, path: string) => {
    if (!Array.isArray(arr)) return arr;
    return Promise.all(arr.map((x) => getPath(x, path)));
  },
  if: (v: unknown, t: unknown, f = "") => (v ? t : f),
  padStart: (v: unknown, len: string, ch = " ") =>
    String(v ?? "").padStart(Number(len), ch),
  slice: (v: unknown, start?: string, end?: string) =>
    String(v ?? "").slice(
      start ? Number(start) : undefined,
      end ? Number(end) : undefined,
    ),
};

export type FilterMap = typeof filters;

async function resolveToken(
  expr: string,
  ctx: unknown,
  fx: FilterMap,
): Promise<string> {
  // grammar: path | path |filter[:arg[,arg...]] | filter[:...]
  const parts = expr
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  let val = await getPath(ctx, parts[0]); // dot-path only

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;
    const colonIdx = part.indexOf(":");
    const name =
      colonIdx === -1 ? part.trim() : part.substring(0, colonIdx).trim();
    const argstr = colonIdx === -1 ? "" : part.substring(colonIdx + 1).trim();

    const f = fx[name as keyof FilterMap];
    if (typeof f !== "function") {
      throw new Error(`Unknown filter: ${name}`);
    }
    // Parse comma-separated args, respecting quotes
    const args: string[] = [];
    if (argstr) {
      let current = "";
      let inQuotes = false;
      let quoteChar = "";

      for (let i = 0; i < argstr.length; i++) {
        const char = argstr[i];

        if (!inQuotes && (char === '"' || char === "'")) {
          inQuotes = true;
          quoteChar = char;
          current = ""; // Reset current to not include the quote
        } else if (inQuotes && char === quoteChar) {
          inQuotes = false;
          args.push(current); // Push the quoted content
          current = "";
          quoteChar = "";
        } else if (!inQuotes && char === ",") {
          if (current.trim()) {
            args.push(current.trim());
          }
          current = "";
        } else {
          current += char;
        }
      }

      // Handle any remaining content
      if (current.trim()) {
        args.push(current.trim());
      }
    }
    val = await (f as any)(val, ...args);
  }
  return String(val ?? "");
}

export async function render(
  tpl: string,
  ctx: unknown,
  fx: FilterMap = filters,
): Promise<string> {
  const out: (string | Promise<string>)[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  // Reset regex state
  MUSTACHE.lastIndex = 0;

  while (true) {
    m = MUSTACHE.exec(tpl);
    if (!m) break;
    out.push(tpl.slice(last, m.index));
    out.push(resolveToken(m[1] || "", ctx, fx)); // returns value or Promise
    last = m.index + m[0].length;
  }
  out.push(tpl.slice(last));
  const parts = await Promise.all(out);
  return parts.join("");
}

// Sequential rendering variant (optional - for streaming)
export async function renderSeq(
  tpl: string,
  ctx: unknown,
  fx: FilterMap = filters,
): Promise<string> {
  let last = 0;
  let m: RegExpExecArray | null;
  let out = "";
  MUSTACHE.lastIndex = 0;

  while (true) {
    m = MUSTACHE.exec(tpl);
    if (!m) break;
    out += tpl.slice(last, m.index);
    out += String(await resolveToken(m[1] || "", ctx, fx));
    last = m.index + m[0].length;
  }
  out += tpl.slice(last);
  return out;
}
