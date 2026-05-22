import type { FolderPattern } from "../types";

interface Props {
  pattern: FolderPattern;
  hex: string;
  /** true = small 80×44 preview in modal, false = full 150×100 card */
  preview?: boolean;
}

export function FolderPatternSVG({ pattern, hex, preview = false }: Props) {
  if (pattern === "none") return null;

  const scale = preview ? 80 / 150 : 1;
  const sh = preview ? 44 / 100 : 1;

  const s = (x: number) => x * scale;
  const v = (y: number) => y * sh;

  const opacity = 0.13;
  const W = preview ? 80 : 150;
  const H = preview ? 44 : 100;

  if (pattern === "chevron") {
    const tw = preview ? 80 / 150 * 40 : 40;
    const th = preview ? 44 / 100 * 12 : 12;
    const id = `chevron-${hex.slice(1)}-${preview ? "p" : "c"}`;
    return (
      <g opacity={opacity}>
        <defs>
          <pattern id={id} x="0" y="0" width={tw / W} height={th / H} patternUnits="objectBoundingBox">
            <svg width={tw} height={th} viewBox="0 0 40 12">
              <path
                d="M0 6.172L6.172 0h5.656L0 11.828V6.172zm40 5.656L28.172 0h5.656L40 6.172v5.656zM6.172 12l12-12h3.656l12 12h-5.656L20 3.828 11.828 12H6.172zm12 0L20 10.172 21.828 12h-3.656z"
                fill={hex}
                fillRule="evenodd"
              />
            </svg>
          </pattern>
        </defs>
        <rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
      </g>
    );
  }

  if (pattern === "jigsaw") {
    const tw = preview ? 80 / 150 * 64 : 64;
    const th = preview ? 44 / 100 * 64 : 64;
    const id = `jigsaw-${hex.slice(1)}-${preview ? "p" : "c"}`;
    return (
      <g opacity={opacity}>
        <defs>
          <pattern id={id} x="0" y="0" width={tw / W} height={th / H} patternUnits="objectBoundingBox">
            <svg width={tw} height={th} viewBox="0 0 192 192">
              <path
                fill={hex}
                d="M192 15v2a11 11 0 0 0-11 11c0 1.94 1.16 4.75 2.53 6.11l2.36 2.36a6.93 6.93 0 0 1 1.22 7.56l-.43.84a8.08 8.08 0 0 1-6.66 4.13H145v35.02a6.1 6.1 0 0 0 3.03 4.87l.84.43c1.58.79 4 .4 5.24-.85l2.36-2.36a12.04 12.04 0 0 1 7.51-3.11 13 13 0 1 1 .02 26 12 12 0 0 1-7.53-3.11l-2.36-2.36a4.93 4.93 0 0 0-5.24-.85l-.84.43a6.1 6.1 0 0 0-3.03 4.87V143h35.02a8.08 8.08 0 0 1 6.66 4.13l.43.84a6.91 6.91 0 0 1-1.22 7.56l-2.36 2.36A10.06 10.06 0 0 0 181 164a11 11 0 0 0 11 11v2a13 13 0 0 1-13-13 12 12 0 0 1 3.11-7.53l2.36-2.36a4.93 4.93 0 0 0 .85-5.24l-.43-.84a6.1 6.1 0 0 0-4.87-3.03H145v35.02a8.08 8.08 0 0 1-4.13 6.66l-.84.43a6.91 6.91 0 0 1-7.56-1.22l-2.36-2.36A10.06 10.06 0 0 0 124 181a11 11 0 0 0-11 11h-2a13 13 0 0 1 13-13c2.47 0 5.79 1.37 7.53 3.11l2.36 2.36a4.94 4.94 0 0 0 5.24.85l.84-.43a6.1 6.1 0 0 0 3.03-4.87V145h-35.02a8.08 8.08 0 0 1-6.66-4.13l-.43-.84a6.91 6.91 0 0 1 1.22-7.56l2.36-2.36A10.06 10.06 0 0 0 107 124a11 11 0 0 0-22 0c0 1.94 1.16 4.75 2.53 6.11l2.36 2.36a6.93 6.93 0 0 1 1.22 7.56l-.43.84a8.08 8.08 0 0 1-6.66 4.13H49v35.02a6.1 6.1 0 0 0 3.03 4.87l.84.43c1.58.79 4 .4 5.24-.85l2.36-2.36a12.04 12.04 0 0 1 7.51-3.11A13 13 0 0 1 81 192h-2a11 11 0 0 0-11-11c-1.94 0-4.75 1.16-6.11 2.53l-2.36 2.36a6.93 6.93 0 0 1-7.56 1.22l-.84-.43a8.08 8.08 0 0 1-4.13-6.66V145H11.98a6.1 6.1 0 0 0-4.87 3.03l-.43.84c-.79 1.58-.4 4 .85 5.24l2.36 2.36a12.04 12.04 0 0 1 3.11 7.51A13 13 0 0 1 0 177v-2a11 11 0 0 0 11-11c0-1.94-1.16-4.75-2.53-6.11l-2.36-2.36a6.93 6.93 0 0 1-1.22-7.56l.43-.84a8.08 8.08 0 0 1 6.66-4.13H47v-35.02a6.1 6.1 0 0 0-3.03-4.87l-.84-.43c-1.59-.8-4-.4-5.24.85l-2.36 2.36A12 12 0 0 1 28 109a13 13 0 1 1 0-26c2.47 0 5.79 1.37 7.53 3.11l2.36 2.36a4.94 4.94 0 0 0 5.24.85l.84-.43A6.1 6.1 0 0 0 47 84.02V49H11.98a8.08 8.08 0 0 1-6.66-4.13l-.43-.84a6.91 6.91 0 0 1 1.22-7.56l2.36-2.36A10.06 10.06 0 0 0 11 28 11 11 0 0 0 0 17v-2a13 13 0 0 1 13 13c0 2.47-1.37 5.79-3.11 7.53l-2.36 2.36a4.94 4.94 0 0 0-.85 5.24l.43.84A6.1 6.1 0 0 0 11.98 47H47V11.98a8.08 8.08 0 0 1 4.13-6.66l.84-.43a6.91 6.91 0 0 1 7.56 1.22l2.36 2.36A10.06 10.06 0 0 0 68 11 11 11 0 0 0 79 0h2a13 13 0 0 1-13 13 12 12 0 0 1-7.53-3.11l-2.36-2.36a4.93 4.93 0 0 0-5.24-.85l-.84.43A6.1 6.1 0 0 0 49 11.98V47h35.02a8.08 8.08 0 0 1 6.66 4.13l.43.84a6.91 6.91 0 0 1-1.22 7.56l-2.36 2.36A10.06 10.06 0 0 0 85 68a11 11 0 0 0 22 0c0-1.94-1.16-4.75-2.53-6.11l-2.36-2.36a6.93 6.93 0 0 1-1.22-7.56l.43-.84a8.08 8.08 0 0 1 6.66-4.13H143V11.98a6.1 6.1 0 0 0-3.03-4.87l-.84-.43c-1.59-.8-4-.4-5.24.85l-2.36 2.36A12 12 0 0 1 124 13a13 13 0 0 1-13-13h2a11 11 0 0 0 11 11c1.94 0 4.75-1.16 6.11-2.53l2.36-2.36a6.93 6.93 0 0 1 7.56-1.22l.84.43a8.08 8.08 0 0 1 4.13 6.66V47h35.02a6.1 6.1 0 0 0 4.87-3.03l.43-.84c.8-1.59.4-4-.85-5.24l-2.36-2.36A12 12 0 0 1 179 28a13 13 0 0 1 13-13zM84.02 143a6.1 6.1 0 0 0 4.87-3.03l.43-.84c.8-1.59.4-4-.85-5.24l-2.36-2.36A12 12 0 0 1 83 124a13 13 0 1 1 26 0c0 2.47-1.37 5.79-3.11 7.53l-2.36 2.36a4.94 4.94 0 0 0-.85 5.24l.43.84a6.1 6.1 0 0 0 4.87 3.03H143v-35.02a8.08 8.08 0 0 1 4.13-6.66l.84-.43a6.91 6.91 0 0 1 7.56 1.22l2.36 2.36A10.06 10.06 0 0 0 164 107a11 11 0 0 0 0-22c-1.94 0-4.75 1.16-6.11 2.53l-2.36 2.36a6.93 6.93 0 0 1-7.56 1.22l-.84-.43a8.08 8.08 0 0 1-4.13-6.66V49h-35.02a6.1 6.1 0 0 0-4.87 3.03l-.43.84c-.79 1.58-.4 4 .85 5.24l2.36 2.36a12.04 12.04 0 0 1 3.11 7.51A13 13 0 1 1 83 68a12 12 0 0 1 3.11-7.53l2.36-2.36a4.93 4.93 0 0 0 .85-5.24l-.43-.84A6.1 6.1 0 0 0 84.02 49H49v35.02a8.08 8.08 0 0 1-4.13 6.66l-.84.43a6.91 6.91 0 0 1-7.56-1.22l-2.36-2.36A10.06 10.06 0 0 0 28 85a11 11 0 0 0 0 22c1.94 0 4.75-1.16 6.11-2.53l2.36-2.36a6.93 6.93 0 0 1 7.56-1.22l.84.43a8.08 8.08 0 0 1 4.13 6.66V143h35.02z"
              />
            </svg>
          </pattern>
        </defs>
        <rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
      </g>
    );
  }

  if (pattern === "hexagon") {
    const tw = preview ? 80 / 150 * 20 : 20;
    const th = preview ? 44 / 100 * 29.714 : 29.714;
    const id = `hexagon-${hex.slice(1)}-${preview ? "p" : "c"}`;
    return (
      <g opacity={opacity}>
        <defs>
          <pattern id={id} x="0" y="0" width={tw / W} height={th / H} patternUnits="objectBoundingBox">
            <svg width={tw} height={th} viewBox="0 0 40 59.428">
              <path
                fill="none"
                stroke={hex}
                strokeLinecap="square"
                strokeWidth="3"
                d="M0 70.975V47.881m20-1.692L8.535 52.808v13.239L20 72.667l11.465-6.62V52.808zm0-32.95 11.465-6.62V-6.619L20-13.24 8.535-6.619V6.619L20 13.24m8.535 4.927v13.238L40 38.024l11.465-6.62V18.166L40 11.546zM20 36.333 0 47.88m0 0v23.094m0 0 20 11.548 20-11.548V47.88m0 0L20 36.333m0 0 20 11.549M0 11.547l-11.465 6.619v13.239L0 38.025l11.465-6.62v-13.24L0 11.548v-23.094l20-11.547 20 11.547v23.094M20 36.333V13.24"
              />
            </svg>
          </pattern>
        </defs>
        <rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
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
