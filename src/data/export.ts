// The export desk: the customers abroad and what each asks of a tank.
// Game-level abstractions, not engineering data.
import type { VehicleKind } from './tenders'

export const CLIMATES = ['desert', 'jungle', 'mountain'] as const
export type Climate = (typeof CLIMATES)[number]

/** What a customer can ask for. Each is a figure off the tank's stat sheet. */
export const NEED_IDS = [
  'heavyCooling', 'troops', 'rangeKm', 'maxMassT', 'groundPressure', 'powerToWeight', 'topSpeedKmh', 'depressionDeg', 'unitCostKr',
] as const
export type NeedId = (typeof NEED_IDS)[number]

/** Whether a need is a least, a most, or a part the tank must have. */
export const NEED_KINDS = {
  heavyCooling: 'fitted',
  troops: 'atLeast',
  rangeKm: 'atLeast',
  maxMassT: 'atMost',
  groundPressure: 'atMost',
  powerToWeight: 'atLeast',
  topSpeedKmh: 'atLeast',
  depressionDeg: 'atLeast',
  unitCostKr: 'atMost',
} as const satisfies Record<NeedId, 'fitted' | 'atLeast' | 'atMost'>

export interface Customer {
  climate: Climate
  /** The kind of vehicle it buys. It looks at nothing else. */
  wants: VehicleKind
  /** What the tank must do or be. A fitted part asks for 1. */
  needs: Partial<Record<NeedId, number>>
  /** Vehicles the customer would order. */
  tanks: number
  /** What a version built for the customer adds to the tank's designation. */
  mark: string
}

export const CUSTOMER_IDS = ['dahrat', 'ilandu', 'tolmar', 'ekunde', 'orvenn', 'zamuri', 'qasirah'] as const
export type CustomerId = (typeof CUSTOMER_IDS)[number]

export const CUSTOMERS: Record<CustomerId, Customer> = {
  // Desert: heat and long distances between fuel dumps.
  dahrat: { climate: 'desert', wants: 'tank', needs: { heavyCooling: 1, rangeKm: 450, unitCostKr: 2_600_000 }, tanks: 120, mark: '-D' },
  // Jungle: soft ground, light bridges and a small budget.
  ilandu: { climate: 'jungle', wants: 'tank', needs: { maxMassT: 38, groundPressure: 0.82, unitCostKr: 2_000_000 }, tanks: 60, mark: '-J' },
  // Mountain: steep roads, and firing down from the crest of one.
  tolmar: { climate: 'mountain', wants: 'tank', needs: { powerToWeight: 20, depressionDeg: 7, unitCostKr: 2_800_000 }, tanks: 80, mark: '-M' },
  // Jungle: a whole platoon in the back, over soft ground, cheaply.
  ekunde: { climate: 'jungle', wants: 'ifv', needs: { troops: 8, groundPressure: 0.75, unitCostKr: 2_000_000 }, tanks: 90, mark: '-E' },
  // Mountain: guns that climb the passes behind the tanks, light enough for the mountain bridges.
  orvenn: { climate: 'mountain', wants: 'spg', needs: { powerToWeight: 24, maxMassT: 32, unitCostKr: 2_400_000 }, tanks: 36, mark: '-O' },
  // Desert: long patrols in the heat, far from any fuel.
  zamuri: { climate: 'desert', wants: 'scout', needs: { heavyCooling: 1, rangeKm: 1200, unitCostKr: 2_200_000 }, tanks: 70, mark: '-Z' },
  // Desert: air defence that keeps up with columns on long desert roads.
  qasirah: { climate: 'desert', wants: 'aa', needs: { heavyCooling: 1, topSpeedKmh: 70, unitCostKr: 2_600_000 }, tanks: 30, mark: '-Q' },
}

export const EXPORT_DESK = {
  /** Tanks the army must have adopted before the desk opens. */
  opensAfterAdopted: 1,
  /** The bureau's fee on an export order, as a share of what the customer pays for the tanks. */
  feeShare: 0.03,
  /** The ministry signs no export licence for a bureau it thinks less of than this. */
  ministryStanding: 40,
  /** What the ministry thinks of the hard currency a sale brings in, in standing. */
  saleMinistry: 3,
  /** Working up a version for a customer and proving it costs this many of the tank. */
  variantWorkUnits: 1,
  /** What a version may change that a package for a tank already built may not: it is built new. */
  variantFree: ['powerpack.cooling'] as readonly string[],
  /**
   * The customer's own trial before it orders: this many tanks over the
   * endurance run, on its ground. A good trial keeps the whole order; a
   * poor one leaves `cutShare` of it, a bad one `badShare`.
   */
  trial: {
    tanks: 12,
    /** At or under this many stops a tank, with none towed in, the trial is good. */
    goodStops: 0.35,
    /** At or over this many stops a tank, or this share towed in, it is bad. */
    badStops: 0.6,
    badTowedShare: 0.15,
    cutShare: 0.5,
    badShare: 0.25,
  },
} as const
