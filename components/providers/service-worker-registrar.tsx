"use client";

import { useEffect } from "react";

const SERVICE_WORKER_PATH = "/sw.js";

function canRegisterServiceWorker() {
  if (!("serviceWorker" in navigator)) return false;
  if (window.location.protocol === "https:") return true;
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!canRegisterServiceWorker()) return;

    void navigator.serviceWorker.register(SERVICE_WORKER_PATH).catch((error: unknown) => {
      if (process.env.NODE_ENV !== "production") {
        console.warn("Failed to register service worker", error);
      }
    });
  }, []);

  return null;
}
