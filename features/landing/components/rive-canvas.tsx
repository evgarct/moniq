"use client";

import { useEffect, useRef } from "react";
import { Fit, Layout, useRive } from "@rive-app/react-canvas";

import type { BrandSceneName } from "./brand-scene";
import styles from "./brand.module.css";

const layout = new Layout({ fit: Fit.Contain });

export default function RiveCanvas({ scene, visible, onReady }: {
  scene: BrandSceneName;
  visible: boolean;
  onReady: (ready: boolean) => void;
}) {
  const layer = useRef<HTMLSpanElement>(null);
  const { rive, RiveComponent } = useRive({
    src: "/brand/" + scene + ".riv",
    stateMachine: "Brand",
    autoplay: false,
    autoBind: scene === "forecast",
    layout,
    onLoadError: () => onReady(false),
  });

  useEffect(() => {
    if (!rive) return;
    if (visible) {
      rive.play();
      onReady(true);
    } else {
      rive.pause();
    }
  }, [rive, visible, onReady]);

  useEffect(() => {
    if (scene !== "forecast" || !rive || !visible) return;

    const frame = layer.current?.closest("figure");
    const scroller = frame?.closest("main");
    const reveal = rive.viewModelInstance?.number("reveal");
    if (!frame || !scroller || !reveal) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const viewport = scroller.getBoundingClientRect();
      const bounds = frame.getBoundingClientRect();
      const progress = (viewport.bottom - bounds.top) / (viewport.height * 0.69 + bounds.height * 0.12);
      reveal.value = Math.max(0, Math.min(100, progress * 100));
    };

    function schedule() {
      if (!raf) raf = requestAnimationFrame(update);
    }

    update();
    scroller.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(raf);
      scroller.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [rive, scene, visible]);

  return (
    <span className={styles.rive} ref={layer}>
      <RiveComponent />
    </span>
  );
}
