/**
 * How things move in Sonder.
 *
 * The app is modelled on two kinds of object: the instrument cluster (an
 * odometer's drums, a needle) and the paperwork a car accumulates (a rubber
 * stamp, a foil-printed page). Both move mechanically, not springily: a drum
 * rolls and catches, a stamp comes down hard and stays, foil catches the light
 * once as it turns. So motion here decelerates into place with no wobble, and
 * the only overshoot belongs to things that are physically struck or swung.
 *
 * Every animation checks useReducedMotion and, when it's on, lands in its
 * final state at once. Feedback that carries meaning (a colour change, a
 * state) stays; travel, drawing and sweeping don't.
 */

import { useEffect, useState } from 'react';
import { AccessibilityInfo, Easing, Platform } from 'react-native';

export const ease = {
  /** A confident arrival: fast off the mark, long settle. */
  out: Easing.bezier(0.16, 1, 0.3, 1),
  /** A drum catching its detent. */
  detent: Easing.bezier(0.2, 0.8, 0.2, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
};

export const duration = { quick: 140, base: 240, slow: 420, focal: 720 } as const;

/** Native can run transform and opacity off the JS thread; the web can't. */
export const nativeDriver = Platform.OS !== 'web';

/** Whether the person asked their device for less motion. Re-checks if they change it. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => live && setReduced(value))
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}

/** 0 before `from`, 1 after `to`, linear between: a sub-range of a 0..1 clock. */
export function seg(t: number, from: number, to: number): number {
  if (t <= from) return 0;
  if (t >= to) return 1;
  return (t - from) / (to - from);
}

/** Ease-out for a 0..1 value, in plain JS, for animations drawn frame by frame. */
export function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}
