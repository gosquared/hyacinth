/*
  Token bucket implementation with redis as the token store
  */

const Redis = require('redis')
const Scripty = require('node-redis-scripty')

/**
 * Constructor for TokenBucket
 * @param {Object} config - The configuration object for the TokenBucket
 * @param {Object} [config.redis] - The redis client to be used as the store
 * @return {TokenBucket}        A new TokenBucket instance
 */
const TokenBucket = module.exports = function (config) {
  if (!config) config = {}

  this.redis = config.client || Redis.createClient(config)

  this.scripty = new Scripty(this.redis)

  return this
}

/**
 * Clears the rate limit for a given key by resetting the amount to the poolMax
 * @param  {string}   key The key to be reset
 * @param  {Function} [cb]  The callback function
 */
TokenBucket.prototype.clearRateLimitWithKey = function (key, cb) {
  cb = cb || function () {}

  this.redis.del(key + 'timestamp', function (err, res) {
    if (err) return cb(err, null)

    cb(null, true)
  })
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
TokenBucket.prototype.rateLimit = function (key, cost, poolMax, fillRate, cb) {
  cb = cb || function () {}

  if (!key || !cost || !poolMax || !fillRate) {
    cb(new Error('Missing arguments'))
  }

  const now = Date.now()

  this.scripty.loadScriptFile('blank', __dirname + '/TokenBucket.lua', function (err, script) {
    if (err) throw new Error(err)
    script.run(1, key, now, cost, poolMax, fillRate, Math.ceil(fillRate * poolMax / 1000), function (err, res) {
      if (err) return cb(err, null)

      res = Math.floor(res)
      return cb(null, res)
    })
  })
}
