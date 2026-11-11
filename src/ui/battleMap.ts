// The battle map: the ground from above, your platoon at the bottom, played
// back from the tanks' tracks. Yours are solid and theirs hollow, a tank out
// of the fight is crossed out, and the count is written underneath, so
// nothing rests on colour.
import { BATTLE } from '../data/battle'
import { STRINGS, fill } from '../data/strings'
import type { BattleResult } from '../sim/battle/battle'
import { momentOf } from './battleReplay'
import { el } from './dom'
import { fixed } from './format'

const M = STRINGS.battle.map
const SVG = 'http://www.w3.org/2000/svg'
const { widthM: W, depthM: H } = BATTLE.field

function svg(tag: string, attrs: Record<string, string | number>): SVGElement {
  const node = document.createElementNS(SVG, tag)
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value))
  return node
}

/** Up the ground is up the screen. */
function sy(y: number): number {
  return H - y
}

export interface BattleMap {
  root: HTMLElement
  /** Stops the playback. Call before throwing the map away. */
  stop(): void
}

export function createBattleMap(battle: BattleResult, battleNo: number): BattleMap {
  const ground = BATTLE.grounds[battle.ground]
  const root = el('div', 'bm')
  const drawing = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'bm-svg', role: 'img' })
  drawing.setAttribute('aria-label', fill(M.label, { at: String(battleNo) }))

  const defs = svg('defs', {})
  const hatch = svg('pattern', { id: 'bm-hatch', width: 40, height: 40, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' })
  hatch.append(svg('line', { x1: 0, y1: 0, x2: 0, y2: 40, class: 'bm-hatch' }))
  defs.append(hatch)
  drawing.append(defs, svg('rect', { x: 0, y: 0, width: W, height: H, class: 'bm-ground' }))
  for (const wood of ground.woods) {
    drawing.append(svg('circle', { cx: wood.x, cy: sy(wood.y), r: wood.r, class: 'bm-wood', fill: 'url(#bm-hatch)' }))
  }
  // A ridge is drawn just ahead of each place a tank can sit behind one.
  ground.platoons.forEach((plan, side) => {
    const ahead = side === 0 ? 1 : -1
    for (const lane of plan.lanes) {
      for (const post of lane) {
        if (!post.cover) continue
        const y = sy(post.y + ahead * 45)
        const bow = sy(post.y + ahead * 75)
        drawing.append(svg('path', { d: `M${post.x - 90} ${y}Q${post.x} ${bow} ${post.x + 90} ${y}`, class: 'bm-ridge' }))
      }
    }
  })

  const roundsLayer = svg('g', {})
  const tanksLayer = svg('g', {})
  drawing.append(roundsLayer, tanksLayer)
  const marks = battle.tanks.map((tank) => {
    const group = svg('g', { class: `bm-tank bm-tank-${tank.side === 0 ? 'mine' : 'theirs'}` })
    const body = svg('g', {})
    body.append(
      svg('rect', { x: -32, y: -50, width: 64, height: 100, class: 'bm-hull' }),
      svg('line', { x1: 0, y1: -10, x2: 0, y2: -95, class: 'bm-gun' }),
    )
    const ring = svg('circle', { r: 85, class: 'bm-smoke' })
    const cross = svg('path', { d: 'M-60 -60L60 60M-60 60L60 -60', class: 'bm-cross' })
    const label = svg('text', { x: 62, y: 30, class: 'bm-no' })
    label.textContent = String(tank.no + 1)
    group.append(ring, body, cross, label)
    tanksLayer.append(group)
    return { group, body, ring, cross }
  })

  const status = el('p', 'bm-status')
  status.setAttribute('role', 'status')
  const controls = el('div', 'bm-controls')
  const play = el('button', 'btn bm-play', M.play)
  play.type = 'button'
  play.dataset.key = 'battle-map-play'
  const slider = el('input', 'bm-slider')
  slider.type = 'range'
  slider.min = '0'
  slider.max = String(Math.ceil(battle.endS))
  slider.step = '1'
  slider.dataset.key = 'battle-map-time'
  slider.setAttribute('aria-label', M.slider)
  controls.append(play, slider)
  root.append(drawing, controls, status, el('p', 'ctl-note bm-key', M.key))

  let atS = 0
  let playing = false
  let frame = 0
  let last = 0

  const show = (): void => {
    const moment = momentOf(battle, atS)
    moment.tanks.forEach((tank, index) => {
      const mark = marks[index]
      if (!mark) return
      mark.group.setAttribute('transform', `translate(${fixed(tank.x, 1)} ${fixed(sy(tank.y), 1)})`)
      mark.body.setAttribute('transform', `rotate(${fixed(tank.headingDeg, 0)})`)
      mark.group.classList.toggle('bm-tank-out', tank.state === 'out')
      mark.ring.style.display = tank.state === 'smoke' ? '' : 'none'
      mark.cross.style.display = tank.state === 'out' ? '' : 'none'
    })
    roundsLayer.replaceChildren(...moment.rounds.map((round) => {
      const x = round.fromX + (round.toX - round.fromX) * round.along
      const y = round.fromY + (round.toY - round.fromY) * round.along
      const back = Math.max(0, round.along - 0.12)
      const bx = round.fromX + (round.toX - round.fromX) * back
      const by = round.fromY + (round.toY - round.fromY) * back
      return svg('line', { x1: bx, y1: sy(by), x2: x, y2: sy(y), class: 'bm-round' })
    }))
    slider.value = String(Math.round(atS))
    const standing = (side: 0 | 1): number => moment.tanks.filter((tank) => tank.side === side && tank.state !== 'out').length
    status.textContent = `${fill(M.time, { at: fixed(atS, 0), n: fixed(battle.endS, 0) })} · ${fill(M.standing, {
      a: String(standing(0)), b: String(standing(1)),
    })}`
    play.textContent = playing ? M.pause : atS >= battle.endS ? M.again : M.play
  }

  const stop = (): void => {
    playing = false
    cancelAnimationFrame(frame)
  }
  const tick = (now: number): void => {
    if (!playing || !root.isConnected) {
      playing = false
      return
    }
    atS = Math.min(battle.endS, atS + ((now - last) / 1000) * BATTLE.playbackSpeed)
    last = now
    if (atS >= battle.endS) playing = false
    show()
    if (playing) frame = requestAnimationFrame(tick)
  }
  play.addEventListener('click', () => {
    if (playing) stop()
    else {
      if (atS >= battle.endS) atS = 0
      playing = true
      last = performance.now()
      frame = requestAnimationFrame(tick)
    }
    show()
  })
  slider.addEventListener('input', () => {
    stop()
    atS = Number(slider.value)
    show()
  })

  show()
  return { root, stop }
}
