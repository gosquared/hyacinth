import chai from 'chai'
import async from 'async'

import Redis from 'ioredis'
import TokenBucket from '../src/bucket'
const { expect } = chai

let rateLimiter
let ioredis

describe('TokenBucket', function () {
  beforeEach(function () {
    ioredis = new Redis()
    const name = 'tb:test'
    const max = 10
    const fill = 1
    rateLimiter = new TokenBucket(ioredis, name, max, fill)
    // client.on('error', function (err) {
    //   console.error('Error on redis connection', err)
    // })

    // client.on('ready', function () {
    //   rateLimiter = new TokenBucket({ client: client })
    //   done()
    // })
  })

  describe('rateLimitReset', function () {
    it('should return true when resetting', async () => {
      const testKey = 'API:limits:testing:0:'

      const result = await rateLimiter.clearRateLimitWithKey(testKey)
      expect(result).to.equal(true)
    })
  })

  describe('rateLimit', function () {
    beforeEach(done => {
      return client.eval('return redis.call("del", unpack(redis.call("keys", KEYS[1])))', 1, 'API:limits:testing:*')
    })

    it('should return the the pool max minus the cost after being reset', async () => {
      const testKey = 'API:limits:testing:1:'

      const result = await rateLimiter.rateLimit(testKey, 10, 250, 240)
      expect(result).to.equal(240)
    })

    //
    // Numeric tests
    //

    it('should allow 250 hits out of 250 over 2 seconds at a cost of 1', function (done) {
      this.timeout(4000)

      testRateLimit(250, 240, 250, 2000, 1, function (err, data) {
        if (err) return done(err)
        const passed = data.filter(function (item) { return item >= 0 }).length
        expect(passed).to.equal(250)
        done()
      })
    })

    it('should allow 172 hits out of 250 over 2 seconds at a cost of 1.5', function (done) {
      this.timeout(4000)

      testRateLimit(250, 240, 250, 2000, 1.5, function (err, data) {
        if (err) return done(err)
        const passed = data.filter(function (item) { return item >= 0 }).length
        expect(passed).to.equal(170)
        done()
      })
    })

    it('should allow 258 hits out of 500 over 2 seconds at a cost of 1', function (done) {
      this.timeout(4000)

      testRateLimit(250, 240, 500, 2000, 1, function (err, data) {
        if (err) return done(err)
        const passed = data.filter(function (item) { return item >= 0 }).length
        expect(passed).to.equal(254)
        done()
      })
    })

    it('should allow 254 hits out of 500 over 1 seconds at a cost of 1', function (done) {
      this.timeout(4000)

      testRateLimit(250, 240, 500, 1000, 1, function (err, data) {
        if (err) return done(err)
        const passed = data.filter(function (item) { return item >= 0 }).length
        expect(passed).to.equal(252)
        done()
      })
    })
  })
})

function testRateLimit (poolMax, fillRate, hits, time, cost, cb) {
  // Expected pass amount is poolMax + time(ms) / fillRate / cost

  const key = 'API:limits:testing:'

  async.times(hits, function (i, done) {
    setTimeout(async () => {
      const result = await rateLimiter.rateLimit(key, cost, poolMax, fillRate)
      done(null, result)
    }, (time / hits) * i)
  }, cb)
}
