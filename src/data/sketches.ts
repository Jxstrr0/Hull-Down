// Part sketches drawn in Blender (art/part-sketches.py) and packed into
// public/sketches/ as masks. Keyed by control and option, as the option buttons
// are. A part with no sketch shows its note alone.
export const SKETCHES: Readonly<Record<string, string>> = {
  'gun:rifled100': 'sketches/gun-rifled100.png',
  'gun:smooth115': 'sketches/gun-smooth115.png',
  'gun:smooth125': 'sketches/gun-smooth125.png',
  'gun:rifled120': 'sketches/gun-rifled120.png',
  'powerpack.engine:diesel580': 'sketches/engine-diesel580.png',
  'powerpack.engine:diesel780': 'sketches/engine-diesel780.png',
  'powerpack.engine:multiFuel700': 'sketches/engine-multiFuel700.png',
  'powerpack.engine:turbine1000': 'sketches/engine-turbine1000.png',
}
