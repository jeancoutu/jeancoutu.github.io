import type { Action } from "svelte/action";

export interface LongPressOptions {
  onLongPress: () => void;
  duration?: number;
  moveThreshold?: number;
}

// Fires onLongPress after `duration`ms of pointer-down, cancelled if the
// pointer moves more than `moveThreshold`px before then.
export const longpress: Action<HTMLElement, LongPressOptions> = (node, options) => {
  let opts = options;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let startX = 0;
  let startY = 0;

  function clear() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function onPointerDown(event: PointerEvent) {
    startX = event.clientX;
    startY = event.clientY;
    timer = setTimeout(() => {
      timer = null;
      opts.onLongPress();
    }, opts.duration ?? 500);
  }

  function onPointerMove(event: PointerEvent) {
    if (timer === null) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    const threshold = opts.moveThreshold ?? 10;
    if (dx * dx + dy * dy > threshold * threshold) clear();
  }

  node.addEventListener("pointerdown", onPointerDown);
  node.addEventListener("pointermove", onPointerMove);
  node.addEventListener("pointerup", clear);
  node.addEventListener("pointercancel", clear);

  return {
    update(newOptions) {
      opts = newOptions;
    },
    destroy() {
      clear();
      node.removeEventListener("pointerdown", onPointerDown);
      node.removeEventListener("pointermove", onPointerMove);
      node.removeEventListener("pointerup", clear);
      node.removeEventListener("pointercancel", clear);
    },
  };
};
