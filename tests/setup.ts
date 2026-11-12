// Every test sees the tank kit loaded, as a watched trial does. A test that
// wants the simple shapes drawn without it says so with useTankKit(null).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { KIT } from '../src/data/kit'
import { parseKit } from '../src/render/glb'
import { useTankKit } from '../src/render/kitPieces'
import { ROOT } from './helpers'

const file = readFileSync(join(ROOT, 'public', KIT.file))
useTankKit(parseKit(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength)))
