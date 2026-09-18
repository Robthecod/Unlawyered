/**
 * The UNLAWYERED mark: the colorful bubble-letter wordmark (Memphis shapes,
 * yellow triangle, coral dot, purple plus) as an image asset rendered from
 * /logo-mark.png — a wordmark-only crop of the full lockup, so it can sit
 * next to text without duplicating it.
 *
 * `Logo` renders the full horizontal mark; `LogoIcon` renders the square
 * teal-U emblem for standalone spots (favicon-style, small badges).
 * Sizes are set via CSS height so the mark scales crisply; width follows
 * the image's own aspect ratio.
 */
export function Logo({ height = 34 }: { height?: number }) {
  return (
    <img
      src="/logo-mark.png"
      alt="UNLAWYERED"
      className="logo"
      style={{ height }}
      draggable={false}
    />
  );
}

/** Square teal-U emblem from the lockup, for standalone/icon-sized use. */
export function LogoIcon({ size = 28 }: { size?: number }) {
  return (
    <img
      src="/icon-192.png"
      alt=""
      aria-hidden="true"
      className="logo"
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}
