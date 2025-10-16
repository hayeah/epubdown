/**
 * Utilities for handling text selection and extracting context
 */

/**
 * Retrieves a text-based context around a user's selected text in the DOM.
 */

export interface SelectionContext {
  beforeContext: string;
  selectedText: string;
  afterContext: string;
}

/**
 * Extracts text context around a selection within a container element.
 *
 * This class creates ranges from the container root to the selection start/end,
 * clones the DOM fragments, strips non-content elements (scripts, styles, etc.),
 * and normalizes whitespace to produce clean before/after context strings.
 *
 * The word limit is split roughly evenly between before and after context,
 * with rebalancing if one side has fewer words available than allocated.
 */
class SelectionContextExtractor {
  private readonly selection: Selection;
  private readonly baseRange: Range;
  private readonly root: Element;
  private readonly wordLimit: number;

  constructor(selection: Selection, container?: Element, wordLimit = 400) {
    if (!selection || selection.rangeCount === 0) {
      throw new Error("getSelectionContext: no selection range found");
    }
    this.selection = selection;
    this.baseRange = selection.getRangeAt(0);
    this.wordLimit = Math.max(0, wordLimit | 0);
    this.root = this.resolveRoot(container);
  }

  extract(): SelectionContext {
    const selected = this.normalize(this.selection.toString());

    const before = this.extractBefore();
    const after = this.extractAfter();

    const { before: clippedBefore, after: clippedAfter } =
      this.fitToWordLimit(before, after, this.wordLimit);

    return {
      beforeContext: clippedBefore,
      selectedText: selected,
      afterContext: clippedAfter,
    };
  }

  private resolveRoot(container?: Element): Element {
    const startIn = (el: Element) => el.contains(this.baseRange.startContainer);
    const endIn = (el: Element) => el.contains(this.baseRange.endContainer);

    if (container) {
      if (!startIn(container) || !endIn(container)) {
        throw new Error(
          "getSelectionContext: selection must be inside the provided container",
        );
      }
      return container;
    }

    // Heuristic: prefer article/main/section ancestors; fall back to body
    const anchorEl =
      this.baseRange.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? (this.baseRange.commonAncestorContainer as Element)
        : (this.baseRange.commonAncestorContainer.parentElement ?? document.body);

    const articley =
      anchorEl.closest?.('article, main, section, [role="article"]') ?? null;

    return (articley as Element) || document.body;
  }

  private extractBefore(): string {
    const r = document.createRange();
    r.setStart(this.root, 0);
    r.setEnd(this.baseRange.startContainer, this.baseRange.startOffset);
    return this.extractRangeText(r);
  }

  private extractAfter(): string {
    const r = document.createRange();
    r.setStart(this.baseRange.endContainer, this.baseRange.endOffset);
    r.setEnd(this.root, this.root.childNodes.length);
    return this.extractRangeText(r);
  }

  // Use cloneContents to strip unwanted nodes, then normalize whitespace
  private extractRangeText(r: Range): string {
    const frag = r.cloneContents();
    // Remove non-content elements commonly present in documents
    try {
      frag.querySelectorAll?.("script, style, noscript, iframe, svg, canvas")
        .forEach((el) => el.remove());
    } catch {
      // querySelectorAll may not exist in very old environments; ignore
    }
    const txt = frag.textContent ?? "";
    return this.normalize(txt);
  }

  private normalize(s: string): string {
    return s
      .replace(/\u00A0/g, " ")     // nbsp -> space
      .replace(/\s+/g, " ")        // collapse whitespace
      .trim();
  }

  private fitToWordLimit(beforeText: string, afterText: string, limit: number) {
    if (limit <= 0) {
      return { before: "", after: "" };
    }

    const bWords = beforeText ? beforeText.split(/\s+/) : [];
    const aWords = afterText ? afterText.split(/\s+/) : [];

    let desiredBefore = Math.ceil(limit / 2);
    let desiredAfter = Math.floor(limit / 2);

    let takeBefore = Math.min(bWords.length, desiredBefore);
    let takeAfter = Math.min(aWords.length, desiredAfter);

    // Rebalance leftover to whichever side still has words; prefer forward (after) first
    let leftover = limit - (takeBefore + takeAfter);
    while (leftover > 0 && takeAfter < aWords.length) {
      takeAfter++;
      leftover--;
    }
    while (leftover > 0 && takeBefore < bWords.length) {
      takeBefore++;
      leftover--;
    }

    const beforeSlice = bWords.slice(Math.max(0, bWords.length - takeBefore));
    const afterSlice = aWords.slice(0, takeAfter);

    const beforeTruncated = takeBefore < bWords.length;
    const afterTruncated = takeAfter < aWords.length;

    const before = (beforeTruncated ? "... " : "") + beforeSlice.join(" ");
    const after = afterSlice.join(" ") + (afterTruncated ? " ..." : "");

    return { before, after };
  }
}

export function getSelectionContext(
  selection: Selection,
  container?: Element,
  wordLimit = 400,
): SelectionContext {
  const extractor = new SelectionContextExtractor(selection, container, wordLimit);
  return extractor.extract();
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);

  // try {
  //   await navigator.clipboard.writeText(text);
  // } catch (err) {
  //   // Fallback for older browsers
  //   const textArea = document.createElement("textarea");
  //   textArea.value = text;
  //   textArea.style.position = "fixed";
  //   textArea.style.left = "-999999px";
  //   document.body.appendChild(textArea);
  //   textArea.select();
  //   document.execCommand("copy");
  //   document.body.removeChild(textArea);
  // }
}
