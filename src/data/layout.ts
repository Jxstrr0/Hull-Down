// Where things sit in the tank. The blueprint, the 3D range and the hit
// model all work from these, so a shot that goes in where the drawing shows
// the engine reaches the engine.
// Game-level abstractions, not engineering data.

/** The measurements every view of the tank shares. */
export const LAYOUT = {
  /** Turret centre along the hull, measured from the nose, by engine position. */
  turretCentre: { rear: 0.45, front: 0.62 },
  /** Gun axis height up the turret. */
  gunHeightShare: 0.45,
  /** Where the barrel leaves the turret, as a share of the turret radius ahead of centre. */
  gunRootShare: 0.9,
  /** Rear overhang of a bustle turret, as a share of the turret radius. */
  bustleOverhang: 0.7,
  /** Where the bustle's floor sits, as a share of the turret height above the hull roof. */
  bustleFloorShare: 0.3,
  /** Engine bay, as shares of hull length from the nose, by engine position. */
  engineBay: { rear: [0.68, 0.97], front: [0.2, 0.42] },
  /** Top of the track run, as a share of the hull roof height. */
  trackTopShare: 0.62,
  /** Where each pair of wheels sits on a wheeled hull, as shares of hull length from the nose, by number of wheels. */
  wheelAxles: { 4: [0.2, 0.78], 6: [0.18, 0.6, 0.81], 8: [0.15, 0.34, 0.63, 0.83] },
} as const

/** What is inside, and how big. Metres unless a name says otherwise. */
export const INTERIOR = {
  /** Room left between the armour and anything inside it. */
  wallM: 0.06,
  /** A seat, front to back and side to side. */
  seatM: 0.5,
  /** How far below the hull roof the turret crew's feet reach. */
  basketDepthM: 0.6,
  /** Head room under the turret roof. */
  headRoomM: 0.1,
  /** The turret crew, as shares of the turret radius: back from the centre, then out to the tank's right. */
  commander: [0.3, 0.42],
  loader: [0.3, -0.42],
  /** The gunner sits ahead of the commander when there is a loader, and across from him when there is not. */
  gunnerWithLoader: [-0.28, 0.42],
  gunnerAlone: [0.05, -0.42],
  /** The driver: how far behind the top of the glacis, and how far off the centre line when the engine is beside him. */
  driverBackM: 0.45,
  driverClearOfTurretM: 0.35,
  driverOffsetShare: -0.5,
  /** With nobody in the turret, the gunner and commander sit either side of the driver: this far behind him. */
  hullCrewBackM: 0.1,
  /** The gun breech: where it starts behind the mantlet, where it ends as a share of the radius, and its half thickness. */
  breechStartM: 0.25,
  breechEndShare: 0.25,
  breechHalfM: 0.18,
  /** The gunner's sight: a box in the turret front, as shares of the radius ahead of centre, and its size. */
  sightFromShare: 0.75,
  sightToShare: 0.5,
  sightHalfM: 0.12,
  sightDepthM: 0.28,
  /** A carousel autoloader: its radius as a share of the ring radius, and how deep it is. */
  carouselShare: 0.8,
  carouselDepthM: 0.32,
  /** What sits in a bustle: where it starts behind the turret centre and its half width, as shares of the turret radius. */
  bustleFromShare: 0.95,
  bustleHalfShare: 0.6,
  /** How far across the bustle an autoloader reaches, as a share of that half width. The rest is a narrow rack. */
  bustleLoaderShare: 0.4,
  /** Rounds a rack in the bustle holds when a loader works from it. */
  bustleRackRounds: 24,
  /** Rounds a bustle holds beside its autoloader. */
  bustleSpareRounds: 6,
  /** Ready rounds clipped to the turret wall when there is no bustle, and the rack's place as shares of the radius. */
  readyRackRounds: 8,
  readyRackFromShare: 0.62,
  readyRackToShare: 0.9,
  readyRackHalfShare: 0.5,
  /** Racks and tanks beside the driver: how far behind the top of the glacis they start and how close to the centre line they come. */
  besideDriverBackM: 0.15,
  besideDriverInnerM: 0.3,
  /** How close to the turret crew's feet a rack or tank beside the driver may run, as a share of the radius ahead of centre. */
  besideDriverStopShare: 0.75,
  /** A fuel tank across the hull ahead of the engine: how far it hangs below the roof. */
  crossTankDepthM: 0.38,
  /** Room kept clear of the rear plate. */
  rearClearM: 0.25,
  /** With soldiers in the back: the racks and the fuel tank become strips this wide along the walls. */
  troopStripM: 0.3,
  /** Length of hull each pair of soldiers takes, sitting face to face. */
  troopPairM: 0.55,
  /** Engine and gearbox: half width as a share of the hull's inside, and the engine's share of the bay's length. */
  bayHalfShare: 0.8,
  engineShare: 0.62,
  /** Where the engine starts off the centre line when the driver sits beside it. */
  bayBesideDriverM: 0.1,
  /** Height kept clear above and below the engine. */
  bayClearM: 0.08,
} as const
