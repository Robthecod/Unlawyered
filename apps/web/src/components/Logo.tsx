/**
 * The UNLAWYERED mark: a gavel striking inside a shield, drawn flat for the
 * Memphis identity — mustard shield, ink head, cream handle with an ink
 * outline (so head and handle read separately at small sizes), coral strike
 * point with impact ticks. Pure inline SVG, no gradients, no drop shadows.
 */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="UNLAWYERED logo"
      className="logo"
    >
      {/* Shield */}
      <path
        d="M24 3.5 41 9.5v13.8c0 10.4-6.9 17.6-17 21.2C13.9 40.9 7 33.7 7 23.3V9.5L24 3.5Z"
        fill="var(--mustard, #ffc531)"
        stroke="var(--ink, #17140d)"
        strokeWidth="3"
        strokeLinejoin="round"
      />

      {/* Handle: cream with an ink outline, tucked under the head */}
      <rect
        x="22.8"
        y="17.3"
        width="3.6"
        height="12.4"
        rx="1.8"
        transform="rotate(45 24.6 23.5)"
        fill="var(--bg-raised, #fffdf7)"
        stroke="var(--ink, #17140d)"
        strokeWidth="2.2"
      />

      {/* Gavel head */}
      <rect
        x="26.2"
        y="12.6"
        width="11.4"
        height="7.2"
        rx="2"
        transform="rotate(45 31.9 16.2)"
        fill="var(--ink, #17140d)"
      />

      {/* Strike point: coral dot + impact ticks */}
      <circle
        cx="16.6"
        cy="31.6"
        r="3.2"
        fill="var(--coral, #ff5b57)"
        stroke="var(--ink, #17140d)"
        strokeWidth="2"
      />
      <g stroke="var(--ink, #17140d)" strokeWidth="2.2" strokeLinecap="round">
        <path d="M12.8 34.2 11.4 35.6" />
        <path d="M16.2 36.4 16.2 38.4" />
        <path d="M19.6 34.2 21 35.6" />
      </g>
    </svg>
  );
}
