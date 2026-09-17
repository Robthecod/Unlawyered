/**
 * Adaptive Memphis cursor.
 *
 * A CSS `cursor: url(...)` bitmap is static — it can't know what's beneath it.
 * So instead we hide the native cursor (fine-pointer devices only) and render
 * the Memphis arrow as a fixed DOM overlay that follows the pointer. On every
 * frame it samples the effective background colour under the pointer and picks
 * accent / outline / dot colours with maximum contrast, so the cursor never
 * merges with the surface it is over — including the dark footer, mustard
 * buttons, teal/coral/violet/sky cards and the cream page.
 *
 * Motion: the arrow leans into its direction of travel (velocity-driven tilt,
 * max ±8°), easing back upright when the pointer stops. The hotspot is pinned
 * to the arrow tip and rotation pivots around the tip, so click precision is
 * unaffected by the tilt. The rAF loop stops when idle.
 *
 * Accessibility: enabled only on fine pointers with hover; disabled entirely
 * under prefers-reduced-motion (native cursor kept); text fields keep the
 * native text/beam cursor.
 */
import { useEffect, useRef } from "react";

/* Palette from styles.css (kept in sync manually; solid colors only). */
const INK = [23, 20, 13] as const; // #17140d
const CREAM = [245, 239, 226] as const; // #f5efe2
const WHITE = [255, 255, 255] as const;
const ACCENTS: Array<readonly [number, number, number]> = [
  [255, 91, 87], // coral #ff5b57
  [18, 179, 164], // teal #12b3a4
  [255, 197, 49], // mustard #ffc531
  [107, 91, 230], // violet #6b5be6
  [58, 160, 255], // sky #3aa0ff
];

/* Rendered size and tip geometry. viewBox is 32 and the SVG renders at SIZE,
   so the tip at (1,2) sits at (1,2) * SIZE/32 px inside the element. */
const SIZE = 26;
const TIP_X = (1 * SIZE) / 32; // 0.8125px
const TIP_Y = (2 * SIZE) / 32; // 1.625px

/* Motion tuning. */
const FOLLOW_EASE = 0.35; // how snappily the arrow chases the pointer
const TILT_PER_PX = 0.9; // degrees of lean per px of horizontal travel
const TILT_MAX = 8; // max lean in degrees
const TILT_EASE = 0.25; // how quickly tilt approaches its target
const SETTLE = 0.1; // motion below this is considered stopped

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** WCAG contrast ratio between two rgb triplets. */
function contrast(a: readonly number[], b: readonly number[]): number {
  const lum = (c: readonly number[]) => {
    const f = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c[0] ?? 0) + 0.7152 * f(c[1] ?? 0) + 0.0722 * f(c[2] ?? 0);
  };
  const l1 = lum(a);
  const l2 = lum(b);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Effective background under the pointer: walks up from elementFromPoint,
 * skipping transparent layers; falls back to the page cream.
 */
function effectiveBackground(x: number, y: number): readonly [number, number, number] {
  const els = document.elementsFromPoint(x, y);
  for (const el of els) {
    let node: Element | null = el;
    while (node) {
      const bg = getComputedStyle(node).backgroundColor;
      if (bg && bg !== "transparent") {
        const m = bg.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\)/);
        if (m) {
          const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
          if (a > 0.5) {
            return [
              Math.round(parseFloat(m[1] ?? "0")),
              Math.round(parseFloat(m[2] ?? "0")),
              Math.round(parseFloat(m[3] ?? "0")),
            ];
          }
        }
      }
      node = node.parentElement;
    }
  }
  return CREAM;
}

export function AdaptiveCursor() {
  const arrowRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches && window.matchMedia("(hover: hover)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return;

    const root = document.documentElement;
    const arrow = arrowRef.current;
    if (!arrow) return;

    root.classList.add("adaptive-cursor-on");

    /* Hide the native cursor everywhere except typing surfaces. */
    const style = document.createElement("style");
    style.textContent = [
      ".adaptive-cursor-on body{cursor:none;}",
      ".adaptive-cursor-on a,.adaptive-cursor-on button,.adaptive-cursor-on [role='button'],",
      ".adaptive-cursor-on label,.adaptive-cursor-on .nav a,.adaptive-cursor-on .upload-area{cursor:none;}",
      ".adaptive-cursor-on input[type='text'],.adaptive-cursor-on input[type='password'],",
      ".adaptive-cursor-on textarea,.adaptive-cursor-on select{cursor:auto;}",
    ].join(" ");
    document.head.appendChild(style);

    const wrap = arrow.parentElement as HTMLElement;
    wrap.style.display = "block";

    const target = { x: -100, y: -100 }; // pointer position
    const pos = { x: -100, y: -100 }; // eased (rendered) position
    let tilt = 0; // current lean in degrees
    let raf = 0;

    /** Recolor accent/outline/dot against the surface under (x, y). */
    const recolor = (x: number, y: number) => {
      const bg = effectiveBackground(x, y);
      const onDark = contrast(bg, INK) < contrast(bg, WHITE);

      let best: readonly [number, number, number] = ACCENTS[0] ?? ([255, 91, 87] as const);
      let bestScore = -1;
      for (const c of ACCENTS) {
        const s = contrast(c, bg);
        if (s > bestScore) {
          bestScore = s;
          best = c;
        }
      }

      const outline = onDark ? CREAM : INK;
      const rgb = (c: readonly number[]) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
      const g = arrow.querySelector<SVGGElement>(".ac-arrow");
      const dot = arrow.querySelector<SVGCircleElement>(".ac-dot");
      if (g) {
        g.querySelector<SVGPathElement>(".ac-shadow")?.setAttribute("fill", rgb(outline));
        g.querySelector<SVGPathElement>(".ac-body")?.setAttribute("fill", rgb(best));
        g.setAttribute("stroke", rgb(outline));
      }
      if (dot) {
        // Light surfaces: white dot (ink ring separates it). Dark surfaces:
        // accent dot with a cream ring.
        dot.setAttribute("fill", rgb(onDark ? best : WHITE));
        dot.setAttribute("stroke", rgb(outline));
      }
    };

    /** One animation frame: ease position, ease tilt, paint, maybe idle. */
    const loop = () => {
      raf = 0;
      const dx = target.x - pos.x;
      const dy = target.y - pos.y;
      pos.x += dx * FOLLOW_EASE;
      pos.y += dy * FOLLOW_EASE;

      // Lean into horizontal travel; settle upright when movement stops.
      const targetTilt = clamp(dx * TILT_PER_PX, -TILT_MAX, TILT_MAX);
      tilt += (targetTilt - tilt) * TILT_EASE;
      if (Math.abs(tilt) < SETTLE) tilt = 0;

      // Position the wrapper so the arrow TIP sits exactly on the pointer.
      wrap.style.transform = `translate3d(${pos.x - TIP_X}px, ${pos.y - TIP_Y}px, 0)`;
      arrow.style.transform = `rotate(${tilt}deg)`;

      const moving = Math.abs(dx) > SETTLE || Math.abs(dy) > SETTLE;
      if (moving) recolor(pos.x, pos.y);

      // Keep animating while there is motion; otherwise stop the loop.
      if (moving || tilt !== 0) {
        raf = requestAnimationFrame(loop);
      }
    };

    const kick = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      if (pos.x < -50) {
        // First activation: jump to the pointer instead of gliding in.
        pos.x = target.x;
        pos.y = target.y;
        recolor(pos.x, pos.y);
      }
      kick();
    };
    const onLeave = () => {
      wrap.style.display = "none";
    };
    const onEnter = () => {
      wrap.style.display = "block";
      kick();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    document.documentElement.addEventListener("pointerenter", onEnter);

    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.documentElement.removeEventListener("pointerenter", onEnter);
      style.remove();
      root.classList.remove("adaptive-cursor-on");
      wrap.style.display = "none";
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  /* Overlay is hidden by default and only shown when the effect activates. */
  return (
    <div className="ac-wrap" aria-hidden="true">
      <svg
        ref={arrowRef}
        className="ac-svg"
        width={SIZE}
        height={SIZE}
        viewBox="0 0 32 32"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g className="ac-arrow" strokeWidth="2.5" strokeLinejoin="round">
          <path className="ac-shadow" d="M5 3L23 15L15 17L19 27L14 29L10 19L3 23V3Z" fill="rgb(23,20,13)" />
          <path
            className="ac-body"
            d="M3 2L21 14L13 16L17 26L12 28L8 18L1 22V2Z"
            fill="rgb(255,91,87)"
            stroke="inherit"
          />
        </g>
        <circle className="ac-dot" cx="25" cy="7" r="3" fill="rgb(23,20,13)" stroke="rgb(23,20,13)" strokeWidth="1.5" />
      </svg>
    </div>
  );
}
