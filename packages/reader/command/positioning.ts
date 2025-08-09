// Position menu relative to a selection rect
export function positionForSelection(
  selRect: DOMRect,
  menuEl: HTMLElement,
  gap = 10,
  stick: "auto" | "above" | "below" = "auto",
) {
  const menuRect = menuEl.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 10;

  const canAbove = selRect.top - gap - menuRect.height >= margin;
  const canLeft = selRect.left - gap - menuRect.width >= margin;

  let x: number;
  let y: number;

  // Try to position above first to avoid obscuring text
  if (canAbove) {
    // Position above the selection
    x = selRect.left + selRect.width / 2 - menuRect.width / 2;
    x = Math.max(margin, Math.min(x, vw - menuRect.width - margin));
    y = selRect.top - gap - menuRect.height;
  } else if (canLeft) {
    // If no space above, try to position to the left
    x = selRect.left - gap - menuRect.width;
    y = selRect.top + selRect.height / 2 - menuRect.height / 2;
    y = Math.max(margin, Math.min(y, vh - menuRect.height - margin));
  } else {
    // Fallback: position below if no other option
    x = selRect.left + selRect.width / 2 - menuRect.width / 2;
    x = Math.max(margin, Math.min(x, vw - menuRect.width - margin));
    y = selRect.bottom + gap;
    y = Math.max(margin, Math.min(y, vh - menuRect.height - margin));
  }

  return { x, y };
}

// Calculate menu position
export function calculatePosition(
  anchorEl: HTMLElement | null,
  menuEl: HTMLElement | null,
  preferredPos?: { x: number; y: number },
): { x: number; y: number } {
  if (!menuEl) return { x: 0, y: 0 };

  const menuRect = menuEl.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  if (preferredPos) {
    // Use provided position (e.g., cursor position)
    let x = preferredPos.x;
    let y = preferredPos.y;

    // Adjust if menu would overflow
    if (x + menuRect.width > viewportWidth - 10) {
      x = viewportWidth - menuRect.width - 10;
    }
    if (y + menuRect.height > viewportHeight - 10) {
      y = viewportHeight - menuRect.height - 10;
    }

    return { x: Math.max(10, x), y: Math.max(10, y) };
  }

  if (anchorEl) {
    const anchorRect = anchorEl.getBoundingClientRect();
    let x = anchorRect.left;
    let y = anchorRect.bottom + 4;

    // Try positioning: below, above, right, left
    if (y + menuRect.height > viewportHeight - 10) {
      // Try above
      y = anchorRect.top - menuRect.height - 4;
    }
    if (y < 10) {
      // Try to the right
      x = anchorRect.right + 4;
      y = anchorRect.top;
    }
    if (x + menuRect.width > viewportWidth - 10) {
      // Try to the left
      x = anchorRect.left - menuRect.width - 4;
    }

    return {
      x: Math.max(10, Math.min(x, viewportWidth - menuRect.width - 10)),
      y: Math.max(10, Math.min(y, viewportHeight - menuRect.height - 10)),
    };
  }

  // Center on screen (palette mode)
  return {
    x: (viewportWidth - menuRect.width) / 2,
    y: Math.min(100, (viewportHeight - menuRect.height) / 3),
  };
}
