import IORedis, { Redis } from 'ioredis'

import { createScript, RunScript } from 'node-redis-script'
import fs from 'fs'
import path from 'path'

const fp = path.resolve(path.join('./bucket.lua'))
const src = fs.readFileSync(fp, { encoding: 'utf-8' })

export default class TokenBucket {
  ioredis: IORedis.Redis
  name: string
  max: number
  fill: number
  bucket?: RunScript

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

  async balance (): Promise<string | null> {
    return this.ioredis.get(`${this.name}.pool`)
  }

  async rateLimit (cost: number): Promise<string> {
    if (!this.bucket) {
      this.bucket = createScript({ ioredis: this.ioredis }, src)
    }

    return await this.bucket(1, this.name, cost, this.max, this.fill)
  }
}
