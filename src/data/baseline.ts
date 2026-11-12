// The Radan baseline design: the licence-built tank the bureau starts from
// (plan section 16, Q5). Kelbo named it "Type 1"; see docs/NAMES.md.
import type { VehicleSpec } from '../sim/vehicle/spec'

export const BASELINE_SPEC: VehicleSpec = {
  name: 'Type 1',
  hull: { size: 'medium', glacisAngleDeg: 68, engineAt: 'rear' },
  turret: { shape: 'castDome', ringMm: 2100 },
  gun: 'smooth125',
  barrel: 'standard',
  recoil: 'standard',
  loading: 'carousel',
  ammo: { rounds: 39, stowage: 'plainRacks', kinetic: 'supplied', shaped: 'supplied' },
  fireControl: {
    sight: 'daySight',
    rangefinder: 'coincidence',
    stabiliser: 'twoPlane',
    computer: 'mechanical',
    night: 'activeInfrared',
    commanderSight: false,
  },
  powerpack: { engine: 'diesel780', transmission: 'manual44', cooling: 'standard', fuelL: 1000, apu: false },
  runningGear: { suspension: 'torsionBar', roadWheels: 6, trackWidthMm: 580, skirts: false },
  protection: { smokeLaunchers: true, fireSuppression: true, spallLiner: false, active: 'none' },
  crew: { comfort: 'basic' },
  armour: {
    upperGlacis: [
      { material: 'rolledSteel', mm: 60 },
      { material: 'compositeInsert', mm: 100 },
      { material: 'rolledSteel', mm: 20 },
    ],
    lowerGlacis: [{ material: 'rolledSteel', mm: 80 }],
    hullSideFront: [{ material: 'rolledSteel', mm: 60 }],
    hullSideRear: [{ material: 'rolledSteel', mm: 45 }],
    hullRear: [{ material: 'rolledSteel', mm: 40 }],
    hullRoof: [{ material: 'rolledSteel', mm: 20 }],
    belly: [{ material: 'rolledSteel', mm: 15 }],
    turretFrontLeft: [{ material: 'castSteel', mm: 350 }],
    turretFrontRight: [{ material: 'castSteel', mm: 350 }],
    mantlet: [{ material: 'castSteel', mm: 250 }],
    turretSides: [{ material: 'castSteel', mm: 120 }],
    turretRear: [{ material: 'castSteel', mm: 60 }],
    turretRoof: [{ material: 'castSteel', mm: 35 }],
  },
  // The licence-built tank comes with no reactive tiles.
  era: {
    upperGlacis: 0, lowerGlacis: 0, hullSideFront: 0, hullSideRear: 0, hullRear: 0, hullRoof: 0, belly: 0,
    turretFrontLeft: 0, turretFrontRight: 0, mantlet: 0, turretSides: 0, turretRear: 0, turretRoof: 0,
  },
}
