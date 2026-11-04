"use client";

import { useEffect } from "react";
import { Fit, Layout, useRive } from "@rive-app/react-canvas";
import type { MotionValue } from "framer-motion";

import type { BrandSceneName } from "./brand-scene";
import styles from "./brand.module.css";

const layout = new Layout({ fit: Fit.Contain });

export default function RiveCanvas({ scene, visible, onReady, progress }: {
  scene: BrandSceneName;
  visible: boolean;
  onReady: (ready: boolean) => void;
  progress?: MotionValue<number>;
}) {
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

    const reveal = rive.viewModelInstance?.number("reveal");
    if (!reveal || !progress) return;
    const update = (value: number) => { reveal.value = value; };
    update(progress.get());
    return progress.on("change", update);
  }, [progress, rive, scene, visible]);

  return (
    <span className={styles.rive}>
      <RiveComponent />
    </span>
  );
}
