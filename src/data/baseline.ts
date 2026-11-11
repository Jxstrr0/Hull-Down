// The Radan baseline design: the licence-built tank the bureau starts from
// (plan section 16, Q5). "Pattern 3" is a working name; see docs/NAMES.md.
import type { VehicleSpec } from '../sim/vehicle/spec'

export const BASELINE_SPEC: VehicleSpec = {
  name: 'Pattern 3',
  hull: { size: 'medium', glacisAngleDeg: 68, engineAt: 'rear' },
  turret: { shape: 'castDome', ringMm: 2100 },
  gun: 'smooth125',
  loading: 'carousel',
  ammo: { rounds: 39, stowage: 'plainRacks' },
  fireControl: {
    sight: 'daySight',
    rangefinder: 'coincidence',
    stabiliser: 'twoPlane',
    computer: 'mechanical',
    night: 'activeInfrared',
    commanderSight: false,
  },
  powerpack: { engine: 'diesel780', transmission: 'manual44', cooling: 'standard', fuelL: 1000, apu: false },
  runningGear: { suspension: 'torsionBar', roadWheels: 6, trackWidthMm: 580 },
  protection: { smokeLaunchers: true, fireSuppression: true, spallLiner: false },
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
    belly: [{ material: 'rolledSteel', mm: 16 }],
    turretFrontLeft: [{ material: 'castSteel', mm: 350 }],
    turretFrontRight: [{ material: 'castSteel', mm: 350 }],
    mantlet: [{ material: 'castSteel', mm: 250 }],
    turretSides: [{ material: 'castSteel', mm: 120 }],
    turretRear: [{ material: 'castSteel', mm: 60 }],
    turretRoof: [{ material: 'castSteel', mm: 35 }],
  },
}
