import { useEffect, useRef } from 'react';
import type { SessionSnapshot } from './types';
import type { ExerciseState } from '../training/Exercise';

/**
 * Simulated RF spectrum card for the instructor sensor wall.
 * The waterfall is driven by simulation time and truth-entity presence (drone appearances);
 * it is a fictional visualization, not an RF receiver, and shows presence only — never affiliation.
 */
const BINS = 96, LINES = 120, STEP = 0.35;
const clock = (time: number) => `${Math.floor(time / 60).toString().padStart(2, '0')}:${Math.floor(time % 60).toString().padStart(2, '0')}`;

function hash(text: string) { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function jitter(value: number) { let h = value | 0; h = Math.imul(h ^ h >>> 15, 2246822519); h = Math.imul(h ^ h >>> 13, 3266489917); return ((h ^ h >>> 16) >>> 0) / 4294967295; }

interface Emitter { label: string; channel: number; strength: number; key: number; }

/** One deterministic emitter per airborne truth entity; scheduled/departed drones stay silent. */
function emittersOf(snapshot: SessionSnapshot): Emitter[] {
  return snapshot.tracks.filter(track => track.state === 'active').map(track => {
    const key = hash(snapshot.seed + ':' + track.id);
    return { label: track.label, channel: 10 + key % 74, strength: .5 + (key >>> 8) % 36 / 100, key };
  });
}

/** SDR-style Rainbow (jet) intensity ramp: dark navy noise floor -> green -> yellow -> red-hot peaks. */
function buildPalette() {
  const stops: Array<[number, [number, number, number]]> = [[0, [8, 8, 34]], [.16, [30, 34, 118]], [.34, [16, 116, 130]], [.52, [36, 186, 70]], [.68, [196, 196, 24]], [.82, [236, 122, 12]], [.94, [240, 38, 40]], [1, [255, 228, 170]]];
  const table = new Uint8Array(768);
  for (let value = 0; value < 256; value++) {
    const level = value / 255; let index = 0;
    while (index < stops.length - 2 && level > stops[index + 1][0]) index++;
    const [start, from] = stops[index], [end, to] = stops[index + 1], share = end === start ? 0 : Math.min(1, Math.max(0, (level - start) / (end - start)));
    for (let channel = 0; channel < 3; channel++) table[value * 3 + channel] = Math.round(from[channel] * (1 - share) + to[channel] * share);
  }
  return table;
}

export default function RFSpectrum({ snapshot, exercise }: { snapshot: SessionSnapshot; exercise: ExerciseState }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ snapshot, exercise });
  stateRef.current = { snapshot, exercise };
  const emitters = emittersOf(snapshot);
  const evidence = Object.values(exercise.evidenceByContact).flat().filter(item => item.source === 'rf').at(-1);
  useEffect(() => {
    const canvas = canvasRef.current!; if (!canvas) return;
    const context = canvas.getContext('2d')!; if (!context) return;
    const off = document.createElement('canvas'); off.width = BINS; off.height = LINES;
    const offContext = off.getContext('2d')!;
    const image = offContext.createImageData(BINS, LINES);
    const palette = buildPalette();
    const buffer = new Uint8Array(BINS * LINES);
    let head = 0, lastSim = stateRef.current.snapshot.time, lastPaint = 0, session = stateRef.current.snapshot.sessionId, raf = 0;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');

    function writeLine(time: number, list: Emitter[]) {
      const offset = head * BINS, scan = Math.floor(time / STEP), sync = list.length >= 2 && (time % 3) < 0.2;
      for (let bin = 0; bin < BINS; bin++) {
        let value = 30 + 22 * jitter(bin * 7919 + scan * 104729);
        for (const emitter of list) {
          let amplitude = emitter.strength * 255 * (0.72 + 0.28 * Math.sin(time * 2.2 + (emitter.key % 628) / 100));
          if ((Math.floor(time / 2.5) + (emitter.key % 7)) % 9 === 0) amplitude *= 0.15;
          if (sync) amplitude = Math.min(255, amplitude + 55);
          const near = bin - emitter.channel, far = bin - (emitter.channel + 10);
          value += amplitude * Math.exp(-near * near / 2.6) + 0.3 * amplitude * Math.exp(-far * far / 2);
        }
        buffer[offset + bin] = value > 255 ? 255 : value | 0;
      }
    }

    function paint() {
      const current = stateRef.current.snapshot;
      const list = emittersOf(current);
      const rect = canvas.getBoundingClientRect(), width = Math.max(1, Math.round(rect.width)), height = Math.max(1, Math.round(rect.height));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      for (let y = 0; y < LINES; y++) {
        const source = ((head - 1 - y + 2 * LINES) % LINES) * BINS;
        for (let bin = 0; bin < BINS; bin++) {
          const value = buffer[source + bin], offset = (y * BINS + bin) * 4;
          image.data[offset] = palette[value * 3]; image.data[offset + 1] = palette[value * 3 + 1]; image.data[offset + 2] = palette[value * 3 + 2]; image.data[offset + 3] = 255;
        }
      }
      offContext.putImageData(image, 0, 0);
      context.imageSmoothingEnabled = false;
      context.drawImage(off, 0, 0, width, height);
      context.beginPath();
      for (let bin = 0; bin < BINS; bin++) {
        const value = buffer[((head - 1 + LINES) % LINES) * BINS + bin], x = (bin + .5) / BINS * width, y = 5 + (1 - value / 255) * height * .24;
        if (bin === 0) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.strokeStyle = 'rgba(255,242,170,.9)'; context.lineWidth = 1; context.stroke();
      for (const emitter of list) { const x = (emitter.channel + .5) / BINS * width; context.fillStyle = 'rgba(245,158,11,.6)'; context.fillRect(x - 1, 0, 2, 5); }
      if (current.status === 'running' && !reduced.matches) { context.fillStyle = 'rgba(255,255,255,.14)'; context.fillRect(0, 0, width, 1); }
    }

    function tick(now: number) {
      raf = requestAnimationFrame(tick);
      const current = stateRef.current.snapshot;
      if (current.sessionId !== session) { session = current.sessionId; buffer.fill(0); head = 0; lastSim = current.time; }
      if (current.time < lastSim) lastSim = current.time;
      let lines = current.status === 'running' ? Math.floor((current.time - lastSim) / STEP) : 0;
      if (lines > LINES) { buffer.fill(0); head = 0; lastSim = current.time; lines = 0; }
      else if (lines > 8) { lastSim = current.time - 8 * STEP; lines = 8; }
      for (let index = 0; index < lines; index++) { writeLine(lastSim + index * STEP, emittersOf(current)); head = (head + 1) % LINES; }
      if (lines) lastSim += lines * STEP;
      if (now - lastPaint >= (reduced.matches ? 160 : 60)) { lastPaint = now; paint(); }
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <section className="wall-card wall-spectrum" aria-label="Simulated RF spectrum">
    <header><span>04 / RF SPECTRUM</span><b>{emitters.length} EMITTER{emitters.length === 1 ? '' : 'S'}</b></header>
    <div className="wall-spectrum-scope">
      <canvas ref={canvasRef} role="img" aria-label={`Simulated RF spectrum waterfall. ${emitters.length ? emitters.map(e => e.label + ' on channel ' + e.channel).join(', ') + '.' : 'No airborne emitters.'}`} />
      <span className="wall-spectrum-band">2.4 GHZ BAND · FICTIONAL</span>
    </div>
    <div className="wall-spectrum-axis"><span>2400</span><span>2440</span><span>2483 MHZ</span></div>
    {emitters.length > 0 && <div className="wall-emitter-row">{emitters.map(emitter => <span className="wall-emitter-chip" key={emitter.key}>{emitter.label} · CH {emitter.channel} · SIG {Math.round(emitter.strength * 100)}%</span>)}</div>}
    <div className="wall-card-foot">
      <b>{emitters.length ? emitters.map(emitter => `${emitter.label} · CH ${emitter.channel}`).join(' / ') : 'RF band quiet'}</b>
      <span>Emission presence is simulated and does not establish affiliation or intent.</span>
      <small>{evidence ? `RF EVIDENCE ${evidence.id} · CAPTURED ${clock(evidence.captureTime)} · QUALITY ${Math.round((evidence.quality ?? .5) * 100)}%` : 'RF EVIDENCE NOT DELIVERED YET'}</small>
    </div>
  </section>;
}
