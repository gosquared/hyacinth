var chai = require('chai');
var expect = chai.expect;

var Redis = require('redis');
var TokenBucket = require('../lib/TokenBucket');

var rateLimiter;
var timers = 0;
var count = 0;
var client;


describe('TokenBucket', function(){

	before(function(done){

		client = Redis.createClient(6379, 'localhost');
		client.on('error', function(err) {
			log.error('Error on redis connection');
		});

		client.on('ready', function(){
      rateLimiter = new TokenBucket({redis:client});
			done();
		});
	});

	describe('rateLimitReset', function(){
		it('should return true when resetting', function(){

			var testKey = 'API:limits:testing:0:';

			return rateLimiter.clearRateLimitWithKey(testKey).then(function(data){
				expect(data).to.be.true;
			});
		});
	});

	describe('rateLimit', function(){

		beforeEach(function(done){
			client.eval('return redis.call("del", unpack(redis.call("keys", KEYS[1])))', 1, 'API:limits:testing:*', function(err, res){
				done();
			});
		});

		it('should return the the pool max minus the cost after being reset', function(){

			var testKey = 'API:limits:testing:1:';

			return rateLimiter.rateLimit(testKey, 10, 250, 240).then(function(data){
				expect(data).to.equal(240);
			});
		});

		//
		// Numeric tests
		//

		it('should allow 250 hits out of 250 over 2 seconds at a cost of 1', function(){
			this.timeout(4000);

			return testRateLimit(250, 240, 250, 2000, 1).then(function(data){
				var passed = data.filter(function(item){return item >= 0;}).length;
				expect(passed).to.equal(250);
			});
		});

    it('should allow 172 hits out of 250 over 2 seconds at a cost of 1.5', function(){
			this.timeout(4000);

			return testRateLimit(250, 240, 250, 2000, 1.5).then(function(data){
				var passed = data.filter(function(item){return item >= 0;}).length;
				expect(passed).to.equal(172);
			});
		});

		it('should allow 258 hits out of 500 over 2 seconds at a cost of 1', function(){
			this.timeout(4000);

			return testRateLimit(250, 240, 500, 2000, 1).then(function(data){
				var passed = data.filter(function(item){return item >= 0;}).length;
				expect(passed).to.equal(258);
			});
		});

		it('should allow 254 hits out of 500 over 1 seconds at a cost of 1', function(){
			this.timeout(4000);

			return testRateLimit(250, 240, 500, 1000, 1).then(function(data){
				var passed = data.filter(function(item){return item >= 0;}).length;
				expect(passed).to.equal(254);
			});
		});

	});
});

function testRateLimit(poolMax, fillRate, hits, time, cost) {

	//Expected pass amount is poolMax + time(ms) / fillRate / cost

	var promises = [];

	var key = 'API:limits:testing:';

	for (var i =0; i < hits; i += 1){
		promises.push(new Promise(function(resolve, reject) {
			setTimeout(function(){
				rateLimiter.rateLimit(key, cost, poolMax, fillRate).then(resolve).catch(reject);
			}, (time / hits) * i);
		}));
	};

	return Promise.all(promises);
}
