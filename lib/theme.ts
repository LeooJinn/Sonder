/**
 * Shared design tokens. Every colour in the app comes from here so that
 * changing the palette is a one-file edit rather than a search-and-replace.
 */

import { Platform } from 'react-native';

export const colors = {
  background: '#12181F',
  surface: '#1A222B',
  border: '#2C3742',
  text: '#E6E9EC',
  textMuted: '#8D9BA8',
  textFaint: '#5C6B7A',
  accent: '#E0584B',
  disabled: '#3A444F',
} as const;

export const mono = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
