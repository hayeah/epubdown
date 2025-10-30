import React, { useEffect, useRef } from "react";
import { makeAutoObservable } from "mobx";
import { observer } from "mobx-react-lite";

// ============================================================================
// MobX Store
// ============================================================================

class SliderStore {
  // Configuration
  maxValue = 500;
  viewportHeight = 600;

  // Current state
  currentValue = 1;
  hoverValue: number | null = null;
  isDragging = false;

  // UI controls
  snapEnabled = true;
  showBookmarks = false;
  fineAdjustMode = false;

  // Bookmarks (sample data)
  bookmarks = new Set<number>([1, 50, 125, 250, 375, 500]);

  constructor() {
    makeAutoObservable(this);
  }

  setValue(value: number) {
    this.currentValue = Math.max(1, Math.min(this.maxValue, Math.round(value)));
  }

  setMaxValue(n: number) {
    this.maxValue = Math.max(1, n);
    if (this.currentValue > this.maxValue) {
      this.currentValue = this.maxValue;
    }
  }

  setHoverValue(value: number | null) {
    this.hoverValue = value;
  }

  setDragging(dragging: boolean) {
    this.isDragging = dragging;
  }

  toggleSnap() {
    this.snapEnabled = !this.snapEnabled;
  }

  toggleBookmarks() {
    this.showBookmarks = !this.showBookmarks;
  }

  toggleFineAdjust() {
    this.fineAdjustMode = !this.fineAdjustMode;
  }

  addBookmark(value: number) {
    this.bookmarks.add(value);
  }

  removeBookmark(value: number) {
    this.bookmarks.delete(value);
  }

  // Calculate tick density based on maxValue and viewport height
  tickDensity() {
    const N = this.maxValue;
    const targetSpacing = 48; // pixels between major ticks

    // Find optimal major interval from 5/10 family
    const candidates = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

    let bestM: number = candidates[0] ?? 5;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const M of candidates) {
      if (M > N) continue;
      const numMajors = Math.ceil(N / M);
      const spacing = this.viewportHeight / numMajors;
      const score = Math.abs(spacing - targetSpacing);

      if (score < bestScore) {
        bestScore = score;
        bestM = M;
      }
    }

    const majorInterval: number = bestM;
    const minorInterval: number = majorInterval / 5;
    const numMajors = Math.ceil(N / majorInterval);
    const majorSpacing = this.viewportHeight / numMajors;
    const minorSpacing = majorSpacing / 5;

    return {
      majorInterval,
      minorInterval,
      numMajors,
      majorSpacing,
      minorSpacing,
      snapThreshold: Math.min(8, majorSpacing / 4),
    };
  }

  // Snap value to nearest major tick if within threshold
  snapValue(value: number): number {
    if (!this.snapEnabled) return value;

    const { majorInterval, snapThreshold, majorSpacing } = this.tickDensity();
    if (!majorInterval) return value;
    const nearestMajor = Math.round(value / majorInterval) * majorInterval;

    // Calculate pixel distance
    const pixelPerValue = this.viewportHeight / this.maxValue;
    const pixelDistance = Math.abs((value - nearestMajor) * pixelPerValue);

    if (pixelDistance <= snapThreshold) {
      return Math.min(nearestMajor, this.maxValue);
    }

    return value;
  }

  adjustValue(delta: number) {
    const { minorInterval } = this.tickDensity();
    const step = this.fineAdjustMode ? 1 : (minorInterval ?? 1);
    this.setValue(this.currentValue + delta * step);
  }
}

// ============================================================================
// Subcomponents
// ============================================================================

const Header = observer(({ store }: { store: SliderStore }) => {
  const [inputValue, setInputValue] = React.useState(String(store.maxValue));
  const [error, setError] = React.useState("");

  const handleMaxValueChange = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number.parseInt(inputValue, 10);
    if (isNaN(n) || n < 1) {
      setError("Please enter a number >= 1");
      return;
    }
    if (n > 10000) {
      setError("Maximum value is 10000");
      return;
    }
    setError("");
    store.setMaxValue(n);
  };

  return (
    <header className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-10">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Vertical Radio Dial Slider
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Current value:{" "}
              <span className="font-mono font-semibold">
                {store.currentValue}
              </span>{" "}
              / {store.maxValue}
            </p>
          </div>

          <form
            onSubmit={handleMaxValueChange}
            className="flex items-center gap-3"
          >
            <label className="text-sm text-gray-700">Max value (N):</label>
            <input
              type="number"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-24 px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
              max="10000"
            />
            <button
              type="submit"
              className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition"
            >
              Set
            </button>
          </form>
        </div>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>
    </header>
  );
});

const Toolbar = observer(({ store }: { store: SliderStore }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 space-y-2">
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={store.snapEnabled}
          onChange={() => store.toggleSnap()}
          className="rounded"
        />
        <span>Snap to major ticks</span>
      </label>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={store.fineAdjustMode}
          onChange={() => store.toggleFineAdjust()}
          className="rounded"
        />
        <span>Fine adjust (1-step)</span>
      </label>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={store.showBookmarks}
          onChange={() => store.toggleBookmarks()}
          className="rounded"
        />
        <span>Show bookmarks</span>
      </label>
    </div>
  );
});

const ValueTooltip = ({ value, y }: { value: number; y: number }) => {
  return (
    <div
      className="fixed bg-gray-900 text-white px-3 py-1.5 rounded text-sm font-mono pointer-events-none z-30"
      style={{
        right: "280px",
        top: `${y - 16}px`,
      }}
    >
      {value}
    </div>
  );
};

const Hairline = ({ y }: { y: number }) => {
  return (
    <div
      className="fixed right-0 bg-blue-500 pointer-events-none z-20"
      style={{
        top: `${y}px`,
        height: "1px",
        width: "240px",
      }}
    />
  );
};

const TickMark = ({
  value,
  y,
  isMajor,
  label,
  isBookmarked,
  onClick,
}: {
  value: number;
  y: number;
  isMajor: boolean;
  label?: string;
  isBookmarked: boolean;
  onClick?: () => void;
}) => {
  return (
    <div
      className="absolute right-0 -translate-y-1/2"
      style={{ top: `${y}px` }}
    >
      <div className="flex items-center justify-end gap-2">
        {label && (
          <span
            className="text-xs text-gray-700 font-mono cursor-pointer hover:text-gray-900"
            onClick={onClick}
          >
            {label}
          </span>
        )}
        <div className="flex items-center">
          {isBookmarked && (
            <div className="w-2 h-2 bg-amber-500 rounded-full mr-1" />
          )}
          <div
            className={`bg-gray-400 ${isMajor ? "h-0.5 w-4" : "h-px w-2"}`}
          />
        </div>
      </div>
    </div>
  );
};

const Handle = observer(
  ({
    store,
    y,
    onMouseDown,
  }: {
    store: SliderStore;
    y: number;
    onMouseDown: (e: React.MouseEvent) => void;
  }) => {
    const isBookmarked = store.bookmarks.has(store.currentValue);

    return (
      <>
        {/* Red position indicator line */}
        <div
          className="fixed right-0 bg-red-500 pointer-events-none z-20"
          style={{
            top: `${y - 1}px`,
            height: "2px",
            width: "80px",
            right: "0px",
          }}
        />

        {/* Bracket-style handle sitting over the ruler */}
        <div
          className="fixed right-0 cursor-grab active:cursor-grabbing z-30"
          style={{
            top: `${y - 16}px`,
            right: "0px",
          }}
          onMouseDown={onMouseDown}
        >
          <div
            className="relative flex items-center justify-center"
            style={{ width: "80px" }}
          >
            {/* Vertical bracket design - left bracket */}
            <div
              className={`w-1 h-8 rounded-sm transition-colors ${
                store.isDragging ? "bg-gray-700" : "bg-gray-500"
              }`}
            />

            {/* Top connector */}
            <div
              className={`absolute top-0 left-0 w-full h-1 rounded-sm transition-colors ${
                store.isDragging ? "bg-gray-700" : "bg-gray-500"
              }`}
            />

            {/* Bottom connector */}
            <div
              className={`absolute bottom-0 left-0 w-full h-1 rounded-sm transition-colors ${
                store.isDragging ? "bg-gray-700" : "bg-gray-500"
              }`}
            />

            {/* Center gap for content */}
            <div className="flex-1" />

            {/* Right bracket */}
            <div
              className={`w-1 h-8 rounded-sm transition-colors ${
                store.isDragging ? "bg-gray-700" : "bg-gray-500"
              }`}
            />

            {/* Bookmark indicator */}
            {isBookmarked && (
              <div className="absolute -top-2 -right-2 w-3 h-3 bg-amber-500 rounded-full border-2 border-white" />
            )}
          </div>
        </div>
      </>
    );
  },
);

const Ruler = observer(({ store }: { store: SliderStore }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerTop, setContainerTop] = React.useState(0);

  useEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setContainerTop(rect.top);
      store.viewportHeight = rect.height;
    }
  }, [store]);

  const { majorInterval, minorInterval, majorSpacing, minorSpacing } =
    store.tickDensity();

  const valueToY = (value: number): number => {
    return (
      containerTop + (value - 1) * (store.viewportHeight / (store.maxValue - 1))
    );
  };

  const yToValue = (y: number): number => {
    const relativeY = y - containerTop;
    const ratio = relativeY / store.viewportHeight;
    return 1 + ratio * (store.maxValue - 1);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    store.setDragging(true);
    const handleValue = (clientY: number) => {
      const rawValue = yToValue(clientY);
      const clampedValue = Math.max(1, Math.min(store.maxValue, rawValue));
      const snappedValue = store.snapValue(clampedValue);
      store.setValue(snappedValue);
      store.setHoverValue(store.currentValue);
    };

    handleValue(e.clientY);

    const handleMouseMove = (e: MouseEvent) => {
      handleValue(e.clientY);
    };

    const handleMouseUp = () => {
      store.setDragging(false);
      store.setHoverValue(null);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (store.isDragging) return;
    const value = yToValue(e.clientY);
    const clampedValue = Math.max(1, Math.min(store.maxValue, value));
    store.setHoverValue(Math.round(clampedValue));
  };

  const handleMouseLeave = () => {
    if (!store.isDragging) {
      store.setHoverValue(null);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 1 : -1;
    store.adjustValue(delta);
  };

  const handleTickClick = (value: number) => {
    store.setValue(value);
  };

  // Generate ticks
  const ticks: Array<{
    value: number;
    y: number;
    isMajor: boolean;
    label?: string;
  }> = [];

  const safeMinorInterval = minorInterval ?? 1;
  const safeMajorInterval = majorInterval ?? 1;

  // Start at 1 and always include it as a major tick
  ticks.push({
    value: 1,
    y: valueToY(1) - containerTop,
    isMajor: true,
    label: "1",
  });

  // Generate remaining ticks starting from the first minor interval
  // We need to find the first tick value after 1 that aligns with the minor grid
  const firstMinorTick = safeMinorInterval;

  for (
    let value = firstMinorTick;
    value <= store.maxValue;
    value += safeMinorInterval
  ) {
    const isMajor = value % safeMajorInterval === 0;
    const y = valueToY(value);
    const label = isMajor ? String(value) : undefined;
    ticks.push({ value, y: y - containerTop, isMajor, label });
  }

  // Always include the max value if it's not already included
  const lastTickValue = ticks[ticks.length - 1]?.value;
  if (lastTickValue !== store.maxValue) {
    ticks.push({
      value: store.maxValue,
      y: valueToY(store.maxValue) - containerTop,
      isMajor: true,
      label: String(store.maxValue),
    });
  }

  const currentY = valueToY(store.currentValue);
  const hoverY = store.hoverValue !== null ? valueToY(store.hoverValue) : null;

  return (
    <div
      ref={containerRef}
      className="fixed top-8 bottom-8 right-0 w-64 select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
      style={{ cursor: store.isDragging ? "grabbing" : "crosshair" }}
    >
      {/* Background track */}
      <div className="absolute top-0 bottom-0 right-8 w-px bg-gray-200" />

      {/* Ticks and labels */}
      <div className="absolute inset-0">
        {ticks.map((tick, i) => (
          <TickMark
            key={i}
            value={tick.value}
            y={tick.y}
            isMajor={tick.isMajor}
            label={tick.label}
            isBookmarked={
              store.showBookmarks && store.bookmarks.has(tick.value)
            }
            onClick={() => tick.label && handleTickClick(tick.value)}
          />
        ))}
      </div>

      {/* Hover hairline */}
      {hoverY !== null && <Hairline y={hoverY} />}

      {/* Hover tooltip */}
      {hoverY !== null && store.hoverValue !== null && (
        <ValueTooltip value={store.hoverValue} y={hoverY} />
      )}

      {/* Handle (includes red position indicator) */}
      <Handle store={store} y={currentY} onMouseDown={handleMouseDown} />
    </div>
  );
});

const ContentArea = observer(({ store }: { store: SliderStore }) => {
  const [inputValue, setInputValue] = React.useState(String(store.maxValue));
  const [error, setError] = React.useState("");

  const handleMaxValueChange = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number.parseInt(inputValue, 10);
    if (isNaN(n) || n < 1) {
      setError("Please enter a number >= 1");
      return;
    }
    if (n > 10000) {
      setError("Maximum value is 10000");
      return;
    }
    setError("");
    store.setMaxValue(n);
  };

  return (
    <div className="ml-8 mr-80 py-8">
      <div className="max-w-3xl">
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Vertical Radio Dial Slider
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Current value:{" "}
                <span className="font-mono font-semibold">
                  {store.currentValue}
                </span>{" "}
                / {store.maxValue}
              </p>
            </div>

            <form
              onSubmit={handleMaxValueChange}
              className="flex items-center gap-3"
            >
              <label className="text-sm text-gray-700">Max value (N):</label>
              <input
                type="number"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="w-24 px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
                max="10000"
              />
              <button
                type="submit"
                className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition"
              >
                Set
              </button>
            </form>
          </div>
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

          <div className="flex gap-4 mt-4 pb-6 border-b border-gray-200">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={store.snapEnabled}
                onChange={() => store.toggleSnap()}
                className="rounded"
              />
              <span>Snap to major ticks</span>
            </label>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={store.fineAdjustMode}
                onChange={() => store.toggleFineAdjust()}
                className="rounded"
              />
              <span>Fine adjust (1-step)</span>
            </label>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={store.showBookmarks}
                onChange={() => store.toggleBookmarks()}
                className="rounded"
              />
              <span>Show bookmarks</span>
            </label>
          </div>

          <h2 className="text-2xl font-semibold text-gray-900 mb-4 mt-6">
            Page {store.currentValue}
          </h2>
          <div className="prose prose-sm text-gray-700 space-y-4">
            <p>
              This is a demonstration of a vertical "radio dial" slider with
              coarse and fine control. The slider is positioned on the right
              side of the screen, providing an intuitive way to navigate through{" "}
              {store.maxValue} pages.
            </p>
            <h3 className="text-lg font-semibold text-gray-900 mt-6">
              How to use:
            </h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Drag the handle</strong> or{" "}
                <strong>click anywhere on the track</strong> to jump to a
                position
              </li>
              <li>
                <strong>Hover</strong> over the track to see a preview hairline
                and value
              </li>
              <li>
                <strong>Scroll wheel</strong> over the track for fine
                adjustments
              </li>
              <li>
                <strong>Click major tick labels</strong> to jump to those
                positions
              </li>
              <li>
                <strong>Toggle snap</strong> in the toolbar to enable/disable
                magnetic major ticks
              </li>
              <li>
                <strong>Fine adjust mode</strong> changes scroll wheel to 1-step
                increments
              </li>
            </ul>
            <h3 className="text-lg font-semibold text-gray-900 mt-6">
              Tick density:
            </h3>
            <p>
              The slider automatically calculates optimal tick spacing based on
              the maximum value and viewport height. Major ticks use a 5/10
              family interval (5, 10, 25, 50, 100, 250, 500, etc.), and each
              major tick is divided into 5 minor ticks.
            </p>
            <p className="text-sm text-gray-600 mt-4">
              Current configuration: {store.maxValue} pages, major interval of{" "}
              {store.tickDensity().majorInterval}, minor interval of{" "}
              {store.tickDensity().minorInterval}.
            </p>

            <div className="mt-8 p-4 bg-blue-50 rounded border border-blue-200">
              <h4 className="font-semibold text-blue-900 mb-2">
                Sample bookmarks
              </h4>
              <div className="flex flex-wrap gap-2">
                {Array.from(store.bookmarks)
                  .sort((a, b) => a - b)
                  .map((bookmark) => (
                    <span
                      key={bookmark}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-900 text-xs rounded cursor-pointer hover:bg-amber-200"
                      onClick={() => store.setValue(bookmark)}
                    >
                      <span className="w-2 h-2 bg-amber-500 rounded-full" />
                      Page {bookmark}
                    </span>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

// ============================================================================
// Main Component
// ============================================================================

const SliderPrototype = observer(() => {
  const storeRef = useRef<SliderStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = new SliderStore();
  }

  const store = storeRef.current;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case "ArrowUp":
        case "ArrowLeft":
          e.preventDefault();
          store.adjustValue(-1);
          break;
        case "ArrowDown":
        case "ArrowRight":
          e.preventDefault();
          store.adjustValue(1);
          break;
        case "PageUp":
          e.preventDefault();
          store.adjustValue(-5);
          break;
        case "PageDown":
          e.preventDefault();
          store.adjustValue(5);
          break;
        case "Home":
          e.preventDefault();
          store.setValue(1);
          break;
        case "End":
          e.preventDefault();
          store.setValue(store.maxValue);
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [store]);

  return (
    <div className="min-h-screen bg-gray-50">
      <ContentArea store={store} />
      <Ruler store={store} />
    </div>
  );
});

export default SliderPrototype;
