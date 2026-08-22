// Star rating drawn as real SVG geometry, not font glyphs. Text stars are
// unreliable: ★/☆ render as colour emoji in some stacks, and there is no
// dependable half-star character (U+2BE8 is a half *circle*, which is what
// used to show up here as tofu).

const STAR_PATH =
  "M12 2.6l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.4l-5.8 3.06 1.1-6.46-4.69-4.58 6.49-.94z";

interface Props {
  /** 60–100 player rating. */
  rating: number;
  size?: number;
  className?: string;
}

export default function Stars({ rating, size = 13, className = "" }: Props) {
  // 60 → 0 stars, 100 → 5 stars, rounded to the nearest half.
  const value = Math.max(0, Math.min(5, Math.round(((rating - 60) / 40) * 10) / 2));
  const id = `half-${Math.round(value * 2)}`;

  return (
    <span className={`inline-flex items-center gap-[2px] align-middle ${className}`} title={`rating ${rating}`}>
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id={id}>
            <stop offset="50%" stopColor="currentColor" />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        </defs>
      </svg>
      {Array.from({ length: 5 }, (_, i) => {
        const filled = value >= i + 1;
        const half = !filled && value >= i + 0.5;
        return (
          <svg
            key={i}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            className="text-amber-400"
            aria-hidden
          >
            <path
              d={STAR_PATH}
              fill={filled ? "currentColor" : half ? `url(#${id})` : "none"}
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinejoin="round"
              opacity={filled || half ? 1 : 0.35}
            />
          </svg>
        );
      })}
    </span>
  );
}
