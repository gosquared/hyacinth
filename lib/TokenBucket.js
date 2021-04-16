/*
  Token bucket implementation with redis as the token store
  */

const Redis = require('ioredis')
const { createScript } = require('node-redis-script')
const fs = require('fs')
const path = require('path')

/**
 * Constructor for TokenBucket
 * @param {Object} config - The configuration object for the TokenBucket
 * @param {Object} [config.redis] - The redis client to be used as the store
 * @return {TokenBucket}        A new TokenBucket instance
 */
const TokenBucket = module.exports = function (config = {}) {
  this.redis = config.client || new Redis(config.port, config.host)

  return this
}

/**
 * Clears the rate limit for a given key by resetting the amount to the poolMax
 * @param  {string}   key The key to be reset
 * @param  {Function} [cb]  The callback function
 */
TokenBucket.prototype.clearRateLimitWithKey = async function (key) {
  await this.redis.del(key + 'timestamp')
  // function (err, res) {
  //   if (err) return cb(err, null)

  //   cb(null, true)
  // }
  return true
}

/**
 * Calculates the rate limit with a call to redis for a given key
 * @param  {string}   key  The key to be rate limited
 * @param  {number}   cost The cost of the operation
 * @param  {number}   poolMax The max value for the pool
 * @param  {number}   fillRate The fill rate for the pool
 * @param  {Function} [cb]   The callback function (err, res) - 'res' is the number of tokens left with
 *                              a negative number indicating that the req was limited
 */
TokenBucket.prototype.rateLimit = async function (key, cost, poolMax, fillRate, cb) {
  cb = cb || function () {}

  if (!key || !cost || !poolMax || !fillRate) {
    cb(new Error('Missing arguments'))
  }

  const now = Date.now()

  const p = path.join(__dirname, './TokenBucket.lua')
  const scriptSrc = fs.readFileSync(path.resolve(p))
  const tokenBucket = createScript({ ioredis: this.redis }, scriptSrc)

  const expiry = Math.ceil(fillRate * poolMax / 1000)
  const result = await tokenBucket(1, key, now, cost, poolMax, fillRate, expiry)
  return Math.floor(result)

  // this.scripty.loadScriptFile('blank', __dirname + '/TokenBucket.lua', function (err, script) {
  //   if (err) throw new Error(err)
  //   script.run(1, key, now, cost, poolMax, fillRate, Math.ceil(fillRate * poolMax / 1000), function (err, res) {
  //     if (err) return cb(err, null)

  //     res = Math.floor(res)
  //     return cb(null, res)
  //   })
  // })
}
