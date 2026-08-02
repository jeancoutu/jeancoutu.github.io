// Pointer-based long-press drag primitive. HTML5 drag-and-drop doesn't
// support touch on iOS Safari, so this is built entirely on Pointer Events.
// Decoupled from any business logic: it only reports drag-start /
// drag-over-target / drop, identified by whatever opaque `id` each element
// was registered with.

const LONG_PRESS_MS = 400;
const MOVE_CANCEL_PX = 10;
const EDGE_ZONE_PX = 56;
const MAX_SCROLL_SPEED = 16;

const DROP_TARGET_ATTR = "data-drag-target";
const IGNORE_ATTR = "data-drag-ignore";

const dropTargets = new WeakMap<Element, unknown>();

function resolveTargetAt(x: number, y: number): unknown {
  for (const el of document.elementsFromPoint(x, y)) {
    const host = el.closest(`[${DROP_TARGET_ATTR}]`);
    if (host && dropTargets.has(host)) return dropTargets.get(host);
  }
  return null;
}

/** Marks an element as a valid drop target without making it draggable (e.g. an empty slot). */
export function dropTarget<T>(node: HTMLElement, id: T) {
  dropTargets.set(node, id);
  node.setAttribute(DROP_TARGET_ATTR, "");
  return {
    update(newId: T) {
      dropTargets.set(node, newId);
    },
    destroy() {
      dropTargets.delete(node);
    },
  };
}

export interface LongPressDragParams<T> {
  id: T;
  disabled?: boolean;
  onDragStart?: () => void;
  onDragOver?: (targetId: T | null) => void;
  onDrop?: (targetId: T | null) => void;
}

export function longPressDrag<T>(node: HTMLElement, params: LongPressDragParams<T>) {
  let opts = params;
  dropTargets.set(node, opts.id);
  node.setAttribute(DROP_TARGET_ATTR, "");

  // touch-action is locked in at pointerdown and can't be changed once a
  // gesture is under way, so "none" (used pre-drag-start too) would forfeit
  // native vertical scrolling for the whole touch, forcing scroll to be
  // hand-rolled — which fights native momentum scrolling on iOS. "pan-y"
  // keeps vertical scroll native; if the browser commits to a scroll before
  // the long-press timer fires, it sends this element a pointercancel
  // (handled by onPreUp below), which cancels the pending drag for free.
  node.style.touchAction = "pan-y";

  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let dragging = false;
  let ghost: HTMLElement | null = null;
  let originRect: DOMRect | null = null;
  let lastX = 0;
  let lastY = 0;
  let scrollSpeed = 0;
  let scrollRaf: number | null = null;

  function clearPressTimer() {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  }

  function detachPreDragListeners() {
    node.removeEventListener("pointermove", onPreMove);
    node.removeEventListener("pointerup", onPreUp);
    node.removeEventListener("pointercancel", onPreUp);
  }

  function onPointerDown(e: PointerEvent) {
    if (opts.disabled) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if ((e.target as Element)?.closest(`[${IGNORE_ATTR}]`)) return;

    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    node.addEventListener("pointermove", onPreMove);
    node.addEventListener("pointerup", onPreUp);
    node.addEventListener("pointercancel", onPreUp);
    pressTimer = setTimeout(() => startDrag(e.pointerId), LONG_PRESS_MS);
  }

  function onPreMove(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    // Horizontal movement (or movement too fast/large to be a deliberate
    // long-press) isn't handled by native pan-y scroll, so cancel by hand.
    // Vertical scrolls are normally resolved by the browser sending a
    // pointercancel (see onPreUp) before this fires.
    if (Math.hypot(e.clientX - startX, e.clientY - startY) > MOVE_CANCEL_PX) {
      clearPressTimer();
      detachPreDragListeners();
    }
  }

  function onPreUp() {
    clearPressTimer();
    detachPreDragListeners();
  }

  function startDrag(id: number) {
    pressTimer = null;
    detachPreDragListeners();
    dragging = true;
    lastX = startX;
    lastY = startY;

    originRect = node.getBoundingClientRect();
    ghost = node.cloneNode(true) as HTMLElement;
    ghost.style.position = "fixed";
    ghost.style.left = `${originRect.left}px`;
    ghost.style.top = `${originRect.top}px`;
    ghost.style.width = `${originRect.width}px`;
    ghost.style.height = `${originRect.height}px`;
    ghost.style.margin = "0";
    ghost.style.pointerEvents = "none";
    ghost.style.zIndex = "1000";
    ghost.style.transition = "none";
    ghost.style.borderRadius = getComputedStyle(node).borderRadius;
    ghost.style.boxShadow = "0 16px 32px -12px rgba(0,0,0,0.4)";
    ghost.style.transform = "scale(1.03)";
    document.body.appendChild(ghost);
    node.style.opacity = "0.35";

    node.setPointerCapture(id);
    node.addEventListener("pointermove", onDragMove);
    node.addEventListener("pointerup", onDragEnd);
    node.addEventListener("pointercancel", onDragCancel);

    opts.onDragStart?.();
  }

  // iOS synthesizes a "click" after a touch gesture ends, targeted at
  // whatever element is under the finger at release — i.e. the drop
  // target's row, not the row that was dragged (pointer capture doesn't
  // redirect this synthetic event). Left unsuppressed, dropping onto
  // another slot re-opens that slot's picker as if it'd been tapped. So
  // swallow the *next* click anywhere in the document, not just on the
  // source node.
  function suppressNextClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    document.removeEventListener("click", suppressNextClick, true);
  }

  function positionGhost(x: number, y: number) {
    if (!ghost || !originRect) return;
    ghost.style.left = `${originRect.left + (x - startX)}px`;
    ghost.style.top = `${originRect.top + (y - startY)}px`;
  }

  function onDragMove(e: PointerEvent) {
    if (!dragging || e.pointerId !== pointerId) return;
    e.preventDefault();
    lastX = e.clientX;
    lastY = e.clientY;
    positionGhost(lastX, lastY);
    opts.onDragOver?.((resolveTargetAt(lastX, lastY) as T | null) ?? null);
    updateAutoScroll(lastY);
  }

  function updateAutoScroll(clientY: number) {
    const vh = window.innerHeight;
    if (clientY < EDGE_ZONE_PX) {
      scrollSpeed = -MAX_SCROLL_SPEED * (1 - clientY / EDGE_ZONE_PX);
    } else if (clientY > vh - EDGE_ZONE_PX) {
      scrollSpeed = MAX_SCROLL_SPEED * (1 - (vh - clientY) / EDGE_ZONE_PX);
    } else {
      scrollSpeed = 0;
    }
    if (scrollSpeed !== 0 && scrollRaf === null) {
      scrollRaf = requestAnimationFrame(scrollTick);
    }
  }

  function scrollTick() {
    if (!dragging || scrollSpeed === 0) {
      scrollRaf = null;
      return;
    }
    window.scrollBy(0, scrollSpeed);
    scrollRaf = requestAnimationFrame(scrollTick);
  }

  function stopAutoScroll() {
    scrollSpeed = 0;
    if (scrollRaf !== null) {
      cancelAnimationFrame(scrollRaf);
      scrollRaf = null;
    }
  }

  function endDrag(targetId: T | null) {
    dragging = false;
    stopAutoScroll();
    node.removeEventListener("pointermove", onDragMove);
    node.removeEventListener("pointerup", onDragEnd);
    node.removeEventListener("pointercancel", onDragCancel);
    if (pointerId !== null) node.releasePointerCapture(pointerId);
    node.style.opacity = "";

    const droppedGhost = ghost;
    const rect = originRect;
    ghost = null;
    originRect = null;

    if (droppedGhost && rect) {
      if (targetId === null) {
        droppedGhost.style.transition = "left 180ms ease, top 180ms ease, transform 180ms ease";
        droppedGhost.style.left = `${rect.left}px`;
        droppedGhost.style.top = `${rect.top}px`;
        droppedGhost.style.transform = "scale(1)";
        setTimeout(() => droppedGhost.remove(), 200);
      } else {
        droppedGhost.remove();
      }
    }

    document.addEventListener("click", suppressNextClick, true);
    setTimeout(() => document.removeEventListener("click", suppressNextClick, true), 500);

    opts.onDrop?.(targetId);
  }

  function onDragEnd(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    endDrag((resolveTargetAt(lastX, lastY) as T | null) ?? null);
  }

  function onDragCancel(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    endDrag(null);
  }

  node.addEventListener("pointerdown", onPointerDown);

  return {
    update(newParams: LongPressDragParams<T>) {
      opts = newParams;
      dropTargets.set(node, opts.id);
    },
    destroy() {
      node.removeEventListener("pointerdown", onPointerDown);
      detachPreDragListeners();
      clearPressTimer();
      node.removeEventListener("pointermove", onDragMove);
      node.removeEventListener("pointerup", onDragEnd);
      node.removeEventListener("pointercancel", onDragCancel);
      document.removeEventListener("click", suppressNextClick, true);
      stopAutoScroll();
      dropTargets.delete(node);
      ghost?.remove();
    },
  };
}

export { IGNORE_ATTR as dragIgnoreAttr };
