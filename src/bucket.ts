import IORedis from "ioredis"

const Redis = require('ioredis')
const { createScript } = require('node-redis-script')
const fs = require('fs')
const path = require('path')

exports.deduct = (
  ioredis: IORedis.Redis,
  name: string,
  cost: number,
  max: number,
  fill: number
) => {

}

exports.limit = () => {

}
