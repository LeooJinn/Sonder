import { useRef, type ReactNode } from 'react';
import { useReducedMotion } from '../lib/motion';

/**
 * A document that leans toward the pointer (web). For the one or two things
 * that are objects rather than interface: a real passport shown on the front
 * page. It turns a few degrees about its centre and settles back, like a card
 * held in the hand. Still under reduced motion.
 */
export function Tilt({ children, max = 7 }: { children: ReactNode; max?: number }) {
  const reduced = useReducedMotion();
  const card = useRef<HTMLDivElement>(null);

  const onMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || event.pointerType === 'touch' || !card.current) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    card.current.style.transition = 'transform 120ms ease-out';
    card.current.style.transform = `rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg)`;
  };
  const onLeave = () => {
    if (!card.current) return;
    card.current.style.transition = 'transform 520ms cubic-bezier(0.16, 1, 0.3, 1)';
    card.current.style.transform = 'rotateX(0deg) rotateY(0deg)';
  };

  return (
    <div onPointerMove={onMove} onPointerLeave={onLeave} style={{ perspective: 1400, width: '100%' }}>
      <div ref={card} style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}>
        {children}
      </div>
    </div>
  );
}
