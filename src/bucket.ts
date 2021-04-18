import IORedis, { Redis } from 'ioredis'

import { createScript } from 'node-redis-script'
import fs from 'fs'
import path from 'path'

const fp = path.resolve(path.join('./deduct.lua'))
const src = fs.readFileSync(fp)

export default class TokenBucket {
  ioredis: IORedis.Redis
  name: string
  max: number
  fill: number

  constructor (
    ioredis: IORedis.Redis,
    name: string,
    max: number,
    fill: number
  ) {
    this.ioredis = ioredis
    this.name = name
    this.max = max
    this.fill = fill
  }

  async balance () {
    return this.ioredis.get(`${this.name}.pool`)
  }
}
