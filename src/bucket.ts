import IORedis from 'ioredis'

import { createScript } from 'node-redis-script'
import fs from 'fs'
import path from 'path'

const fp = path.resolve(path.join('./deduct.lua'))
const src = fs.readFileSync(fp)

export async function deductTokens (
  ioredis: IORedis.Redis,
  name: string,
  num: number,
  max: number,
  fill: number
) {

}
