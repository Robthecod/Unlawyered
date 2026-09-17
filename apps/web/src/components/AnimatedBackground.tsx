/**
 * Memphis decorative layer: solid geometric shapes (triangle, arc, dots,
 * plus, squiggle, half-circle, zigzag) drifting gently behind the app on
 * the cream field. Transform-only CSS keyframes, fully disabled under
 * prefers-reduced-motion.
 *
 * Dragging: the shapes are also directly manipulable — press and move the
 * cursor to pick up and fling a shape around the page. That is the only
 * interaction they support (no click behaviour). The layer sits at
 * z-index -1 with pointer-events: none, so shapes never receive pointer
 * events; instead one global pointerdown handler decides whether a shape
 * lies under the cursor. To keep it from fighting the app, a grab only
 * starts over empty space: interactive elements, real text and painted
 * surfaces (cards, header, footer) all block. elementsFromPoint skips
 * pointer-events:none layers, so blockers are checked via the hit list
 * while shapes are found geometrically by rect.
 *
 * The drag offset is applied via the individual CSS `translate` property,
 * which composes with (rather than fights) the keyframed `transform`, so
 * each shape keeps drifting/bobbing/spinning around wherever you park it.
 *
 * Fling: velocity is sampled from the movement actually applied (so pressing
 * against the viewport wall builds no speed) and on release the shape coasts
 * in a short exponential-friction glide, losing the axis that hits a wall.
 * Suppressed under prefers-reduced-motion. Touch pointers are excluded so
 * page scrolling keeps working on mobile.
 */
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

type Offset = { x: number; y: number };

/** Elements that must never start (or continue) a shape drag. */
const INTERACTIVE =
  "a, button, input, textarea, select, label, [role='button'], [contenteditable='true']";

/** Viewport margin a dragged shape's centre is clamped to. */
const VIEWPORT_MARGIN = 24;

/** Fling tuning. */
const FLING_MAX_SPEED = 2400; // px/s launch cap
const FLING_FRICTION = 5.5; // exponential decay constant (1/s)
const FLING_MIN_SPEED = 40; // px/s below which the glide ends
const VELOCITY_STALE_MS = 90; // held-still pointer counts as no fling

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Does the element itself carry visible text (as opposed to child elements)? */
function hasDirectText(el: Element): boolean {
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim() !== "") {
      return true;
    }
  }
  return false;
}

/** Is the element visibly painted (opaque background colour or a background image)? */
function isPainted(el: Element): boolean {
  const s = getComputedStyle(el);
  if (s.backgroundImage && s.backgroundImage !== "none") return true;
  const m = s.backgroundColor.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\)/);
  if (!m) return false;
  return m[4] !== undefined ? parseFloat(m[4] ?? "1") > 0.05 : true;
}

/**
 * The grabbable shape at (x, y), or null. Content hit-list first: any
 * interactive element, real text or painted surface blocks the grab.
 * body/html are exempt (they are the page base, always painted). If the
 * pointer is over empty space, the topmost shape whose rect contains the
 * point wins — later siblings paint above earlier ones.
 */
function findGrabbableShape(x: number, y: number): SVGSVGElement | null {
  for (const el of document.elementsFromPoint(x, y)) {
    if (el === document.body || el === document.documentElement) continue;
    if (el.closest(INTERACTIVE)) return null;
    if (hasDirectText(el) || isPainted(el)) return null;
  }
  const shapes = document.querySelectorAll<SVGSVGElement>("[data-shape-id]");
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i];
    if (!s) continue;
    const r = s.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return s;
  }
  return null;
}

interface ShapeProps {
  id: string;
  anim: string;
  style: CSSProperties;
  width: number;
  height: number;
  viewBox: string;
  offset: Offset;
  children: ReactNode;
}

function Shape({ id, anim, style, width, height, viewBox, offset, children }: ShapeProps) {
  return (
    <svg
      data-shape-id={id}
      className={`bg-shape ${anim}`}
      style={{ ...style, translate: `${offset.x}px ${offset.y}px` }}
      width={width}
      height={height}
      viewBox={viewBox}
    >
      {children}
    </svg>
  );
}

export function AnimatedBackground() {
  const [offsets, setOffsets] = useState<Record<string, Offset>>({});
  const offsetsRef = useRef(offsets);
  offsetsRef.current = offsets;

  useEffect(() => {
    let drag: null | {
      id: string;
      startX: number;
      startY: number;
      base: Offset;
      /** Offset applied so far — the glide launches from here. */
      cur: Offset;
      /** Shape centre at grab, in viewport coords — anchor for the clamp. */
      cx: number;
      cy: number;
    } = null;
    let hovered: SVGSVGElement | null = null;
    let hoverRaf = 0;
    let lastPointer = { x: -1, y: -1 };

    /** Live fling glides, one per coasting shape (several can overlap). */
    const glides = new Map<
      string,
      {
        x: number;
        y: number;
        vx: number;
        vy: number;
        loX: number;
        hiX: number;
        loY: number;
        hiY: number;
        last: number;
        raf: number;
      }
    >();

    const stopGlide = (id: string) => {
      const g = glides.get(id);
      if (g) {
        cancelAnimationFrame(g.raf);
        glides.delete(id);
      }
    };

    /** Pointer-velocity sample, from the offsets actually applied. */
    let vel = { x: 0, y: 0, t: 0, vx: 0, vy: 0 };

    // Autonomous fling motion is exactly what prefers-reduced-motion is for.
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const setShapeClass = (shape: SVGSVGElement | null, cls: string) => {
      if (shape) shape.classList.add(cls);
    };
    const clearShapeClass = (shape: SVGSVGElement | null, cls: string) => {
      if (shape) shape.classList.remove(cls);
    };

    /* ------------------------------------------------------------ */
    /* Dragging + release fling                                      */
    /* ------------------------------------------------------------ */

    /** Friction glide: exponential decay, soft wall at the viewport clamp. */
    const startGlide = (
      id: string,
      from: Offset,
      v: { x: number; y: number },
      c: { cx: number; cy: number },
      base: Offset,
    ) => {
      stopGlide(id);
      const g = {
        x: from.x,
        y: from.y,
        vx: v.x,
        vy: v.y,
        loX: base.x + VIEWPORT_MARGIN - c.cx,
        hiX: base.x + window.innerWidth - VIEWPORT_MARGIN - c.cx,
        loY: base.y + VIEWPORT_MARGIN - c.cy,
        hiY: base.y + window.innerHeight - VIEWPORT_MARGIN - c.cy,
        last: performance.now(),
        raf: 0,
      };
      glides.set(id, g);
      const step = (now: number) => {
        const dt = Math.min(Math.max((now - g.last) / 1000, 0.001), 0.05);
        g.last = now;
        const decay = Math.exp(-FLING_FRICTION * dt);
        g.vx *= decay;
        g.vy *= decay;
        let nx = g.x + g.vx * dt;
        let ny = g.y + g.vy * dt;
        // Whatever axis hits the clamp loses its velocity (soft wall).
        const clX = clamp(nx, g.loX, g.hiX);
        if (clX !== nx) {
          nx = clX;
          g.vx = 0;
        }
        const clY = clamp(ny, g.loY, g.hiY);
        if (clY !== ny) {
          ny = clY;
          g.vy = 0;
        }
        g.x = nx;
        g.y = ny;
        setOffsets((prev) => ({ ...prev, [id]: { x: nx, y: ny } }));
        if (Math.hypot(g.vx, g.vy) > FLING_MIN_SPEED) {
          g.raf = requestAnimationFrame(step);
        } else {
          glides.delete(id);
        }
      };
      g.raf = requestAnimationFrame(step);
    };

    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      const d = drag;
      // Keep the shape's centre comfortably inside the viewport so a shape
      // can be thrown at the edges but never lost off-screen.
      const M = VIEWPORT_MARGIN;
      const dx = clamp(e.clientX - d.startX, M - d.cx, window.innerWidth - M - d.cx);
      const dy = clamp(e.clientY - d.startY, M - d.cy, window.innerHeight - M - d.cy);
      const nx = d.base.x + dx;
      const ny = d.base.y + dy;
      d.cur = { x: nx, y: ny };
      // Velocity from the movement actually applied (post-clamp), so pressing
      // against a wall builds no fling speed.
      const now = performance.now();
      if (now > vel.t) {
        vel.vx = ((nx - vel.x) / (now - vel.t)) * 1000;
        vel.vy = ((ny - vel.y) / (now - vel.t)) * 1000;
        vel.x = nx;
        vel.y = ny;
        vel.t = now;
      }
      setOffsets((prev) => ({ ...prev, [d.id]: { x: nx, y: ny } }));
    };

    const stopDrag = () => {
      if (!drag) return;
      const d = drag;
      const el = document.querySelector<SVGSVGElement>(`[data-shape-id="${d.id}"]`);
      clearShapeClass(el, "grabbing");
      drag = null;
      document.body.classList.remove("bg-dragging");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stopDrag);
      window.removeEventListener("pointercancel", stopDrag);
      window.removeEventListener("blur", stopDrag);

      // Fling: launch a friction glide from the release velocity. A stale
      // sample (pointer held still before release) counts as no fling.
      const now = performance.now();
      const fresh = now - vel.t <= VELOCITY_STALE_MS;
      const vx = fresh ? vel.vx : 0;
      const vy = fresh ? vel.vy : 0;
      const speed = Math.hypot(vx, vy);
      if (reducedMotion || speed < FLING_MIN_SPEED) return;
      const cap = Math.min(1, FLING_MAX_SPEED / speed);
      startGlide(d.id, d.cur, { x: vx * cap, y: vy * cap }, d, d.base);
    };

    const onDown = (e: PointerEvent) => {
      // Touch is excluded so scrolling on mobile never hijacks a shape.
      if (e.button !== 0 || e.pointerType === "touch") return;
      const shape = findGrabbableShape(e.clientX, e.clientY);
      if (!shape) return;
      const id = shape.getAttribute("data-shape-id");
      if (!id) return;
      // Grabbing a coasting shape stops its glide dead.
      stopGlide(id);
      const base = offsetsRef.current[id] ?? { x: 0, y: 0 };
      const r = shape.getBoundingClientRect();
      drag = {
        id,
        startX: e.clientX,
        startY: e.clientY,
        base,
        cur: { ...base },
        cx: r.left + r.width / 2,
        cy: r.top + r.height / 2,
      };
      vel = { x: base.x, y: base.y, t: performance.now(), vx: 0, vy: 0 };
      if (hovered && hovered !== shape) clearShapeClass(hovered, "grab-ready");
      hovered = shape;
      clearShapeClass(shape, "grab-ready");
      setShapeClass(shape, "grabbing");
      document.body.classList.remove("bg-grab-ready");
      document.body.classList.add("bg-dragging");
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", stopDrag);
      window.addEventListener("pointercancel", stopDrag);
      window.addEventListener("blur", stopDrag);
    };

    /* ------------------------------------------------------------ */
    /* Hover affordance (rAF-throttled)                              */
    /* ------------------------------------------------------------ */

    const evaluateHover = () => {
      hoverRaf = 0;
      if (drag) return;
      const shape = findGrabbableShape(lastPointer.x, lastPointer.y);
      if (shape === hovered) return;
      clearShapeClass(hovered, "grab-ready");
      hovered = shape;
      setShapeClass(shape, "grab-ready");
      document.body.classList.toggle("bg-grab-ready", shape !== null);
    };

    const onHoverMove = (e: PointerEvent) => {
      lastPointer.x = e.clientX;
      lastPointer.y = e.clientY;
      if (drag || hoverRaf) return;
      hoverRaf = requestAnimationFrame(evaluateHover);
    };

    const onHoverLeave = () => {
      clearShapeClass(hovered, "grab-ready");
      hovered = null;
      document.body.classList.remove("bg-grab-ready");
    };

    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onHoverMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onHoverLeave);

    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onHoverMove);
      document.documentElement.removeEventListener("pointerleave", onHoverLeave);
      if (hoverRaf) cancelAnimationFrame(hoverRaf);
      for (const id of [...glides.keys()]) stopGlide(id);
      stopDrag();
      clearShapeClass(hovered, "grab-ready");
      hovered = null;
      document.body.classList.remove("bg-grab-ready", "bg-dragging");
    };
  }, []);

  const at = (id: string): Offset => offsets[id] ?? { x: 0, y: 0 };

  return (
    <div className="bg-fx" aria-hidden="true">
      {/* Coral triangle, top-left */}
      <Shape id="triangle" anim="drift" offset={at("triangle")} style={{ top: "8%", left: "3%" }} width={90} height={90} viewBox="0 0 90 90">
        <polygon points="45,8 86,82 4,82" fill="var(--coral)" stroke="var(--ink)" strokeWidth="3" />
      </Shape>

      {/* Teal quarter arc, upper-middle */}
      <Shape id="arc" anim="sway" offset={at("arc")} style={{ top: "16%", left: "26%" }} width={80} height={80} viewBox="0 0 80 80">
        <path d="M4 76 A 72 72 0 0 1 76 4 L 76 76 Z" fill="var(--teal)" stroke="var(--ink)" strokeWidth="3" />
      </Shape>

      {/* Mustard dotted circle, top-right */}
      <Shape id="dot-ring" anim="spin" offset={at("dot-ring")} style={{ top: "7%", right: "6%" }} width={100} height={100} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--mustard)" strokeWidth="8" strokeDasharray="2 12" strokeLinecap="round" />
      </Shape>

      {/* Violet plus, right side */}
      <Shape id="plus" anim="bob" offset={at("plus")} style={{ top: "34%", right: "10%" }} width={64} height={64} viewBox="0 0 64 64">
        <path d="M26 4h12v22h22v12H38v22H26V38H4V26h22Z" fill="var(--violet)" stroke="var(--ink)" strokeWidth="3" />
      </Shape>

      {/* Black squiggle, bottom-left */}
      <Shape id="squiggle" anim="sway" offset={at("squiggle")} style={{ bottom: "14%", left: "5%" }} width={120} height={40} viewBox="0 0 120 40">
        <path d="M4 20c8-16 16-16 24 0s16 16 24 0 16-16 24 0 16 16 24 0 12-14 16-8" fill="none" stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" />
      </Shape>

      {/* Mustard half-circle, bottom-right */}
      <Shape id="half-circle" anim="drift" offset={at("half-circle")} style={{ bottom: "10%", right: "14%" }} width={96} height={52} viewBox="0 0 96 52">
        <path d="M4 48 A 44 44 0 0 1 92 48 Z" fill="var(--mustard)" stroke="var(--ink)" strokeWidth="3" />
      </Shape>

      {/* Teal dot, mid-left */}
      <Shape id="dot" anim="bob" offset={at("dot")} style={{ top: "52%", left: "10%" }} width={34} height={34} viewBox="0 0 34 34">
        <circle cx="17" cy="17" r="14" fill="var(--teal)" stroke="var(--ink)" strokeWidth="3" />
      </Shape>

      {/* Sky-blue zigzag, lower-middle */}
      <Shape id="zigzag" anim="drift" offset={at("zigzag")} style={{ bottom: "24%", left: "38%" }} width={110} height={44} viewBox="0 0 110 44">
        <path d="M4 40 22 6l18 34L58 6l18 34L94 6l12 22" fill="none" stroke="var(--sky)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </Shape>

      {/* Coral patterned circle, bottom-center-left */}
      <Shape id="target" anim="wobble" offset={at("target")} style={{ bottom: "6%", left: "24%" }} width={74} height={74} viewBox="0 0 74 74">
        <circle cx="37" cy="37" r="32" fill="var(--coral)" stroke="var(--ink)" strokeWidth="3" />
        <circle cx="37" cy="37" r="18" fill="none" stroke="var(--ink)" strokeWidth="3" strokeDasharray="6 7" />
      </Shape>
    </div>
  );
}
