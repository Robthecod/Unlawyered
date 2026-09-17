/**
 * Memphis decorative layer: solid geometric shapes (triangle, arc, dots,
 * plus, squiggle, half-circle, zigzag) drifting gently behind the app on
 * the cream field. All pointer-events: none, transform-only CSS keyframes,
 * fully disabled under prefers-reduced-motion.
 */
export function AnimatedBackground() {
  return (
    <div className="bg-fx" aria-hidden="true">
      {/* Coral triangle, top-left */}
      <svg className="bg-shape drift" style={{ top: "8%", left: "3%" }} width="90" height="90" viewBox="0 0 90 90">
        <polygon points="45,8 86,82 4,82" fill="var(--coral)" stroke="var(--ink)" strokeWidth="3" />
      </svg>

      {/* Teal quarter arc, upper-middle */}
      <svg className="bg-shape sway" style={{ top: "16%", left: "26%" }} width="80" height="80" viewBox="0 0 80 80">
        <path d="M4 76 A 72 72 0 0 1 76 4 L 76 76 Z" fill="var(--teal)" stroke="var(--ink)" strokeWidth="3" />
      </svg>

      {/* Mustard dotted circle, top-right */}
      <svg className="bg-shape spin" style={{ top: "7%", right: "6%" }} width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--mustard)" strokeWidth="8" strokeDasharray="2 12" strokeLinecap="round" />
      </svg>

      {/* Violet plus, right side */}
      <svg className="bg-shape bob" style={{ top: "34%", right: "10%" }} width="64" height="64" viewBox="0 0 64 64">
        <path d="M26 4h12v22h22v12H38v22H26V38H4V26h22Z" fill="var(--violet)" stroke="var(--ink)" strokeWidth="3" />
      </svg>

      {/* Black squiggle, bottom-left */}
      <svg className="bg-shape sway" style={{ bottom: "14%", left: "5%" }} width="120" height="40" viewBox="0 0 120 40">
        <path d="M4 20c8-16 16-16 24 0s16 16 24 0 16-16 24 0 16 16 24 0 12-14 16-8" fill="none" stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" />
      </svg>

      {/* Mustard half-circle, bottom-right */}
      <svg className="bg-shape drift" style={{ bottom: "10%", right: "14%" }} width="96" height="52" viewBox="0 0 96 52">
        <path d="M4 48 A 44 44 0 0 1 92 48 Z" fill="var(--mustard)" stroke="var(--ink)" strokeWidth="3" />
      </svg>

      {/* Teal dot, mid-left */}
      <svg className="bg-shape bob" style={{ top: "52%", left: "10%" }} width="34" height="34" viewBox="0 0 34 34">
        <circle cx="17" cy="17" r="14" fill="var(--teal)" stroke="var(--ink)" strokeWidth="3" />
      </svg>

      {/* Sky-blue zigzag, lower-middle */}
      <svg className="bg-shape drift" style={{ bottom: "24%", left: "38%" }} width="110" height="44" viewBox="0 0 110 44">
        <path d="M4 40 22 6l18 34L58 6l18 34L94 6l12 22" fill="none" stroke="var(--sky)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      {/* Coral patterned circle, bottom-center-left */}
      <svg className="bg-shape wobble" style={{ bottom: "6%", left: "24%" }} width="74" height="74" viewBox="0 0 74 74">
        <circle cx="37" cy="37" r="32" fill="var(--coral)" stroke="var(--ink)" strokeWidth="3" />
        <circle cx="37" cy="37" r="18" fill="none" stroke="var(--ink)" strokeWidth="3" strokeDasharray="6 7" />
      </svg>
    </div>
  );
}
