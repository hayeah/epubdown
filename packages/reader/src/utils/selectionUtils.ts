/**
 * Utilities for handling text selection and extracting context
 */

/**
 * Retrieves a text-based context around a user's selected text in the DOM.
 * The context is determined by traversing backwards for the 'before' context
 * and forwards for the 'after' context, following siblings and climbing up
 * the DOM when there are no more siblings at the current level.
 *
 * @param selection - The user's Selection object from the browser
 * @param wordLimit - Maximum total words around the selection (default 400 total, 200 before/after)
 * @returns An object containing the before context, selected text, and after context
 */
export function getSelectionContext(
  selection: Selection,
  wordLimit = 400,
): {
  beforeContext: string;
  selectedText: string;
  afterContext: string;
} {
  const selectedText = selection.toString().trim();
  if (!selectedText) {
    return { beforeContext: "", selectedText: "", afterContext: "" };
  }

  // Get the range
  const range = selection.getRangeAt(0);

  // Calculate how many words to get before and after
  const beforeWords = getTextBefore(range);
  const afterWords = getTextAfter(range);

  // Count words in each context
  const beforeWordCount = countWords(beforeWords);
  const afterWordCount = countWords(afterWords);

  // Determine word limits with dynamic allocation
  let beforeLimit = Math.floor(wordLimit / 2);
  let afterLimit = Math.floor(wordLimit / 2);

  // If we don't have enough words on one side, allocate more to the other
  if (beforeWordCount < beforeLimit) {
    afterLimit += beforeLimit - beforeWordCount;
  } else if (afterWordCount < afterLimit) {
    beforeLimit += afterLimit - afterWordCount;
  }

  // Extract the limited context
  const beforeContext = extractWords(beforeWords, beforeLimit, true);
  const afterContext = extractWords(afterWords, afterLimit, false);

  return {
    beforeContext,
    selectedText,
    afterContext,
  };
}

/**
 * Get all text before the selection in the current container
 */
function getTextBefore(range: Range): string {
  // Find the actual starting point for text extraction
  let startNode = range.startContainer;
  let startOffset = range.startOffset;

  // If the start container is an element, we need to find the actual text node
  if (startNode.nodeType === Node.ELEMENT_NODE) {
    const element = startNode as Element;
    // startOffset refers to the child node index when container is an element
    if (startOffset > 0 && element.childNodes.length > 0) {
      // Get the node just before the selection starts
      const childNode = element.childNodes[startOffset - 1];
      if (childNode && childNode.nodeType === Node.TEXT_NODE) {
        startNode = childNode;
        startOffset = childNode.textContent?.length || 0;
      } else {
        // Find the last text node in this child element
        const textNodes = childNode
          ? getTextNodesInElement(childNode as Element)
          : [];
        const lastTextNode = textNodes[textNodes.length - 1];
        if (textNodes.length > 0 && lastTextNode) {
          startNode = lastTextNode;
          startOffset = startNode.textContent?.length || 0;
        }
      }
    } else {
      // Selection starts at the beginning of the element
      // Find the previous sibling or parent's text
      const walker = createTreeWalker(range.commonAncestorContainer);
      walker.currentNode = element;
      const prevNode = walker.previousNode();
      if (prevNode && prevNode.nodeType === Node.TEXT_NODE) {
        startNode = prevNode;
        startOffset = prevNode.textContent?.length || 0;
      } else {
        // No text before selection
        return "";
      }
    }
  }

  const walker = createTreeWalker(range.commonAncestorContainer);
  walker.currentNode = startNode;

  let text = "";
  const nodesToProcess: Node[] = [];

  // Get text before selection in the start node
  if (startNode.nodeType === Node.TEXT_NODE && startOffset > 0) {
    text = startNode.textContent?.slice(0, startOffset) || "";
  }

  // Collect all text nodes before the selection
  let currentNode = walker.previousNode();
  while (currentNode) {
    if (currentNode.nodeType === Node.TEXT_NODE) {
      nodesToProcess.unshift(currentNode);
    }
    currentNode = walker.previousNode();
  }

  // Add text from collected nodes
  for (const node of nodesToProcess) {
    text = `${node.textContent || ""} ${text}`;
  }

  return text.trim();
}

/**
 * Get all text nodes within an element
 */
function getTextNodesInElement(element: Element): Node[] {
  const textNodes: Node[] = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Node): number {
      return node.textContent?.trim()
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP;
    },
  });

  let node = walker.nextNode();
  while (node) {
    textNodes.push(node);
    node = walker.nextNode();
  }

  return textNodes;
}

/**
 * Get all text after the selection in the current container
 */
function getTextAfter(range: Range): string {
  // Find the actual ending point for text extraction
  let endNode = range.endContainer;
  let endOffset = range.endOffset;

  // If the end container is an element, we need to find the actual text node
  if (endNode.nodeType === Node.ELEMENT_NODE) {
    const element = endNode as Element;
    // endOffset refers to the child node index when container is an element
    if (endOffset < element.childNodes.length) {
      // Get the node where selection ends
      const childNode = element.childNodes[endOffset];
      if (childNode && childNode.nodeType === Node.TEXT_NODE) {
        endNode = childNode;
        endOffset = 0;
      } else {
        // Find the first text node in this child element
        const textNodes = childNode
          ? getTextNodesInElement(childNode as Element)
          : [];
        if (textNodes.length > 0 && textNodes[0]) {
          endNode = textNodes[0];
          endOffset = 0;
        }
      }
    } else {
      // Selection ends at the end of the element
      // Find the next sibling or parent's next text
      const walker = createTreeWalker(range.commonAncestorContainer);
      walker.currentNode = element;
      const nextNode = walker.nextNode();
      if (nextNode && nextNode.nodeType === Node.TEXT_NODE) {
        endNode = nextNode;
        endOffset = 0;
      } else {
        // No text after selection
        return "";
      }
    }
  }

  const walker = createTreeWalker(range.commonAncestorContainer);
  walker.currentNode = endNode;

  let text = "";

  // Get text after selection in the end node
  if (endNode.nodeType === Node.TEXT_NODE) {
    text = endNode.textContent?.slice(endOffset) || "";
  }

  // Collect all text nodes after the selection
  let currentNode = walker.nextNode();
  while (currentNode) {
    if (currentNode.nodeType === Node.TEXT_NODE) {
      text += ` ${currentNode.textContent || ""}`;
    }
    currentNode = walker.nextNode();
  }

  return text.trim();
}

/**
 * Create a TreeWalker for traversing text nodes
 */
function createTreeWalker(root: Node): TreeWalker {
  // Find the nearest element ancestor for the tree walker root
  let element: Element;
  if (root.nodeType === Node.ELEMENT_NODE) {
    element = root as Element;
  } else {
    element = root.parentElement || document.body;
  }

  // Find article or chapter container for better context boundaries
  const article = element.closest(".epub-chapter, article, .chapter-content");
  const walkerRoot = article || element;

  return document.createTreeWalker(walkerRoot, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Node): number {
      const text = node.textContent || "";
      // Skip empty text nodes
      return text.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });
}

/**
 * Count words in a string
 */
function countWords(text: string): number {
  if (!text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

/**
 * Extract a limited number of words from text
 * @param text - The text to extract from
 * @param limit - Maximum number of words
 * @param fromEnd - If true, extract from the end (for before context)
 */
function extractWords(text: string, limit: number, fromEnd: boolean): string {
  const words = text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  if (words.length <= limit) {
    return text.trim();
  }

  if (fromEnd) {
    return words.slice(-limit).join(" ");
  }
  return words.slice(0, limit).join(" ");
}

/**
 * Format the selection with context for clipboard
 */
export function formatSelectionWithContext(
  bookTitle: string,
  context: {
    beforeContext: string;
    selectedText: string;
    afterContext: string;
  },
): string {
  const { beforeContext, selectedText, afterContext } = context;

  // Create the formatted output
  let output = `Book Title: ${bookTitle}\n\n`;
  output += "## Context\n\n";

  // Combine context and wrap at 80 characters
  const fullContext = `${beforeContext} <<${selectedText}>> ${afterContext}`;
  output += `${wrapText(fullContext, 80)}\n\n`;

  output += "## Selection\n\n";
  output += wrapText(selectedText, 80);

  return output;
}

/**
 * Wrap text at specified column width, breaking on word boundaries
 */
function wrapText(text: string, maxWidth: number): string {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (currentLine.length === 0) {
      currentLine = word;
    } else if (currentLine.length + 1 + word.length <= maxWidth) {
      currentLine += ` ${word}`;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines.join("\n");
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
