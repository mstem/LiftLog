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

/** Shades a band of the arm's sideways raise, e.g. the 60–120° painful arc. */
export default function ArmArcDiagram(props: {
  from: number;
  to: number;
  painLabel: string;
  noPainLabel: string;
  accessibilityLabel: string;
}) {
  const { colors } = useAppTheme();
  const bandStart = point(props.from, armLength);
  const raised = point((props.from + props.to) / 2, armLength);
  const labels = [0, props.from, props.to, 180];

  return (
    <Svg
      width="100%"
      height={225}
      viewBox="0 0 240 225"
      accessible
      accessibilityLabel={props.accessibilityLabel}
    >
      <Path
        d={`M ${shoulder.x} ${shoulder.y} L ${bandStart.x} ${bandStart.y} ${arc(
          props.from,
          props.to,
          armLength,
        ).replace(/^M [^A]+/, '')} Z`}
        fill={colors.errorContainer}
        stroke={colors.error}
        strokeWidth={1}
      />
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
      {/* Raised arm, inside the band */}
      <Line
        x1={shoulder.x}
        y1={shoulder.y}
        x2={raised.x}
        y2={raised.y}
        stroke={colors.error}
        strokeWidth={4}
        strokeLinecap="round"
      />
      {[
        {
          deg: (props.from + props.to) / 2 + 12,
          text: props.painLabel,
          color: colors.error,
        },
        {
          deg: props.from / 2,
          text: props.noPainLabel,
          color: colors.onSurfaceVariant,
        },
        {
          deg: (props.to + 180) / 2,
          text: props.noPainLabel,
          color: colors.onSurfaceVariant,
        },
      ].map(({ deg, text, color }) => {
        const p = point(deg, armLength * 0.68);
        return (
          <SvgText
            key={`zone-${deg}`}
            x={p.x}
            y={p.y + 4}
            fontSize={11}
            fontWeight="bold"
            fill={color}
            textAnchor="middle"
          >
            {text}
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
            fill={
              deg === props.from || deg === props.to
                ? colors.error
                : colors.onSurfaceVariant
            }
            textAnchor="middle"
          >
            {`${deg}°`}
          </SvgText>
        );
      })}
    </Svg>
  );
}
