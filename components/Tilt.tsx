import type { ReactNode } from 'react';

/** On a device there is no pointer to lean toward: the document just sits there. */
export function Tilt({ children }: { children: ReactNode; max?: number }) {
  return <>{children}</>;
}
