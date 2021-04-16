const chai = require('chai')
const async = require('async')
const expect = chai.expect

const Redis = require('redis')
const TokenBucket = require('../lib/TokenBucket')

let rateLimiter
let client

describe('TokenBucket', function () {
  beforeEach(function (done) {
    client = Redis.createClient(6379, 'localhost')
    client.on('error', function (err) {
      console.error('Error on redis connection', err)
    })

    client.on('ready', function () {
      rateLimiter = new TokenBucket({ client: client })
      done()
    })
  })

  it('should allow passing a redis client', function (done) {
    const c = Redis.createClient(6380, '1.2.3.4')
    const rl = new TokenBucket({ client: c })

    c.on('error', function () {

    })

    expect(rl.redis.options.port).to.equal(6380)
    expect(rl.redis.options.host).to.equal('1.2.3.4')
    done()
  })

  it('should allow passing a config', function (done) {
    const rl = new TokenBucket({ port: 6381, host: '2.3.4.5' })

    rl.redis.on('error', function () {

    })

    expect(rl.redis.options.port).to.equal(6381)
    expect(rl.redis.options.host).to.equal('2.3.4.5')

    done()
  })

  describe('rateLimitReset', function () {
    it('should return true when resetting', function (done) {
      const testKey = 'API:limits:testing:0:'

      rateLimiter.clearRateLimitWithKey(testKey, function (err, data) {
        expect(err).to.equal(null)
        expect(data).to.be.true
        done()
      })
    })
  })

  describe('rateLimit', function () {
    beforeEach(function (done) {
      client.eval('return redis.call("del", unpack(redis.call("keys", KEYS[1])))', 1, 'API:limits:testing:*', function (err, res) {
        done()
      })
    })

    it('should return the the pool max minus the cost after being reset', function (done) {
      const testKey = 'API:limits:testing:1:'

      rateLimiter.rateLimit(testKey, 10, 250, 240, function (err, data) {
        expect(data).to.equal(240)
        done()
      })
    })

    //
    // Numeric tests
    //

    it('should allow 250 hits out of 250 over 2 seconds at a cost of 1', function (done) {
      this.timeout(4000)

      testRateLimit(250, 240, 250, 2000, 1, function (err, data) {
        const passed = data.filter(function (item) { return item >= 0 }).length
        expect(passed).to.equal(250)
        done()
      })
    })

    it('should allow 172 hits out of 250 over 2 seconds at a cost of 1.5', function (done) {
      this.timeout(4000)

      testRateLimit(250, 240, 250, 2000, 1.5, function (err, data) {
        const passed = data.filter(function (item) { return item >= 0 }).length
        expect(passed).to.equal(172)
        done()
      })
    })

    it('should allow 258 hits out of 500 over 2 seconds at a cost of 1', function (done) {
      this.timeout(4000)

      testRateLimit(250, 240, 500, 2000, 1, function (err, data) {
        const passed = data.filter(function (item) { return item >= 0 }).length
        expect(passed).to.equal(258)
        done()
      })
    })

    it('should allow 254 hits out of 500 over 1 seconds at a cost of 1', function (done) {
      this.timeout(4000)

      testRateLimit(250, 240, 500, 1000, 1, function (err, data) {
        const passed = data.filter(function (item) { return item >= 0 }).length
        expect(passed).to.equal(254)
        done()
      })
    })
  })
})

function testRateLimit (poolMax, fillRate, hits, time, cost, cb) {
  // Expected pass amount is poolMax + time(ms) / fillRate / cost

  const functions = []
  const key = 'API:limits:testing:'

  async.times(hits, function (i, done) {
    setTimeout(function () {
      rateLimiter.rateLimit(key, cost, poolMax, fillRate, done)
    }, (time / hits) * i)
  }, cb)
}
