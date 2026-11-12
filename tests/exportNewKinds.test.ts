// The export desk's customers for the new vehicles: one each for the infantry fighting vehicle, the
// self-propelled gun, the scout car and the anti-aircraft gun vehicle. Each can be met by a vehicle
// that would win its tender, reworked as a version built for the customer.
import { describe, expect, it } from 'vitest'
import { CUSTOMER_IDS, CUSTOMERS, type CustomerId } from '../src/data/export'
import { STRINGS } from '../src/data/strings'
import { TENDER_IDS, TENDERS, VEHICLE_KIND_IDS, type TenderId } from '../src/data/tenders'
import { newCareer, type Adopted, type Career } from '../src/sim/career/career'
import { BASELINE_SPEC } from '../src/data/baseline'
import { buys, saleBlock, secrets, sellVariant, variantBlock } from '../src/sim/career/exportDesk'
import { rivalBid } from '../src/sim/career/rival'
import { cleanCareer } from '../src/persist/careerCodec'
import type { VehicleSpec } from '../src/sim/vehicle'

const SLOW = 60_000
const NEW: Record<Exclude<(typeof VEHICLE_KIND_IDS)[number], 'tank'>, { customer: CustomerId; tender: TenderId; bureau: 'heavy' | 'light' | 'firepower'; rework: (spec: VehicleSpec) => void }> = {
  // A whole platoon in the back: two more soldiers, with the smaller diesel and less fuel to make room.
  ifv: { customer: 'ekunde', tender: 'ifv1996', bureau: 'light', rework: (spec) => { spec.crew.troops = 8; spec.powerpack.engine = 'diesel580'; spec.powerpack.fuelL = 600 } },
  // The big engine, and the heavy-duty cooling to carry it up the passes.
  spg: { customer: 'orvenn', tender: 'spg2008', bureau: 'light', rework: (spec) => { spec.powerpack.engine = 'diesel780'; spec.powerpack.cooling = 'heavyDuty' } },
  scout: { customer: 'zamuri', tender: 'scout2004', bureau: 'light', rework: (spec) => { spec.powerpack.cooling = 'heavyDuty' } },
  aa: { customer: 'qasirah', tender: 'aa2012', bureau: 'light', rework: (spec) => { spec.powerpack.cooling = 'heavyDuty' } },
}

/** A rival's winning bid as a bureau without the later research would build it: the standard rounds, not the researched ones. */
function built(tender: TenderId, bureau: 'heavy' | 'light' | 'firepower'): VehicleSpec {
  const spec = structuredClone(rivalBid(bureau, TENDERS[tender], 5).bid.spec)
  spec.ammo.kinetic = BASELINE_SPEC.ammo.kinetic
  spec.ammo.shaped = BASELINE_SPEC.ammo.shaped
  expect(secrets(spec), `${tender} ${bureau}`).toEqual([])
  return spec
}

/** A career at the last tender, in good standing, with this rival's winning bid in army service. */
function withVehicle(tender: TenderId, spec: VehicleSpec): Career {
  const tank: Adopted = {
    designation: `Model ${String(TENDERS[tender].year).slice(2)}`, name: '', year: TENDERS[tender].year, tender, spec,
    production: { rate: 'steady', quality: 'standard' }, years: 0, contract: null, upgrades: [],
  }
  return { ...newCareer(11), tenderNo: TENDER_IDS.length - 1, budgetKr: 40_000_000, adopted: [tank] }
}

describe('the export desk\'s customers for the new vehicles', () => {
  it('has one customer for each new kind, each with a name, a line, its own mark and needs', () => {
    const X = STRINGS.career.exportDesk
    for (const [kind, { customer }] of Object.entries(NEW)) {
      expect(CUSTOMERS[customer].wants).toBe(kind)
      expect(X.customers[customer].name).not.toBe('')
      expect(X.customers[customer].line).not.toBe('')
      expect(Object.keys(CUSTOMERS[customer].needs).length).toBeGreaterThanOrEqual(2)
    }
    const marks = CUSTOMER_IDS.map((id) => CUSTOMERS[id].mark)
    expect(new Set(marks).size).toBe(marks.length)
    // The three tank buyers are unchanged.
    for (const id of ['dahrat', 'ilandu', 'tolmar'] as const) expect(CUSTOMERS[id].wants).toBe('tank')
  })

  it('finds each new customer asking for something the army did not: the winning bid as built falls short', () => {
    for (const { customer, tender, bureau } of Object.values(NEW)) {
      const career = withVehicle(tender, built(tender, bureau))
      expect(saleBlock(career, 0, customer), customer).toBe('needs')
    }
  }, SLOW)

  it('can be met by a version of a winning bid, and orders it', () => {
    for (const { customer, tender, bureau, rework } of Object.values(NEW)) {
      const asBuilt = built(tender, bureau)
      const career = withVehicle(tender, asBuilt)
      const version = structuredClone(asBuilt)
      rework(version)
      expect(variantBlock(career, 0, customer, version), customer).toBeNull()
      const after = sellVariant(career, 0, customer, version)
      const sale = after.sales.at(-1)!
      expect(sale.customer).toBe(customer)
      expect(sale.designation.endsWith(CUSTOMERS[customer].mark)).toBe(true)
      expect(sale.tanks, customer).toBeGreaterThan(0)
      expect(sale.feeKr, customer).toBeGreaterThan(0)
      // A tank buyer still will not look at it.
      expect(variantBlock(career, 0, 'dahrat', version)).toBe('kind')
    }
  }, SLOW)

  it('looks at no other kind: a tank is never offered to them', () => {
    for (const { customer } of Object.values(NEW)) {
      const career = withVehicle('tank2016', structuredClone(rivalBid('light', TENDERS.tank2016, 5).bid.spec))
      expect(buys(customer, career.adopted[0]!)).toBe(false)
      expect(saleBlock(career, 0, customer)).toBe('kind')
    }
  }, SLOW)

  it('keeps an order from a new customer through a save', () => {
    const { customer, tender, bureau, rework } = NEW.scout
    const asBuilt = built(tender, bureau)
    const version = structuredClone(asBuilt)
    rework(version)
    const after = sellVariant(withVehicle(tender, asBuilt), 0, customer, version)
    const back = cleanCareer(JSON.parse(JSON.stringify(after)))!
    expect(back.sales.map((sale) => sale.customer)).toEqual([customer])
  }, SLOW)

  it('has a word for every need it asks', () => {
    for (const { customer } of Object.values(NEW)) {
      for (const need of Object.keys(CUSTOMERS[customer].needs)) expect(STRINGS.career.exportDesk.needs[need as keyof typeof STRINGS.career.exportDesk.needs]).not.toBe('')
    }
  })
})
