// The track's links as a small repeating picture: one link along, the whole
// track across. Made here from a few numbers, so there is no file to fetch.
import { RENDER } from '../data/render'

/** The picture's pixels, four numbers each (grey, grey, grey, opaque), one link along by the track across. */
export function trackLinkPixels(): Uint8Array {
  const k = RENDER.tank.trackLinks
  const pixels = new Uint8Array(k.alongPx * k.acrossPx * 4)
  const gapPx = Math.max(1, Math.round(k.alongPx * k.gapShare))
  for (let across = 0; across < k.acrossPx; across++) {
    const middle = Math.abs((across + 0.5) / k.acrossPx - 0.5) < k.hornShare / 2
    for (let along = 0; along < k.alongPx; along++) {
      let shade = 1
      if (along < gapPx) shade = k.gapShade
      else if (along === gapPx) shade = k.pinShade
      else if (middle) shade = k.hornShade
      const i = (across * k.alongPx + along) * 4
      pixels[i] = pixels[i + 1] = pixels[i + 2] = Math.round(shade * 255)
      pixels[i + 3] = 255
    }
  }
  return pixels
}

/**
 * How far the links run round, in links, when the tank has moved `movedM`
 * since the last picture: forward positive. Held to a steady crawl when the
 * tank moves further than the eye could follow, as in a time-lapse.
 */
export function trackStep(movedM: number): number {
  const k = RENDER.tank.trackLinks
  const links = movedM / k.linkM
  return Math.max(-k.mostLinksPerFrame, Math.min(k.mostLinksPerFrame, links))
}
