"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type ViewportScrollRegionProps = {
  children: React.ReactNode;
  className?: string;
  bottomOffset?: number;
  minHeight?: number;
  overflow?: boolean;
};

export function ViewportScrollRegion({
  children,
  className,
  bottomOffset = 16,
  minHeight = 180,
  overflow = true,
}: ViewportScrollRegionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const [maxHeight, setMaxHeight] = useState<number | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const recompute = () => {
      const rect = element.getBoundingClientRect();
      const available = window.innerHeight - rect.top - bottomOffset;
      setMaxHeight(Math.max(minHeight, Math.floor(available)));
    };

    const scheduleRecompute = () => {
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        recompute();
      });
    };

    scheduleRecompute();

    const observer = new ResizeObserver(scheduleRecompute);
    observer.observe(element);
    if (element.parentElement) observer.observe(element.parentElement);

    window.addEventListener("resize", scheduleRecompute);
    window.addEventListener("scroll", scheduleRecompute, true);

    return () => {
      window.removeEventListener("resize", scheduleRecompute);
      window.removeEventListener("scroll", scheduleRecompute, true);
      observer.disconnect();
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [bottomOffset, minHeight]);

  return (
    <div
      ref={containerRef}
      className={cn("min-h-0", overflow && "overflow-y-auto overscroll-contain", className)}
      style={maxHeight ? { maxHeight: `${maxHeight}px` } : undefined}
    >
      {children}
    </div>
  );
}
