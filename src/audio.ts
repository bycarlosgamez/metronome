import { clicksInSegment } from "./clock"
import type { Segment } from "./expandSession"
import type { ClickId } from "./types"

export type ClickBuffers = {
  normal: AudioBuffer
  accent: AudioBuffer
  restCue: AudioBuffer
}

const TONES: Record<ClickId, { normal: number; accent: number }> = {
  "click-1": { normal: 880, accent: 1760 },
  "click-2": { normal: 660, accent: 1320 },
  "click-3": { normal: 440, accent: 990 },
  "click-4": { normal: 330, accent: 660 },
}

export function createClickBuffers(ctx: AudioContext, click: ClickId): ClickBuffers {
  const tone = TONES[click]
  return {
    normal: toneBuffer(ctx, tone.normal, 0.4),
    accent: toneBuffer(ctx, tone.accent, 0.7),
    restCue: toneBuffer(ctx, 520, 0.5),
  }
}

export function scheduleSegment(
  ctx: AudioContext,
  buffers: ClickBuffers,
  segment: Segment,
  when: number,
): AudioBufferSourceNode[] {
  if (segment.kind === "rest") {
    return [startBuffer(ctx, buffers.restCue, when)]
  }
  return clicksInSegment(segment).map((click) =>
    startBuffer(ctx, click.accent ? buffers.accent : buffers.normal, when + click.offsetSec),
  )
}

function startBuffer(ctx: AudioContext, buffer: AudioBuffer, when: number): AudioBufferSourceNode {
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.connect(ctx.destination)
  source.start(when)
  return source
}

function toneBuffer(ctx: AudioContext, frequency: number, gain: number): AudioBuffer {
  const sampleRate = ctx.sampleRate
  const length = Math.floor(sampleRate * 0.05)
  const buffer = ctx.createBuffer(1, length, sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) {
    const envelope = Math.exp(-i / (sampleRate * 0.01))
    data[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * envelope * gain
  }
  return buffer
}
