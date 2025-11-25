/**
 * Natural file name comparison with numeric sorting support.
 *
 * Numeric compare: Treats digit runs (like 123) as numbers when comparing strings,
 * so "7__" comes before "19__".
 *
 * @example
 * const files = [
 *   "7__table-of-contents.md",
 *   "19__the-timeless-way.md",
 *   "35__the-quality-without-a-name.md",
 *   "57__being-alive.md"
 * ];
 *
 * files.sort((a, b) => compareFileNames(a, b, { numeric: true }));
 * // -> ["7__table-of-contents.md", "19__the-timeless-way.md", ...]
 */
export function compareFileNames(
  a: string,
  b: string,
  options: { numeric?: boolean } = {},
): number {
  const { numeric = true } = options;

  if (!numeric) {
    return basicLexicographicCompare(a, b);
  }

  return naturalNumericCompare(a, b);
}

/**
 * Simple lexicographic compare, case-insensitive, ASCII only.
 */
function basicLexicographicCompare(a: string, b: string): number {
  const lenA = a.length;
  const lenB = b.length;
  const minLen = Math.min(lenA, lenB);

  for (let i = 0; i < minLen; i++) {
    const ca = a.charCodeAt(i);
    const cb = b.charCodeAt(i);

    const la = toLowerAscii(ca);
    const lb = toLowerAscii(cb);

    if (la !== lb) {
      return la < lb ? -1 : 1;
    }

    // same ignoring case, tie-break by original code
    if (ca !== cb) {
      return ca < cb ? -1 : 1;
    }
  }

  if (lenA === lenB) return 0;
  return lenA < lenB ? -1 : 1;
}

/**
 * Natural "numeric" compare:
 * compares digit runs as numbers, text runs lexicographically (case-insensitive).
 */
function naturalNumericCompare(a: string, b: string): number {
  let ia = 0;
  let ib = 0;
  const lenA = a.length;
  const lenB = b.length;

  while (ia < lenA && ib < lenB) {
    const ca = a.charCodeAt(ia);
    const cb = b.charCodeAt(ib);

    const isDigitA = isAsciiDigit(ca);
    const isDigitB = isAsciiDigit(cb);

    // Both start with a digit: compare the full number run
    if (isDigitA && isDigitB) {
      const [numResult, nextA, nextB] = compareNumberRuns(a, ia, b, ib);
      if (numResult !== 0) {
        return numResult;
      }
      ia = nextA;
      ib = nextB;
      continue;
    }

    // Otherwise compare characters (case-insensitive)
    const la = toLowerAscii(ca);
    const lb = toLowerAscii(cb);

    if (la !== lb) {
      return la < lb ? -1 : 1;
    }

    // same ignoring case, tie-break by original code
    if (ca !== cb) {
      return ca < cb ? -1 : 1;
    }

    ia++;
    ib++;
  }

  // One is a prefix of the other
  if (ia === lenA && ib === lenB) return 0;
  return ia === lenA ? -1 : 1;
}

function isAsciiDigit(code: number): boolean {
  return code >= 48 && code <= 57; // '0'..'9'
}

function toLowerAscii(code: number): number {
  // 'A'..'Z' -> 'a'..'z'
  if (code >= 65 && code <= 90) {
    return code + 32;
  }
  return code;
}

/**
 * Compare digit runs starting at positions ia and ib.
 *
 * Returns [result, nextIndexA, nextIndexB]
 * where result is -1/0/1 like a normal comparator.
 */
function compareNumberRuns(
  a: string,
  ia: number,
  b: string,
  ib: number,
): [number, number, number] {
  const lenA = a.length;
  const lenB = b.length;

  const startA = ia;
  const startB = ib;

  while (ia < lenA && isAsciiDigit(a.charCodeAt(ia))) ia++;
  while (ib < lenB && isAsciiDigit(b.charCodeAt(ib))) ib++;

  const numA = a.slice(startA, ia);
  const numB = b.slice(startB, ib);

  // Strip leading zeros for numeric comparison
  const cleanA = numA.replace(/^0+/, "");
  const cleanB = numB.replace(/^0+/, "");

  // If all zeros, treat as "0"
  const normA = cleanA.length === 0 ? "0" : cleanA;
  const normB = cleanB.length === 0 ? "0" : cleanB;

  // First, compare by digit count (length) -> avoids big integer parsing
  if (normA.length !== normB.length) {
    return [normA.length < normB.length ? -1 : 1, ia, ib];
  }

  // Same length: lexicographic compare of the digit strings
  if (normA !== normB) {
    return [normA < normB ? -1 : 1, ia, ib];
  }

  // Numbers are equal; shorter original (more leading zeros) comes first
  if (numA.length !== numB.length) {
    return [numA.length < numB.length ? -1 : 1, ia, ib];
  }

  return [0, ia, ib];
}
