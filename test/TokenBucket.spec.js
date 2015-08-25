var chai = require('chai');
var expect = chai.expect;

var Redis = require('redis');
var TokenBucket = require('../lib/TokenBucket');

var rateLimiter;
var timers = 0;
var count = 0;

var testKey = 'API:limits:87877658';

describe('TokenBucket', function(){

	before(function(done){

		var client = Redis.createClient(6379, 'localhost');
		client.on('error', function(err) {
			log.error('Error on redis connection');
		});

		client.on('ready', function(){

			rateLimiter = new TokenBucket({
				redis:client,
			});

			done();
		});
	});

	describe('rateLimitReset', function(){
		it('should return the max pool size when resetting', function(){
			return rateLimiter.clearRateLimitWithKey(testKey).then(function(data){
				expect(data).to.be.true;
			});
		});
	})

	describe('rateLimitWithRedis', function(){

		beforeEach(function(done){
			return rateLimiter.clearRateLimitWithKey(testKey).then(function(data){
				done();
			});
		});

		it('should return 250', function(){
			return rateLimiter.rateLimitWithRedis(testKey, 10).then(function(data){
				expect(data).to.equal(250);
			});
		});

		it('should return a number after 20 async tests', function(){
			this.timeout(4000);
			return testRateLimit(rateLimiter, 200, 2000).then(function(data){
				console.log(data);
				expect(data).to.be.a('array');
			});
		});


	})
});

function testRateLimit(rateLimiter, hits, time) {
	var promises = [];

	for(var i =0; i < hits; i += 1){
		promises.push(new Promise(function(resolve, reject) {
			setTimeout(function(){
				rateLimiter.rateLimitWithRedis(testKey, 10).then(resolve).catch(reject);
			}, (time / hits) * i);
		}));
	};

	return Promise.all(promises);
}
