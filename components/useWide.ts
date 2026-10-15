import { useWindowDimensions } from 'react-native';

/** The width at which the app has its side rail (see app/(tabs)/_layout.tsx) and lays out in columns. */
export const WIDE_BREAKPOINT = 900;

export function useWide(): boolean {
  return useWindowDimensions().width >= WIDE_BREAKPOINT;
}

/**
 * The width at which Messages shows the inbox and a conversation side by side.
 * The rail (236) and the inbox (400) leave the conversation what is left, and
 * below about 480px of that a conversation is unreadable, so between the rail
 * appearing and this width a conversation opens as a screen of its own.
 */
export const TWO_PANE_BREAKPOINT = 1120;

export function useTwoPane(): boolean {
  return useWindowDimensions().width >= TWO_PANE_BREAKPOINT;
}
