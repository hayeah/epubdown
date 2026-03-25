import { useEffect, useRef } from "react";
import { MatrixStreamAnimation } from "../../lib/MatrixStreamAnimation";
import type { Fortune, NoiseMode } from "../../lib/MatrixStreamAnimation";

interface ASCIIMatrixStreamProps {
  fortunes?: Fortune[];
  noiseMode?: NoiseMode;
  className?: string;
  autoPlay?: boolean;
  /** Render a single static frame at this elapsed time (ms). No animation loop. */
  staticTime?: number;
}

export const ASCIIMatrixStream = ({
  fortunes,
  noiseMode,
  className,
  autoPlay,
  staticTime,
}: ASCIIMatrixStreamProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const anim = new MatrixStreamAnimation(canvas, { fortunes, noiseMode });
    anim.renderInitial({ staticTime, autoPlay });
    window.__epub.anim = anim;
    window.addEventListener("resize", anim.handleResize);

    return () => {
      anim.dispose();
      if (window.__epub.anim === anim) window.__epub.anim = null;
      window.removeEventListener("resize", anim.handleResize);
    };
  }, [fortunes, noiseMode]);

  return (
    <canvas
      ref={canvasRef}
      className={className ?? "absolute inset-0 w-full h-full pointer-events-none"}
      aria-hidden
    />
  );
};
