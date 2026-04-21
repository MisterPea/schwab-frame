import type { SchwabFrameApi } from "./main/preload";

declare global {
  interface Window {
    schwabFrame: SchwabFrameApi;
  }
}

export {};
