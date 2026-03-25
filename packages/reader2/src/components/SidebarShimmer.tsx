import { useEffect, useRef } from "react";

interface SidebarShimmerProps {
  className?: string;
}

export const SidebarShimmer = ({ className }: SidebarShimmerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let animId: number;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const FRAME_INTERVAL = 250; // 4fps — plenty for slow-drifting gradients
    let lastFrame = 0;

    const draw = (t: number) => {
      animId = requestAnimationFrame(draw);
      if (t - lastFrame < FRAME_INTERVAL) return;
      lastFrame = t;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Two slow-drifting radial gradients that blend together
      const cx1 = w * (0.3 + 0.2 * Math.sin(t * 0.0003));
      const cy1 = h * (0.2 + 0.3 * Math.sin(t * 0.0002 + 1));
      const r1 = Math.max(w, h) * 0.6;
      const g1 = ctx.createRadialGradient(cx1, cy1, 0, cx1, cy1, r1);
      g1.addColorStop(0, "rgba(251, 146, 60, 0.07)"); // orange-400
      g1.addColorStop(0.5, "rgba(253, 186, 116, 0.03)"); // orange-300
      g1.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, w, h);

      const cx2 = w * (0.7 + 0.2 * Math.cos(t * 0.00025 + 2));
      const cy2 = h * (0.7 + 0.2 * Math.cos(t * 0.00035));
      const r2 = Math.max(w, h) * 0.5;
      const g2 = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, r2);
      g2.addColorStop(0, "rgba(234, 88, 12, 0.05)"); // orange-600
      g2.addColorStop(0.4, "rgba(251, 146, 60, 0.02)");
      g2.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, w, h);
    };
    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className ?? "absolute inset-0 w-full h-full pointer-events-none"}
      aria-hidden
    />
  );
};
