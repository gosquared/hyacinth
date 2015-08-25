/*
  Token bucket implementation with redis as the token store
  */

var Redis = require('redis');
var Scripty = require('node-redis-scripty');

/**
 * Constructor for TokenBucket accepts an object with config containing either a node-redis client or the config to set up the client
 * @param {Object} [config] - The configuration object for the TokenBucket
 * @param {Object} [config.redis] - The redis client to be used as the store
 * @param {number} [config.poolMax=250] - The maximum size of the token pool
 * @param {number} [config.fillRate=240] - The rate in milliseconds that the pool will be refilled
 * @param {string} [config.identifier=api-token-bucket-] - The identifier to be prepended to all redis keys
 * @return {TokenBucket}        A new TokenBucket instance
 */
var TokenBucket = module.exports = function(config) {

  if (!config) config = {};

  this.redis = config.redis || Redis.createClient();
  this.poolMax = config.poolMax || 250;
  this.fillRate = config.fillRate || 240; //milliseconds between fill
  this.identifier = config.identifier || 'api-token-bucket-';
  this.scripty = new Scripty(this.redis);

  return this;
};


/**
 * Clears the rate limit for a given key by resetting the amount to the poolMax
 * @param  {string}   key The key to be reset
 * @param  {Function} [cb]  The callback function
 * @return {Promise}       [description]
 */
TokenBucket.prototype.clearRateLimitWithKey = function(key, cb) {
  var self = this;
  cb = cb || function() {};

  return new Promise(function(resolve, reject) {
    self.redis.set(key + 'pool', self.poolMax, function(err, res) {
      res = (res === 'OK') ? true : false;

      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
}

/**
 * Calculates the rate limit with a call to redis for a given key
 * @param  {string}   key  The key to be rate limited
 * @param  {number}   cost The cost of the operation
 * @param  {Function} cb   The callback function
 * @return {Promise}       The promise object for this operation
 */
TokenBucket.prototype.rateLimitWithRedis = function(key, cost, cb) {
  var self = this;
  cb = cb || function() {};

  return new Promise(function(resolve, reject) {

    var now = Date.now();

    var src = "local t = redis.call('getset',KEYS[1]..'timeframe', KEYS[2])\
    if t == false then\
      redis.call('set', KEYS[1]..'pool', tonumber(KEYS[4]))\
    return KEYS[4] \
    else\
      local d = math.ceil((tonumber(KEYS[2]) - t) / tonumber(KEYS[5]) - tonumber(KEYS[3]))\
    local r = redis.call('get', KEYS[1]..'pool')\
    if r + d >= 0 then\
      d = redis.call('incrby', KEYS[1]..'pool', d)\
    else \
      d = redis.call('incrby', KEYS[1]..'pool', d+KEYS[3])\
    return -1\
    end\
    if d > tonumber(KEYS[4]) then\
      d = tonumber(KEYS[4])\
    redis.call('set', KEYS[1]..'pool', tonumber(KEYS[4]))\
    end\
    \
    return d\
    end";


    self.scripty.loadScript('blank', src, function(err, script) {
      script.run(5, key, now, cost, self.poolMax, self.fillRate, function(err, res) {
        if (err) {
          cb(err, null);
          reject(err);
        } else {
          cb(null, res);
          resolve(res);
        }
      });
    });
  });
}
