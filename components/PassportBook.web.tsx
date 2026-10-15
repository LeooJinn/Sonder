import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { Animated } from 'react-native';
import { useReducedMotion } from '../lib/motion';
import { fonts, object } from '../lib/theme';
import {
  ChapterTwoPage,
  DataPrintPage,
  EndpaperPage,
  LogLeftPage,
  LogRightPage,
  PAGE_H as BH,
  PAGE_W as BW,
  SoldPage,
  type BookStage,
} from './BookPages';

/**
 * The passport, as an object you can look at (web). A real 3D thing: a lit
 * cover with stamped foil, a block of cut pages, leaves hinged at the spine,
 * and a soft shadow on the desk. Depth is allowed here and only here: see
 * "The Object Rule" in DESIGN.md. Everything is CSS transforms, so there is
 * no 3D library and nothing to download.
 *
 * `story` is the page's scroll clock, in events: 0 is the first life event,
 * negative is the lead-in (the closed book on the front page), and each
 * whole number after is the next event. It opens the cover, turns the leaves
 * and writes the entries; with no `story` the book rests closed and only
 * answers the pointer. Updates are written straight to the DOM from one
 * animation loop, so scrolling never re-renders the page.
 */

const T = 26; // thickness of the closed book
const OPEN: [number, number] = [-0.75, -0.05];
const FLIP1: [number, number] = [0.55, 0.95];
const FLIP2: [number, number] = [2.55, 2.95];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const seg = (v: number, [from, to]: [number, number]) => clamp((v - from) / (to - from), 0, 1);
/** A page turning accelerates and settles: ease in-out, cubic. */
const turn = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function stageFor(u: number): BookStage {
  return u >= 3.9 ? 4 : u >= 2.95 ? 3 : u >= 1.9 ? 2 : u >= 0.95 ? 1 : 0;
}

const hinged: CSSProperties = {
  position: 'absolute',
  inset: 0,
  transformOrigin: 'left center',
  transformStyle: 'preserve-3d',
};

const face = (extra?: CSSProperties): CSSProperties => ({
  position: 'absolute',
  inset: 0,
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden',
  overflow: 'hidden',
  ...extra,
});

/** Gold foil: three tones swept across the lettering, shifted as the light moves. */
const foil: CSSProperties = {
  backgroundImage: `linear-gradient(105deg, ${object.foilDark} 0%, ${object.foilMid} 16%, ${object.foilLight} 32%, ${object.foilMid} 46%, ${object.foilDark} 60%, ${object.foilMid} 76%, ${object.foilLight} 90%, ${object.foilMid} 100%)`,
  backgroundSize: '280% 100%',
  backgroundPosition: 'calc(var(--fx, 50) * 1%) 50%',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
  WebkitTextFillColor: 'transparent',
  filter: 'drop-shadow(0 1px 0 rgba(245,232,184,0.14)) drop-shadow(0 -1px 0 rgba(5,14,11,0.55))',
};

const shadeStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: object.contact,
  opacity: 0,
  pointerEvents: 'none',
};

export function PassportBook({ story, restAt = -1 }: { story?: Animated.Value; restAt?: number }) {
  const reduced = useReducedMotion();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [stage, setStage] = useState<BookStage>(0);

  const root = useRef<HTMLDivElement>(null);
  const rig = useRef<HTMLDivElement>(null);
  const book = useRef<HTMLDivElement>(null);
  const cover = useRef<HTMLDivElement>(null);
  const leaf1 = useRef<HTMLDivElement>(null);
  const leaf2 = useRef<HTMLDivElement>(null);
  const shadow = useRef<HTMLDivElement>(null);
  const coverShade = useRef<HTMLDivElement>(null);
  const coverBack = useRef<HTMLDivElement>(null);
  const shades = useRef<(HTMLDivElement | null)[]>([]);

  const live = useRef({ u: restAt, px: 0, py: 0, tx: 0, ty: 0, w: 600, h: 600, visible: true });

  // The story clock: kept in a ref for the animation loop; only the stage (which
  // entries are written) is React state, and it changes a handful of times.
  useEffect(() => {
    if (!story) return;
    const apply = (value: number) => {
      live.current.u = value;
      setStage((current) => (stageFor(value) === current ? current : stageFor(value)));
    };
    apply((story as unknown as { __getValue(): number }).__getValue());
    const id = story.addListener(({ value }) => apply(value));
    return () => story.removeListener(id);
  }, [story]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => {
      live.current.w = el.clientWidth;
      live.current.h = el.clientHeight;
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(el);
    const watch = new IntersectionObserver(([entry]) => {
      live.current.visible = entry.isIntersecting;
    });
    watch.observe(el);
    return () => {
      resize.disconnect();
      watch.disconnect();
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    let smoothed = { x: 0, y: 0 };

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const s = live.current;
      if (!s.visible) return;
      const u = s.u;
      const o = turn(seg(u, OPEN));
      const f1 = turn(seg(u, FLIP1));
      const f2 = turn(seg(u, FLIP2));

      // The pointer leans the whole book, gently; a still book under reduced motion.
      smoothed = reduced
        ? { x: 0, y: 0 }
        : { x: smoothed.x + (s.tx - smoothed.x) * 0.07, y: smoothed.y + (s.ty - smoothed.y) * 0.07 };
      const bob = reduced ? 0 : Math.sin(now / 1800) * 5 * (1 - o);

      const sClosed = Math.min(s.w / (BW * 1.55), s.h / (BH * 1.42));
      const sOpen = Math.min(s.w / (BW * 2.18), s.h / (BH * 1.34));
      const scale = lerp(sClosed, sOpen, o);
      const rx = lerp(12, 31, o) - smoothed.y * lerp(8, 3, o);
      const ry = lerp(-30, -3, o) + smoothed.x * lerp(18, 6, o);
      const rz = lerp(-5, 0, o);

      if (rig.current) {
        rig.current.style.transform = `translate3d(0, ${bob + lerp(0, 22, o)}px, 0) scale(${scale}) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`;
      }
      if (book.current) book.current.style.transform = `translateX(${(o * BW) / 2}px)`;

      // Hinged parts: the angle turns each about the spine, and its height in the
      // stack swaps from the right-hand pile to the left-hand pile as it crosses.
      const place = (el: HTMLDivElement | null, f: number, zRight: number, zLeft: number) => {
        if (el) el.style.transform = `translateZ(${lerp(zRight, zLeft, f)}px) rotateY(${-178 * f}deg)`;
      };
      place(cover.current, o, T / 2, -T / 2 + 1);
      place(leaf1.current, f1, T / 2 - 2, -T / 2 + 3.5);
      place(leaf2.current, f2, T / 2 - 4, -T / 2 + 6);

      // A leaf is darker as it turns edge-on to the light.
      const edgeOn = (f: number) => Math.sin(f * Math.PI);
      const set = (i: number, opacity: number) => {
        const node = shades.current[i];
        if (node) node.style.opacity = String(clamp(opacity, 0, 0.6));
      };
      set(0, 0.12 + edgeOn(o) * 0.45); // cover, outside
      set(1, edgeOn(o) * 0.5 + (1 - o) * 0.5); // cover, inside
      set(2, edgeOn(f1) * 0.5 + f1 * 0.04); // leaf one, front
      set(3, edgeOn(f1) * 0.5 + (1 - f1) * 0.06); // leaf one, back
      set(4, edgeOn(f2) * 0.5 + f2 * 0.04); // leaf two, front
      set(5, edgeOn(f2) * 0.5 + (1 - f2) * 0.06); // leaf two, back

      // Foil catches the light as the book turns and as the pointer moves.
      const fx = 50 + ry * 1.6 + smoothed.x * 34;
      if (cover.current) {
        cover.current.style.setProperty('--fx', fx.toFixed(1));
        cover.current.style.setProperty('--lx', `${(50 + smoothed.x * 34 + ry * 0.7).toFixed(1)}%`);
        cover.current.style.setProperty('--ly', `${(32 - smoothed.y * 28).toFixed(1)}%`);
      }
      if (coverShade.current) coverShade.current.style.opacity = String(clamp(0.1 + o * 0.5, 0, 0.6));
      void coverBack;

      if (shadow.current) {
        shadow.current.style.transform = `translateX(-50%) scale(${lerp(0.78, 1.35, o)}, ${lerp(1, 0.7, o)})`;
        shadow.current.style.opacity = String(lerp(0.62, 0.5, o) - bob * 0.008);
        shadow.current.style.top = `calc(50% + ${BH * scale * lerp(0.58, 0.54, o) + bob * 0.4}px)`;
        shadow.current.style.width = `${BW * scale * lerp(1.2, 2.2, o)}px`;
      }
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  const onMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || event.pointerType === 'touch') return;
    const box = event.currentTarget.getBoundingClientRect();
    live.current.tx = clamp(((event.clientX - box.left) / box.width) * 2 - 1, -1, 1);
    live.current.ty = clamp(((event.clientY - box.top) / box.height) * 2 - 1, -1, 1);
  };
  const onLeave = () => {
    live.current.tx = 0;
    live.current.ty = 0;
  };

  const grain = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0.05  0 0 0 0 0.04  0 0 0 0.55 0'/></filter><rect width='160' height='160' filter='url(%23n)'/></svg>")`;
  const edgeStripes = (angle: number) =>
    `linear-gradient(${angle}deg, ${object.coverDeep} 0 3px, transparent 3px calc(100% - 3px), ${object.coverDeep} calc(100% - 3px)), repeating-linear-gradient(${angle}deg, ${object.pageEdge} 0 1.3px, ${object.pageEdgeShade} 1.3px 2.1px)`;

  const registerShade = (index: number) => (node: HTMLDivElement | null) => {
    shades.current[index] = node;
  };

  return (
    <div
      ref={root}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      aria-hidden
      style={{ position: 'relative', width: '100%', height: '100%', perspective: 2400, perspectiveOrigin: '50% 38%' }}
    >
      {/* the desk: a soft contact shadow, the one place a drop shadow is allowed */}
      <div
        ref={shadow}
        style={{
          position: 'absolute',
          left: '50%',
          height: 56,
          borderRadius: '50%',
          background: `radial-gradient(closest-side, ${object.contact}, transparent)`,
          filter: 'blur(10px)',
          pointerEvents: 'none',
        }}
      />

      <div
        ref={rig}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 0,
          height: 0,
          transformStyle: 'preserve-3d',
          willChange: 'transform',
        }}
      >
        <div
          ref={book}
          style={{ position: 'absolute', left: -BW / 2, top: -BH / 2, width: BW, height: BH, transformStyle: 'preserve-3d' }}
        >
          {/* back cover */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              transform: `translateZ(${-T / 2}px)`,
              borderRadius: '3px 10px 10px 3px',
              background: `linear-gradient(135deg, ${object.coverMid}, ${object.coverDeep})`,
            }}
          />

          {/* the cut edges of the page block: right, top and bottom */}
          <div style={{ position: 'absolute', left: BW - T / 2, top: 0, width: T, height: BH, transform: 'rotateY(90deg)', background: edgeStripes(90) }} />
          <div style={{ position: 'absolute', left: 0, top: -T / 2, width: BW, height: T, transform: 'rotateX(90deg)', background: edgeStripes(0) }} />
          <div style={{ position: 'absolute', left: 0, top: BH - T / 2, width: BW, height: T, transform: 'rotateX(90deg)', background: edgeStripes(0) }} />
          {/* the spine */}
          <div style={{ position: 'absolute', left: -T / 2, top: 0, width: T, height: BH, transform: 'rotateY(90deg)', background: `linear-gradient(90deg, ${object.coverDeep}, ${object.coverMid} 50%, ${object.coverDeep})` }} />

          {/* sheets under the last page, so the block has body */}
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                inset: 0,
                transform: `translateZ(${-T / 2 + 2.5 + i * 3.2}px)`,
                background: i % 2 ? object.pageEdge : object.pageEdgeShade,
                borderRadius: '0 8px 8px 0',
              }}
            />
          ))}

          {/* the last page, always there */}
          <div style={{ position: 'absolute', inset: 0, transform: `translateZ(${-T / 2 + 14}px)`, overflow: 'hidden' }}>
            <ChapterTwoPage stage={stage} />
          </div>

          {/* leaf two: log (right) / chapter closed (left) */}
          <div ref={leaf2} style={hinged}>
            <div style={face()}>
              <LogRightPage stage={stage} />
              <div ref={registerShade(4)} style={shadeStyle} />
            </div>
            <div style={face({ transform: 'rotateY(180deg)' })}>
              <SoldPage stage={stage} />
              <div ref={registerShade(5)} style={shadeStyle} />
            </div>
          </div>

          {/* leaf one: the data page (right) / the log opens (left) */}
          <div ref={leaf1} style={hinged}>
            <div style={face()}>
              <DataPrintPage />
              <div ref={registerShade(2)} style={shadeStyle} />
            </div>
            <div style={face({ transform: 'rotateY(180deg)' })}>
              <LogLeftPage stage={stage} />
              <div ref={registerShade(3)} style={shadeStyle} />
            </div>
          </div>

          {/* the front cover */}
          <div ref={cover} style={hinged}>
            <div
              style={face({
                borderRadius: '3px 10px 10px 3px',
                background: `radial-gradient(120% 90% at 28% 18%, ${object.coverLit} 0%, ${object.coverMid} 48%, ${object.coverDeep} 100%)`,
                boxShadow: 'inset 0 0 0 1px rgba(232,237,229,0.06), inset -5px 0 12px rgba(5,14,11,0.35)',
              })}
            >
              {/* leather grain */}
              <div style={{ position: 'absolute', inset: 0, backgroundImage: grain, mixBlendMode: 'multiply', opacity: 0.5 }} />
              {/* the engraved rosette, pressed into the cloth */}
              <svg
                viewBox="0 0 420 420"
                width={BW * 0.98}
                height={BW * 0.98}
                style={{ position: 'absolute', left: BW * 0.01, top: BH * 0.5 - BW * 0.49 + 8 }}
              >
                <g fill="none">
                  {Array.from({ length: 36 }, (_, k) => (
                    <g key={k} transform={`rotate(${(k * 180) / 36} 210 210)`}>
                      <ellipse cx="211" cy="212" rx="204" ry="69" stroke="rgba(245,232,184,0.07)" strokeWidth="1.1" />
                      <ellipse cx="210" cy="210" rx="204" ry="69" stroke="rgba(5,14,11,0.55)" strokeWidth="1.2" />
                    </g>
                  ))}
                </g>
              </svg>
              {/* foil: the wordmark, the S, the document type, the chip mark */}
              <div style={{ position: 'absolute', top: 40, left: 0, right: 0, textAlign: 'center' }}>
                <div style={{ ...foil, fontFamily: fonts.displayBold, fontSize: 44, lineHeight: '44px', letterSpacing: 2 }}>Sonder</div>
                <div style={{ ...foil, fontFamily: fonts.display, fontSize: 15, letterSpacing: 6, marginTop: 8 }}>Vehicle passport</div>
              </div>
              <div
                style={{
                  ...foil,
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: BH * 0.5 - 84,
                  textAlign: 'center',
                  fontFamily: fonts.displayBold,
                  fontSize: 168,
                  lineHeight: '168px',
                }}
              >
                S
              </div>
              <svg viewBox="0 0 44 28" width="44" height="28" style={{ position: 'absolute', left: BW / 2 - 22, bottom: 36 }}>
                <defs>
                  <linearGradient id={`${uid}chip`} x1="0" x2="1">
                    <stop offset="0" stopColor={object.foilDark} />
                    <stop offset="0.4" stopColor={object.foilLight} />
                    <stop offset="1" stopColor={object.foilMid} />
                  </linearGradient>
                </defs>
                <g fill="none" stroke={`url(#${uid}chip)`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="1" width="42" height="26" rx="6" />
                  <path d="M10 18h24M13 18l3-5h12l3 5M14 18v2M30 18v2" />
                </g>
              </svg>
              {/* the light: a soft highlight that follows the pointer */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'radial-gradient(55% 38% at var(--lx, 50%) var(--ly, 30%), rgba(245,232,184,0.2), transparent 72%)',
                  mixBlendMode: 'soft-light',
                  pointerEvents: 'none',
                }}
              />
              {/* the spine's hinge */}
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 16, background: 'linear-gradient(90deg, rgba(5,14,11,0.5), transparent)' }} />
              <div ref={registerShade(0)} style={shadeStyle} />
            </div>
            <div style={face({ transform: 'rotateY(180deg)' })} ref={coverBack}>
              <EndpaperPage />
              <div ref={registerShade(1)} style={shadeStyle} />
            </div>
          </div>
          <div ref={coverShade} style={{ display: 'none' }} />
        </div>
      </div>
    </div>
  );
}
