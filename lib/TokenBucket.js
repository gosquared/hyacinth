/*
  Token bucket implementation with redis as the token store
  */

var Redis = require('redis');
var Scripty = require('node-redis-scripty');

/**
 * Constructor for TokenBucket
 * @param {Object} config - The configuration object for the TokenBucket
 * @param {Object} config.redis - The redis client to be used as the store
 * @param {string} [config.identifier=api-token-bucket-] - The identifier to
 * be prepended to all redis keys
 * @return {TokenBucket}        A new TokenBucket instance
 */
var TokenBucket = module.exports = function(config) {

  if (!config) config = {};

  this.redis = config.redis || Redis.createClient();
  this.scripty = new Scripty(this.redis);

  return this;
};

/**
 * Clears the rate limit for a given key by resetting the amount to the poolMax
 * @param  {string}   key The key to be reset
 * @param  {Function} [cb]  The callback function
 * @return {Promise.<number, Error>} Resolves to the new ratelimit amount
 */
TokenBucket.prototype.clearRateLimitWithKey = function(key, cb) {
  var self = this;
  cb = cb || function() {};

  return new Promise(function(resolve, reject) {
    self.redis.del(key + 'timestamp', function(err, res) {
      if (err) {
        cb(err, null);
        reject(err);
      } else {
        cb(null, true);
        resolve(true);
      }
    });
  });
};

/**
 * Calculates the rate limit with a call to redis for a given key
 * @param  {string}   key  The key to be rate limited
 * @param  {number}   cost The cost of the operation
 * @param  {number}   poolMax The max value for the pool
 * @param  {number}   fillRate The fill rate for the pool
 * @param  {Function} [cb]   The callback function
 * @return {Promise.<number, Error>} - Resolves to the number of tokens left with
 *                              a negative number indicating that the req was limited
 */
TokenBucket.prototype.rateLimit = function(key, cost, poolMax, fillRate, cb) {
  var self = this;

  cb = cb || function() {};

  if (!key || !cost || !poolMax || !fillRate) {
    cb(new Error('Missing arguments'));
    return Promise.reject(new Error('Missing arguments'));
  }

  return new Promise(function(resolve, reject) {

    var now = Date.now();

    self.scripty.loadScriptFile('blank', __dirname + '/TokenBucket.lua', function(err, script) {
      if (err) throw new Error(err);
      script.run(1, key, now, cost, poolMax, fillRate, Math.ceil(fillRate * poolMax / 1000), function(err, res) {
        if (err) {
          cb(err, null);
          reject(err);
        } else {
          res = Math.floor(res);
          cb(null, res);
          resolve(res);
        }
      });
    });
  });
};
