import { describe, expect, it } from 'vitest'
import { RANGE } from '../src/data/range'
import { RENDER } from '../src/data/render'
import { coursePath } from '../src/render/path'
import { rangeScenery, sceneryTriangles, type SceneryItem } from '../src/render/scenery'

const S = RENDER.scenery
const STRIP = { fromX: -RENDER.course.leadM, toX: RANGE.acceleration.stripM + RENDER.course.leadM, laneHalfM: RENDER.strip.widthM / 2 }
const COURSE = { fromX: 0, toX: coursePath().lengthM, laneHalfM: RENDER.course.widthM / 2 }
const SHOOT = { fromX: RENDER.shoot.sceneryFromM, toX: RENDER.shoot.sceneryToM, laneHalfM: RENDER.shoot.laneWidthM / 2 }

/** How near the middle of the lane a shape comes, and which side it is on. */
function reach(item: SceneryItem): { nearest: number; side: number } {
  const zs = item.solid.kind === 'loft'
    ? item.solid.rings.flatMap((ring) => ring.corners.map((corner) => corner.z))
    : item.solid.kind === 'slab'
      ? [item.solid.atZ - item.solid.widthM / 2, item.solid.atZ + item.solid.widthM / 2]
      : item.solid.kind === 'box'
        ? [item.solid.at.z - item.solid.size.z / 2, item.solid.at.z + item.solid.size.z / 2]
        : [item.solid.at.z - item.solid.radiusM, item.solid.at.z + item.solid.radiusM]
  return { nearest: Math.min(...zs.map(Math.abs)), side: Math.sign(zs[0]!) }
}

const isTree = (item: SceneryItem): boolean => (S.treeColours as readonly string[]).includes(item.colour)

describe('the scenery round a range', () => {
  it('is the same list every time', () => {
    expect(rangeScenery(STRIP)).toEqual(rangeScenery(STRIP))
  })

  it('keeps to its triangle budget on every range, the long strip included', () => {
    for (const range of [STRIP, COURSE, SHOOT]) {
      const items = rangeScenery(range)
      expect(items.length).toBeGreaterThan(20)
      expect(sceneryTriangles(items)).toBeLessThanOrEqual(S.maxTriangles)
    }
  })

  it('leaves the lane clear, and the camera side clear further out than the far side', () => {
    for (const range of [STRIP, COURSE, SHOOT]) {
      for (const item of rangeScenery(range)) {
        const { nearest, side } = reach(item)
        expect(nearest).toBeGreaterThan(range.laneHalfM + 1)
        if (!isTree(item)) continue
        // A tree's foot is wider than the place it stands on, by a share of its height at most.
        const clear = (side > 0 ? S.nearSideFromM : S.farSideFromM) - S.tree.maxHeightM * S.tree.widthShare
        expect(nearest).toBeGreaterThanOrEqual(range.laneHalfM + clear - 0.01)
      }
    }
    // The travelling cameras all stand inside the cleared ground.
    const furthest = Math.max(...Object.values(RENDER.camera.seats).map((seat) => seat.sideM))
    expect(furthest).toBeLessThan(RENDER.strip.widthM / 2 + S.nearSideFromM - S.tree.maxHeightM * S.tree.widthShare)
  })

  it('has woods on both sides, hills, a tower and flags at both ends', () => {
    const items = rangeScenery(STRIP)
    const trees = items.filter(isTree)
    expect(trees.filter((item) => reach(item).side > 0).length).toBeGreaterThan(50)
    expect(trees.filter((item) => reach(item).side < 0).length).toBeGreaterThan(50)
    expect(items.filter((item) => item.colour === S.hills.colour).length).toBe(S.hills.eachSide * 2)
    expect(items.filter((item) => item.colour === S.towerColours.legs).length).toBe(4)
    expect(items.filter((item) => item.colour === S.flag.cloth).length).toBe(4)
  })

  it('thins its woods when asked, and nothing else', () => {
    const full = rangeScenery(STRIP)
    const thin = rangeScenery({ ...STRIP, density: 0.5 })
    expect(thin.filter(isTree).length).toBe(Math.floor(full.filter(isTree).length / 2))
    expect(thin.filter((item) => !isTree(item))).toEqual(full.filter((item) => !isTree(item)))
  })

  it('builds into one mesh a colour, with exactly the triangles the list says', async () => {
    const { Mesh } = await import('three')
    const { Kit } = await import('../src/render/rangeScene')
    const { buildSolids } = await import('../src/render/tankModel')
    const items = rangeScenery(COURSE)
    const kit = new Kit()
    const group = buildSolids(kit, items)
    let triangles = 0
    for (const node of group.children) {
      expect(node).toBeInstanceOf(Mesh)
      triangles += (node as InstanceType<typeof Mesh>).geometry.getAttribute('position').count / 3
    }
    expect(group.children.length).toBe(new Set(items.map((item) => item.colour)).size)
    expect(triangles).toBe(sceneryTriangles(items))
    kit.dispose()
  })
})
