// The export desk: the customers abroad and what each asks of a tank.
// Game-level abstractions, not engineering data.

export const CLIMATES = ['desert', 'jungle', 'mountain'] as const
export type Climate = (typeof CLIMATES)[number]

/** What a customer can ask for. Each is a figure off the tank's stat sheet. */
export const NEED_IDS = [
  'heavyCooling', 'rangeKm', 'maxMassT', 'groundPressure', 'powerToWeight', 'depressionDeg', 'unitCostKr',
] as const
export type NeedId = (typeof NEED_IDS)[number]

/** Whether a need is a least, a most, or a part the tank must have. */
export const NEED_KINDS = {
  heavyCooling: 'fitted',
  rangeKm: 'atLeast',
  maxMassT: 'atMost',
  groundPressure: 'atMost',
  powerToWeight: 'atLeast',
  depressionDeg: 'atLeast',
  unitCostKr: 'atMost',
} as const satisfies Record<NeedId, 'fitted' | 'atLeast' | 'atMost'>

export interface Customer {
  climate: Climate
  /** What the tank must do or be. A fitted part asks for 1. */
  needs: Partial<Record<NeedId, number>>
  /** Tanks the customer would order. */
  tanks: number
}

export const CUSTOMER_IDS = ['dahrat', 'ilandu', 'tolmar'] as const
export type CustomerId = (typeof CUSTOMER_IDS)[number]

export const CUSTOMERS: Record<CustomerId, Customer> = {
  // Desert: heat and long distances between fuel dumps.
  dahrat: { climate: 'desert', needs: { heavyCooling: 1, rangeKm: 450, unitCostKr: 2_600_000 }, tanks: 120 },
  // Jungle: soft ground, light bridges and a small budget.
  ilandu: { climate: 'jungle', needs: { maxMassT: 38, groundPressure: 0.82, unitCostKr: 2_000_000 }, tanks: 60 },
  // Mountain: steep roads, and firing down from the crest of one.
  tolmar: { climate: 'mountain', needs: { powerToWeight: 20, depressionDeg: 7, unitCostKr: 2_800_000 }, tanks: 80 },
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
} as const
