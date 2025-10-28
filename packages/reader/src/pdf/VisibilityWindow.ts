export type OnVisibleChange = (visible: number[]) => void;

export function makeVisibilityTracker(onChange: OnVisibleChange) {
  const visible = new Set<number>();
  let lastKey = "";

  const io = new IntersectionObserver(
    (entries) => {
      let mutated = false;
      for (const e of entries) {
        const idx = Number((e.target as HTMLElement).dataset.index);
        if (Number.isNaN(idx)) continue;
        if (
          e.isIntersecting
            ? !visible.has(idx) && (visible.add(idx), true)
            : visible.delete(idx)
        )
          mutated = true;
      }
      if (!mutated) return;
      const sorted = [...visible].sort((a, b) => a - b);
      const key = sorted.join(",");
      if (key === lastKey) return;
      lastKey = key;
      onChange(sorted);
    },
    { rootMargin: "200px 0px 200px 0px", threshold: 0 },
  );

  return {
    observe(el: HTMLElement) {
      io.observe(el);
    },
    unobserve(el: HTMLElement) {
      io.unobserve(el);
    },
    disconnect() {
      visible.clear();
      lastKey = "";
      io.disconnect();
    },
  };
}
