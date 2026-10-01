import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../lib/theme';

const W = 400;
const H = 160;
const STEP = 5;

/** Two families of interlaced waves, the way a banknote's background is engraved. */
function curves(): string[] {
  const paths: string[] = [];
  for (const sign of [1, -1]) {
    for (let i = 0; i < 16; i++) {
      let d = '';
      for (let x = 0; x <= W; x += STEP) {
        const envelope = 0.5 + 0.5 * Math.cos(x * 0.0105 + i * 0.13 * sign);
        const y = H / 2 + sign * 50 * Math.sin(x * 0.031 + i * 0.2) * envelope + (i - 8) * 1.9 * sign;
        d += `${x === 0 ? 'M' : 'L'}${x} ${y.toFixed(1)} `;
      }
      paths.push(d);
    }
  }
  return paths;
}

const PATHS = curves();

/**
 * The engraved pattern printed behind a security document so it can't be
 * copied cleanly. Here it is what makes paper look printed rather than flat:
 * a fine interlace in the paper's own rule colour, faint enough that ink on
 * top never has to compete with it. Fills whatever it is placed in and sits
 * behind its content.
 */
export function Guilloche({ opacity = 0.34 }: { opacity?: number }) {
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        {PATHS.map((d, i) => (
          <Path key={i} d={d} fill="none" stroke={colors.paperLine} strokeWidth={0.7} opacity={opacity} />
        ))}
      </Svg>
    </View>
  );
}
