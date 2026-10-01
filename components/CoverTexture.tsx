import { StyleSheet, View } from 'react-native';
import Svg, { Ellipse, G } from 'react-native-svg';
import { rotateAbout } from '../lib/svgTransform';
import { colors } from '../lib/theme';

const SIZE = 420;
const C = SIZE / 2;
const TURNS = 36;

const ROSETTE = Array.from({ length: TURNS }, (_, k) => k);

/**
 * The embossed rosette a passport's cover carries, as a ghost in the corner of
 * a screen: thirty-six thin ellipses turned about one point, in the cover's own
 * rule colour so it is felt more than seen. It adds no depth (the cover stays
 * flat), only the sense that this green is a printed object, and it sits
 * partly off the screen so it never frames anything.
 */
export function CoverTexture() {
  return (
    <View
      pointerEvents="none"
      style={styles.corner}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <G fill="none" stroke={colors.border} strokeWidth={0.8} opacity={0.45}>
          {ROSETTE.map((k) => (
            <Ellipse key={k} cx={C} cy={C} rx={C - 6} ry={(C - 6) * 0.34} transform={rotateAbout((k * 180) / TURNS, C, C)} />
          ))}
          <Ellipse cx={C} cy={C} rx={C * 0.2} ry={C * 0.2} />
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  corner: { position: 'absolute', top: -150, right: -170, width: SIZE, height: SIZE },
});
