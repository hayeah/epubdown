import { makeAutoObservable } from "mobx";
import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

class SliderStore {
  currentPage = 1;
  totalPages = 500; // demo: can be 20, 500, etc
  isDragging = false;

  constructor() {
    makeAutoObservable(this);
  }

  setCurrentPage(page: number) {
    this.currentPage = Math.max(1, Math.min(this.totalPages, page));
  }

  setTotalPages(total: number) {
    this.totalPages = total;
    if (this.currentPage > total) {
      this.currentPage = total;
    }
  }

  setIsDragging(dragging: boolean) {
    this.isDragging = dragging;
  }

  // Calculate tick configuration based on total pages
  get tickConfig() {
    const total = this.totalPages;

    // Determine minor tick interval (pages per minor tick)
    // We want ~5 minor ticks per major tick
    // and adjust density for longer books
    let minorInterval: number;
    let majorInterval: number;

    if (total <= 50) {
      minorInterval = 1;
      majorInterval = 5;
    } else if (total <= 100) {
      minorInterval = 2;
      majorInterval = 10;
    } else if (total <= 250) {
      minorInterval = 5;
      majorInterval = 25;
    } else if (total <= 500) {
      minorInterval = 10;
      majorInterval = 50;
    } else if (total <= 1000) {
      minorInterval = 20;
      majorInterval = 100;
    } else {
      minorInterval = 50;
      majorInterval = 250;
    }

    return {
      minorInterval,
      majorInterval,
      minorTicksPerMajor: majorInterval / minorInterval,
    };
  }

  // Snap to nearest major tick
  snapToMajorTick(page: number): number {
    const { majorInterval } = this.tickConfig;
    return Math.round(page / majorInterval) * majorInterval;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tick Component
// ─────────────────────────────────────────────────────────────────────────────

const Tick = ({
  page,
  isMajor,
  label,
}: { page: number; isMajor: boolean; label?: string }) => {
  return (
    <div className="absolute right-0 flex items-center">
      <div
        className={`${isMajor ? "w-6 bg-gray-800" : "w-3 bg-gray-500"} h-px`}
      />
      {label && (
        <span className="ml-2 text-xs text-gray-700 font-mono">{label}</span>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Slider Component
// ─────────────────────────────────────────────────────────────────────────────

const PageSliderInner = observer(({ store }: { store: SliderStore }) => {
  const sliderRef = useRef<HTMLDivElement>(null);
  const { totalPages, currentPage, tickConfig } = store;
  const { minorInterval, majorInterval } = tickConfig;

  // Calculate position percentage
  const position = ((currentPage - 1) / (totalPages - 1)) * 100;

  // Handle drag
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    store.setIsDragging(true);
  };

  useEffect(() => {
    if (!store.isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!sliderRef.current) return;

      const rect = sliderRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const percentage = Math.max(0, Math.min(1, y / rect.height));
      const page = Math.round(percentage * (totalPages - 1)) + 1;

      // Snap to major tick while dragging
      const snappedPage = store.snapToMajorTick(page);
      store.setCurrentPage(snappedPage);
    };

    const handleMouseUp = () => {
      store.setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [store, totalPages]);

  // Generate ticks
  const ticks: { page: number; isMajor: boolean; label?: string }[] = [];

  for (let page = 1; page <= totalPages; page += minorInterval) {
    const isMajor = page % majorInterval === 0;
    const label = isMajor ? String(page) : undefined;
    ticks.push({ page, isMajor, label });
  }

  // Add last page if not already included
  if (totalPages % minorInterval !== 0) {
    ticks.push({ page: totalPages, isMajor: true, label: String(totalPages) });
  }

  return (
    <div className="flex items-start h-screen p-8 bg-gray-50">
      {/* Demo content on left */}
      <div className="flex-1 pr-8">
        <h1 className="text-3xl font-bold mb-4">Page Slider Prototype</h1>
        <div className="bg-white p-6 rounded-lg shadow mb-4">
          <h2 className="text-xl font-semibold mb-2">Current Position</h2>
          <p className="text-5xl font-bold text-blue-600">{currentPage}</p>
          <p className="text-gray-600 mt-2">of {totalPages} pages</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow mb-4">
          <h2 className="text-xl font-semibold mb-2">Tick Configuration</h2>
          <div className="space-y-2 font-mono text-sm">
            <div>
              <span className="text-gray-600">Minor interval:</span>{" "}
              <span className="font-semibold">{minorInterval} pages</span>
            </div>
            <div>
              <span className="text-gray-600">Major interval:</span>{" "}
              <span className="font-semibold">{majorInterval} pages</span>
            </div>
            <div>
              <span className="text-gray-600">Ticks per major:</span>{" "}
              <span className="font-semibold">
                {tickConfig.minorTicksPerMajor}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-2">Demo Controls</h2>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => store.setTotalPages(20)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 mr-2"
            >
              20 pages
            </button>
            <button
              type="button"
              onClick={() => store.setTotalPages(100)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 mr-2"
            >
              100 pages
            </button>
            <button
              type="button"
              onClick={() => store.setTotalPages(250)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 mr-2"
            >
              250 pages
            </button>
            <button
              type="button"
              onClick={() => store.setTotalPages(500)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 mr-2"
            >
              500 pages
            </button>
            <button
              type="button"
              onClick={() => store.setTotalPages(1000)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              1000 pages
            </button>
          </div>
        </div>
      </div>

      {/* Slider on right */}
      <div className="w-32 flex-shrink-0">
        <div
          ref={sliderRef}
          className="relative h-[600px] w-full cursor-pointer select-none"
          onMouseDown={handleMouseDown}
        >
          {/* Track */}
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gray-300 -translate-x-1/2" />

          {/* Ticks */}
          {ticks.map(({ page, isMajor, label }) => {
            const tickPosition = ((page - 1) / (totalPages - 1)) * 100;
            return (
              <div
                key={page}
                className="absolute left-1/2 -translate-x-1/2"
                style={{ top: `${tickPosition}%` }}
              >
                <Tick page={page} isMajor={isMajor} label={label} />
              </div>
            );
          })}

          {/* Current position "hair" */}
          <div
            className="absolute left-0 right-0 h-px bg-red-500 z-10 transition-all"
            style={{
              top: `${position}%`,
              transition: store.isDragging ? "none" : "top 0.2s ease-out",
            }}
          />

          {/* Drag handle */}
          <div
            className="absolute left-1/2 -translate-x-1/2 w-8 h-8 bg-blue-600 rounded-full shadow-lg z-20 cursor-grab active:cursor-grabbing transition-all hover:scale-110"
            style={{
              top: `${position}%`,
              transform: `translateX(-50%) translateY(-50%) ${store.isDragging ? "scale(1.1)" : ""}`,
              transition: store.isDragging
                ? "transform 0.1s"
                : "top 0.2s ease-out, transform 0.1s",
            }}
            onMouseDown={handleMouseDown}
          >
            {/* Inner dot */}
            <div className="absolute inset-2 bg-white rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Public Component
// ─────────────────────────────────────────────────────────────────────────────

export const PageSlider = observer(() => {
  const [store] = useState(() => new SliderStore());

  return <PageSliderInner store={store} />;
});
