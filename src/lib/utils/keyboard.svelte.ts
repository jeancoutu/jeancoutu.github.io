// Tracks whether the on-screen (software) keyboard is currently covering the
// viewport. iOS Safari lifts `position: fixed` elements above the keyboard when
// an input is focused, so UI pinned to the bottom (e.g. BottomNav) needs to
// know when to get out of the way.

class KeyboardStore {
  open = $state(false);
}

export const keyboard = new KeyboardStore();

if (typeof window !== "undefined" && window.visualViewport) {
  const vv = window.visualViewport;

  const update = () => {
    // Layout viewport height stays constant on iOS when the keyboard opens;
    // the visual viewport shrinks. The difference (minus any scroll offset)
    // is roughly the keyboard height.
    const covered = window.innerHeight - vv.height - vv.offsetTop;
    keyboard.open = covered > 150;
  };

  vv.addEventListener("resize", update);
  vv.addEventListener("scroll", update);
  update();
}
