import { clicksInSegment } from "./clock"
import type { Segment } from "./expandSession"
import { CLICKS, type ClickId } from "./types"

export type ClickBuffers = {
  normal: AudioBuffer
  accent: AudioBuffer
  restCue: AudioBuffer
}

const FRAME_LATE_SEC = 0.05

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

export type ClickSounds = {
  clicks: Record<ClickId, { normal: AudioBuffer; accent: AudioBuffer }>
  restCue: AudioBuffer
}

export function createClickSounds(ctx: AudioContext): ClickSounds {
  const clicks = Object.fromEntries(CLICKS.map((click) => {
    const buffers = createClickBuffers(ctx, click)
    return [click, { normal: buffers.normal, accent: buffers.accent }]
  })) as ClickSounds["clicks"]
  return { clicks, restCue: createClickBuffers(ctx, "click-1").restCue }
}

export function scheduleSegment(ctx: AudioContext, sounds: ClickSounds, segment: Segment, when: number) {
  if (segment.kind === "rest") return [startBuffer(ctx, sounds.restCue, when)]
  return clicksInSegment(segment).map((mark) => {
    const buffers = sounds.clicks[mark.click]
    return startBuffer(ctx, mark.accent ? buffers.accent : buffers.normal, when + mark.offsetSec)
  })
}

function startBuffer(ctx: AudioContext, buffer: AudioBuffer, when: number): AudioBufferSourceNode {
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.connect(ctx.destination)
  // A click more than a frame behind the audio clock is skipped. One that is only
  // that late starts now, so start() never receives a negative or past time.
  if (when >= ctx.currentTime - FRAME_LATE_SEC) {
    source.start(Math.max(ctx.currentTime, when))
  }
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
