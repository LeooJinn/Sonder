import { useWindowDimensions } from 'react-native';

/** The width at which the app has its side rail (see app/(tabs)/_layout.tsx) and lays out in columns. */
export const WIDE_BREAKPOINT = 900;

export function useWide(): boolean {
  return useWindowDimensions().width >= WIDE_BREAKPOINT;
}
