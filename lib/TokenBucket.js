/*
  Token bucket implementation with redis as the token store
  */

var Redis = require('redis');
var Scripty = require('node-redis-scripty');

/**
 * Constructor for TokenBucket accepts an object with config containing either
 * a node-redis client or the config to set up the client
 * @param {Object} [config] - The configuration object for the TokenBucket
 * @param {Object} [config.redis] - The redis client to be used as the store
 * @param {number} [config.poolMax=250] - The maximum size of the token pool
 * @param {number} [config.fillRate=240] - The rate in milliseconds that the
 * pool will be refilled
 * @param {string} [config.identifier=api-token-bucket-] - The identifier to
 * be prepended to all redis keys
 * @return {TokenBucket}        A new TokenBucket instance
 */
var TokenBucket = module.exports = function(config) {

  if (!config) config = {};

  this.redis = config.redis || Redis.createClient();
  this.poolMax = config.poolMax || 250;
  this.fillRate = config.fillRate || 240; //milliseconds between fill
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
}

/**
 * Calculates the rate limit with a call to redis for a given key
 * @param  {string}   key  The key to be rate limited
 * @param  {number}   cost The cost of the operation
 * @param  {Function} cb   The callback function
 * @return {Promise}       The promise object for this operation
 */
TokenBucket.prototype.rateLimit = function(key, cost, cb) {
  var self = this;
  cb = cb || function() {};

  return new Promise(function(resolve, reject) {

    var now = Date.now();

    //TODO: adding tokens based on time is inacurate and may add too many...

    var src = "redis.call('expire', KEYS[1]..'timestamp', KEYS[6])\
      redis.call('expire',KEYS[1]..'pool', KEYS[6])\
      local t = redis.call('getset',KEYS[1]..'timestamp', KEYS[2])\
      if t == false then\
        redis.call('set', KEYS[1]..'pool', KEYS[4] - KEYS[3])\
        return KEYS[4] - KEYS[3]\
      end\
      local owed = (KEYS[2] - t) / KEYS[5]\
      local r = redis.call('get', KEYS[1]..'pool')\
      if r == false then\
        r = KEYS[4]\
      end\
      if r + owed < tonumber(KEYS[4]) then\
        r = r + owed\
      else \
        r = KEYS[4]\
      end\
      local limit = 1\
      if r - KEYS[3] >= 0 then\
        r = r - KEYS[3]\
      else\
        limit = -1\
      end\
      redis.call('set', KEYS[1]..'pool', r)\
      return tostring(r * limit)";

    self.scripty.loadScript('blank', src, function(err, script) {
      if(err) throw new Error(err);
      script.run(6, key, now, cost, self.poolMax, self.fillRate, Math.ceil(self.fillRate * self.poolMax / 1000), function(err, res) {
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

/**
 * Calculates the rate limit with a calls to Redis but in a non-atomic way without Lua. Should be used as a reference rather than an actual implementation
 * @param  {string}   key  The key to be rate limited
 * @param  {number}   cost The cost of the operation
 * @param  {Function} cb   The callback function
 * @return {Promise}       The promise object for this operation
 */
TokenBucket.prototype.rateLimitWithoutLua = function(key, cost, cb) {
  var self = this;
  cb = cb || function() {};

  return new Promise(function(resolve, reject) {

    var now = Date.now();

    // Get the last timestamp to compare
    self.redis.getset(key + 'timestamp', now, function(err, res){

      if(!res) {
        // There is no timestamp to compare set the poolmax and
        // respond with that minus cost
        self.redis.set(key + 'pool', self.poolMax - cost, function(err, res){
        });

        resolve(self.poolMax - cost);
        return;
      }

      // Calculate the difference (amount owed minus cost)
      var owed = (now - res) / self.fillRate;

      // Get the current pool amount to compare
      self.redis.get(key + 'pool', function(err, res){
        // Here we want to add on the owed tokens up to the poolMax
        res = (res === null) ? self.poolMax : parseInt(res);

        var beforeCost = (res + owed < self.poolMax) ? res + owed : self.poolMax;
        var afterCost = beforeCost - cost;
        var newAmount = (afterCost >= 0) ? afterCost : beforeCost;
        var limited = (afterCost >= 0) ? 1 : -1;

        self.redis.set(key + 'pool', newAmount, function(){
          return resolve(newAmount * limited);
        });
      });
    });
  });
}
