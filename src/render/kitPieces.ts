// The tank kit, fetched once when a trial is first watched and kept. Until it
// has come (or if it cannot be fetched) tanks are drawn from simple shapes
// instead, so a trial never waits on it or fails for want of it.
import { KIT } from '../data/kit'
import { parseKit, type KitCorners, type PieceCorners } from './glb'

let kit: KitCorners | null = null
let coming: Promise<void> | null = null

/** Fetch and read the kit, once. Never throws: a kit that will not load leaves the simple shapes in use. */
export function loadTankKit(base = './'): Promise<void> {
  coming ??= fetch(`${base}${KIT.file}`)
    .then((reply) => (reply.ok ? reply.arrayBuffer() : Promise.reject(new Error(String(reply.status)))))
    .then((file) => {
      kit = parseKit(file)
    })
    .catch(() => {
      coming = null
    })
  return coming ?? Promise.resolve()
}

/** Use a kit already read, as the tests do. `null` goes back to the simple shapes. */
export function useTankKit(corners: KitCorners | null): void {
  kit = corners
}

/** A piece of the kit, if the kit has come. */
export function kitPiece(name: string): PieceCorners | undefined {
  return kit?.get(name)
}
