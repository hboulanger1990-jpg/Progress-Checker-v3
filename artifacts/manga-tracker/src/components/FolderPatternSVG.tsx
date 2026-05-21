import type { FolderPattern } from "../types";

interface Props {
  pattern: FolderPattern;
  hex: string;
  /** true = small 80×44 preview in modal, false = full 150×100 card */
  preview?: boolean;
}

/**
 * Renders the inner SVG elements for a folder pattern.
 * The parent <svg> must be sized to 80×44 (preview) or 150×100 (card).
 * All shapes are right-aligned and semi-transparent (opacity set on <g>).
 */
export function FolderPatternSVG({ pattern, hex, preview = false }: Props) {
  if (pattern === "none") return null;

  // Scale factors: preview is 80×44, card is 150×100
  // We author in card coords (150×100) and scale down for preview
  const scale = preview ? 80 / 150 : 1;
  const sh = preview ? 44 / 100 : 1;

  const s = (x: number) => x * scale;
  const v = (y: number) => y * sh;

  const opacity = 0.13;

if (pattern === "chevron") {
    const svgW = preview ? 80 : 150;
    const svgH = preview ? 44 : 100;
    const tw = preview ? 80 / 150 * 40 : 40;
    const th = preview ? 44 / 100 * 12 : 12;
    const id = `chevron-${hex.slice(1)}-${preview ? "p" : "c"}`;
    return (
      <g opacity={opacity}>
        <defs>
          <pattern id={id} x="0" y="0" width={tw} height={th} patternUnits="userSpaceOnUse">
            <svg width={tw} height={th} viewBox="0 0 40 12">
              <path
                d="M0 6.172L6.172 0h5.656L0 11.828V6.172zm40 5.656L28.172 0h5.656L40 6.172v5.656zM6.172 12l12-12h3.656l12 12h-5.656L20 3.828 11.828 12H6.172zm12 0L20 10.172 21.828 12h-3.656z"
                fill={hex}
                fillRule="evenodd"
              />
            </svg>
          </pattern>
        </defs>
        <rect x={0} y={0} width={svgW} height={svgH} fill={`url(#${id})`} />
      </g>
    );
  }

  if (pattern === "books") return (
    <g opacity={opacity} fill={hex}>
      <rect x={s(90)} y={v(10)} width={s(10)} height={v(50)} rx={s(2)} />
      <rect x={s(103)} y={v(15)} width={s(8)} height={v(45)} rx={s(2)} />
      <rect x={s(113)} y={v(8)} width={s(12)} height={v(52)} rx={s(2)} />
      <rect x={s(127)} y={v(20)} width={s(9)} height={v(40)} rx={s(2)} />
      <rect x={s(90)} y={v(62)} width={s(46)} height={v(3)} rx={s(1)} />
    </g>
  );

  if (pattern === "progress") return (
    <g opacity={opacity} fill={hex}>
      <rect x={s(88)} y={v(15)} width={s(50)} height={v(7)} rx={s(3.5)} />
      <rect x={s(88)} y={v(28)} width={s(38)} height={v(7)} rx={s(3.5)} />
      <rect x={s(88)} y={v(41)} width={s(44)} height={v(7)} rx={s(3.5)} />
      <rect x={s(88)} y={v(54)} width={s(28)} height={v(7)} rx={s(3.5)} />
      <rect x={s(88)} y={v(67)} width={s(42)} height={v(7)} rx={s(3.5)} />
      <rect x={s(88)} y={v(80)} width={s(20)} height={v(7)} rx={s(3.5)} />
    </g>
  );

  if (pattern === "bubbles") return (
    <g opacity={opacity}>
      <rect x={s(85)} y={v(12)} width={s(46)} height={v(28)} rx={s(8)} fill={hex} />
      <polygon points={`${s(90)},${v(40)} ${s(96)},${v(50)} ${s(102)},${v(40)}`} fill={hex} />
      <rect x={s(95)} y={v(55)} width={s(40)} height={v(22)} rx={s(7)} fill={hex} />
      <polygon points={`${s(128)},${v(55)} ${s(132)},${v(45)} ${s(136)},${v(55)}`} fill={hex} />
    </g>
  );

  if (pattern === "screen") return (
    <g opacity={opacity}>
      <rect x={s(86)} y={v(18)} width={s(52)} height={v(38)} rx={s(5)} fill={hex} />
      <polygon
        points={`${s(102)},${v(27)} ${s(102)},${v(46)} ${s(119)},${v(37)}`}
        fill="var(--bg-base)"
        opacity={0.4 / opacity}
      />
      <rect x={s(103)} y={v(60)} width={s(18)} height={v(4)} rx={s(2)} fill={hex} />
      <rect x={s(87)} y={v(68)} width={s(50)} height={v(5)} rx={s(2.5)} fill={hex} />
    </g>
  );

  if (pattern === "ebook") return (
    <g opacity={opacity}>
      <rect x={s(88)} y={v(14)} width={s(46)} height={v(60)} rx={s(5)} fill={hex} />
      <rect x={s(93)} y={v(20)} width={s(36)} height={v(48)} rx={s(3)} fill="var(--bg-base)" opacity={0.35 / opacity} />
      <line x1={s(97)} y1={v(28)} x2={s(121)} y2={v(28)} stroke={hex} strokeWidth={s(2)} strokeLinecap="round" opacity={0.6 / opacity} />
      <line x1={s(97)} y1={v(35)} x2={s(118)} y2={v(35)} stroke={hex} strokeWidth={s(2)} strokeLinecap="round" opacity={0.6 / opacity} />
      <line x1={s(97)} y1={v(42)} x2={s(121)} y2={v(42)} stroke={hex} strokeWidth={s(2)} strokeLinecap="round" opacity={0.6 / opacity} />
      <circle cx={s(111)} cy={v(80)} r={s(4)} fill={hex} />
    </g>
  );

  if (pattern === "openbook") return (
    <g opacity={opacity} fill={hex}>
      <path d={`M ${s(111)} ${v(25)} Q ${s(111)} ${v(20)} ${s(116)} ${v(20)} L ${s(134)} ${v(20)} Q ${s(139)} ${v(20)} ${s(139)} ${v(25)} L ${s(139)} ${v(70)} Q ${s(139)} ${v(75)} ${s(134)} ${v(75)} L ${s(116)} ${v(75)} Q ${s(111)} ${v(75)} ${s(111)} ${v(70)} Z`} />
      <path d={`M ${s(111)} ${v(25)} Q ${s(111)} ${v(20)} ${s(106)} ${v(20)} L ${s(88)} ${v(20)} Q ${s(83)} ${v(20)} ${s(83)} ${v(25)} L ${s(83)} ${v(70)} Q ${s(83)} ${v(75)} ${s(88)} ${v(75)} L ${s(106)} ${v(75)} Q ${s(111)} ${v(75)} ${s(111)} ${v(70)} Z`} />
    </g>
  );

  if (pattern === "stars") return (
    <g opacity={opacity} fill={hex}>
      {[
        [118, 18, 7],
        [136, 32, 5],
        [105, 38, 5],
        [128, 52, 6],
        [115, 68, 4],
        [138, 70, 4],
      ].map(([cx, cy, r], i) => {
        const points = Array.from({ length: 5 }, (_, k) => {
          const angle = (k * 72 - 90) * (Math.PI / 180);
          const innerAngle = (k * 72 - 90 + 36) * (Math.PI / 180);
          return [
            `${s(cx + r * Math.cos(angle))},${v(cy + r * Math.sin(angle))}`,
            `${s(cx + r * 0.4 * Math.cos(innerAngle))},${v(cy + r * 0.4 * Math.sin(innerAngle))}`,
          ];
        }).flat().join(" ");
        return <polygon key={i} points={points} />;
      })}
    </g>
  );

  return null;
}
