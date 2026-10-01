/**
 * SVG transforms as plain strings. react-native-svg's own `origin`, `rotation`
 * and `scale` props don't reach the browser's DOM intact, so a rotation about
 * a point ends up about the wrong one on the web. A transform string means
 * the same thing on every platform.
 */

const n = (value: number) => Number(value.toFixed(3));

export const translate = (x: number, y: number) => `translate(${n(x)} ${n(y)})`;

/** Turn by `degrees` about the point (cx, cy). */
export const rotateAbout = (degrees: number, cx: number, cy: number) =>
  `rotate(${n(degrees)} ${n(cx)} ${n(cy)})`;

/** Scale by `factor` about the point (cx, cy). */
export const scaleAbout = (factor: number, cx: number, cy: number) =>
  `translate(${n(cx * (1 - factor))} ${n(cy * (1 - factor))}) scale(${n(factor)})`;
