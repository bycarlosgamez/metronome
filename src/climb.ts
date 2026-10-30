export type Step = { atSec: number; bpm: number }

function stepIndex(steps: Step[], intoSec: number): number {
  let index = 0
  while (index + 1 < steps.length && steps[index + 1].atSec <= intoSec) index++
  return index
}

// Where you are in a climb: the step, seconds until the next one (Infinity on the last), and the fraction through the current step (0 on the last)
export function climbProgress(steps: Step[], intoSec: number): { index: number; nextInSec: number; fraction: number } {
  const index = stepIndex(steps, intoSec)
  const next = steps[index + 1]
  if (!next) return { index, nextInSec: Infinity, fraction: 0 }
  const window = next.atSec - steps[index].atSec
  return { index, nextInSec: next.atSec - intoSec, fraction: window > 0 ? (intoSec - steps[index].atSec) / window : 0 }
}

// Seconds into the play after the steps change, keeping the current step and the fraction through it
export function carryClimbPosition(oldSteps: Step[], intoSec: number, newSteps: Step[]): number {
  const { index, fraction } = climbProgress(oldSteps, intoSec)
  const lastNew = newSteps.length - 1
  if (index > lastNew) return newSteps[lastNew].atSec
  if (index === lastNew) {
    // Already holding at the target: keep the time held; otherwise start the hold
    return index === oldSteps.length - 1 ? newSteps[index].atSec + (intoSec - oldSteps[index].atSec) : newSteps[index].atSec
  }
  return newSteps[index].atSec + fraction * (newSteps[index + 1].atSec - newSteps[index].atSec)
}
