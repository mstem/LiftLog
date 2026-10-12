import { useAppTheme } from '@/hooks/useAppTheme';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

// Front view of a person raising one arm out to the side. Angles are measured
// from the arm hanging down (0°) to straight overhead (180°).
const shoulder = { x: 110, y: 110 };
const armLength = 75;

function point(degrees: number, radius: number) {
  const r = (degrees * Math.PI) / 180;
  return {
    x: shoulder.x + radius * Math.sin(r),
    y: shoulder.y + radius * Math.cos(r),
  };
}

function arc(from: number, to: number, radius: number) {
  const a = point(from, radius);
  const b = point(to, radius);
  return `M ${a.x} ${a.y} A ${radius} ${radius} 0 0 0 ${b.x} ${b.y}`;
}

function wedge(from: number, to: number) {
  const start = point(from, armLength);
  return `M ${shoulder.x} ${shoulder.y} L ${start.x} ${start.y} ${arc(
    from,
    to,
    armLength,
  ).replace(/^M [^A]+/, '')} Z`;
}

/** Shades labelled bands of the arm's sideways raise, e.g. 60–120°. */
export default function ArmArcDiagram(props: {
  bands: { from: number; to: number; label: string }[];
  accessibilityLabel: string;
}) {
  const { colors } = useAppTheme();
  // Bands alternate colours so neighbours stay apart.
  const tone = (i: number) =>
    i % 2 === 0
      ? { fill: colors.errorContainer, stroke: colors.error }
      : { fill: colors.tertiaryContainer, stroke: colors.tertiary };
  const labels = [
    ...new Set([0, ...props.bands.flatMap((b) => [b.from, b.to]), 180]),
  ];

  return (
    <Svg
      width="100%"
      height={225}
      viewBox="0 0 240 225"
      accessible
      accessibilityLabel={props.accessibilityLabel}
    >
      {props.bands.map((b, i) => (
        <Path
          key={`band-${b.from}`}
          d={wedge(b.from, b.to)}
          fill={tone(i).fill}
          stroke={tone(i).stroke}
          strokeWidth={1}
        />
      ))}
      <Path
        d={`${arc(0, 90, armLength)} ${arc(90, 180, armLength).replace(/^M/, 'L')}`}
        stroke={colors.onSurfaceVariant}
        strokeWidth={1}
        strokeDasharray="4 4"
        fill="none"
      />
      {/* Body */}
      <Circle
        cx={95}
        cy={78}
        r={13}
        stroke={colors.onSurface}
        strokeWidth={3}
        fill="none"
      />
      <Line
        x1={95}
        y1={91}
        x2={95}
        y2={170}
        stroke={colors.onSurface}
        strokeWidth={3}
      />
      <Line
        x1={80}
        y1={110}
        x2={110}
        y2={110}
        stroke={colors.onSurface}
        strokeWidth={3}
      />
      <Line
        x1={80}
        y1={110}
        x2={77}
        y2={175}
        stroke={colors.onSurface}
        strokeWidth={3}
      />
      <Line
        x1={95}
        y1={170}
        x2={83}
        y2={220}
        stroke={colors.onSurface}
        strokeWidth={3}
      />
      <Line
        x1={95}
        y1={170}
        x2={107}
        y2={220}
        stroke={colors.onSurface}
        strokeWidth={3}
      />
      {/* The arm being tested, hanging at the start of the raise */}
      <Line
        x1={shoulder.x}
        y1={shoulder.y}
        x2={point(0, armLength).x}
        y2={point(0, armLength).y}
        stroke={colors.onSurface}
        strokeWidth={4}
        strokeLinecap="round"
      />
      {props.bands.map((b, i) => {
        const p = point((b.from + b.to) / 2, armLength * 0.68);
        return (
          <SvgText
            key={`label-${b.from}`}
            x={p.x}
            y={p.y + 4}
            fontSize={11}
            fontWeight="bold"
            fill={tone(i).stroke}
            textAnchor="middle"
          >
            {b.label}
          </SvgText>
        );
      })}
      {labels.map((deg) => {
        const p = point(deg, armLength + 17);
        // 0° and 180° sit on the body's line, so they move clear of it.
        const nudge = deg === 0 || deg === 180 ? 16 : 0;
        return (
          <SvgText
            key={deg}
            x={p.x + nudge}
            y={p.y + 4}
            fontSize={12}
            fill={colors.onSurfaceVariant}
            textAnchor="middle"
          >
            {`${deg}°`}
          </SvgText>
        );
      })}
    </Svg>
  );
}
