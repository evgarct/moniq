"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import styles from "./brand.module.css";

const RiveCanvas = dynamic(() => import("./rive-canvas"), { ssr: false });

export type BrandSceneName = "hero" | "forecast" | "login";

export function BrandScene({ scene, className }: { scene: BrandSceneName; className: string }) {
  const frame = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const element = frame.current;
    if (!element || !("IntersectionObserver" in window)) return;
    const target = element;

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
      if (entry.isIntersecting && !preference.matches) setEnabled(true);
    }, { threshold: 0.18 });

    function updatePreference() {
      if (preference.matches) {
        setEnabled(false);
        setReady(false);
      } else {
        observer.unobserve(target);
        observer.observe(target);
      }
    }

    observer.observe(element);
    preference.addEventListener("change", updatePreference);
    return () => {
      observer.disconnect();
      preference.removeEventListener("change", updatePreference);
    };
  }, []);

  return (
    <figure ref={frame} className={className} aria-hidden="true" data-brand-scene={scene} data-motion-ready={ready}>
      <svg className={styles.poster} viewBox="0 0 600 600" preserveAspectRatio="xMidYMid meet">
        <use href={"/brand/" + scene + ".svg#poster"} />
      </svg>
      {enabled && <RiveCanvas scene={scene} visible={visible} onReady={setReady} />}
    </figure>
  );
}
