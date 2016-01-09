# Hyacinth

> _Actually, it's a Token **Bouquet** rate limiter_

#### Atomic, distributed rate limiting using a token bucket algorithm.

Token Bucket rate-limiting is designed to try and reduce spikey traffic to your service. There are a few existing libraries that implement this but none that ensure atomicity across distributed services.

Hyacinth uses Redis as it's shared store and Lua scripting to ensure atomicity between clients.


## Installation

When its on npm...

```sh
npm install hyacinth --save
```

## Usage

```js
var TokenBucket = require('hyacinth');

var rateLimiter = new TokenBucket({
	redis: redisClient
});

// On each request to the resource
rateLimiter.rateLimit(resourceKey, 10, 250, 240, function(err, tokensRemaining){
    // Negative number indicates the tokens remaining but limited
    // as the cost was higher than those remaining

	if(data < 0) return requestDenied();
	requestApproved();
});
```


### Express middleware example

```js

var Hyacinth = require('hyacinth');
var Redis = require('redis');
var tokenBucket new Hyacinth({
  redis: Redis.createClient()
});

module.exports = function rateLimits(req, res, next) {
  var key = 'API:limits:' + req.userID;   // Create a key that is associated with the API user
  var cost = 10;                          // This could be set dependent on the endpoint route
  var poolMax = 250;                      // The number of tokens for the user
  var fillInterval = 100;                 // How often a token is added to the bucket

  // This config will allow an average 10 requests per second
  // and bursts of 25 requests with a full token bucket

  tokenBucket.rateLimit(key, cost, poolMax, fillInterval, function(err, tokensRemaining) {
    if (err) {
      // Indicated a problem with your Redis connection / configuration
      return next(new Error('InternalError'));
    }

    res.setHeader('X-RateLimit-Limit', poolMax);
    res.setHeader('X-RateLimit-Remaining', tokensRemaining);
    res.setHeader('X-RateLimit-Cost', cost);

    if (tokensRemaining < 0) {
      // A negative response indicates that they should be rate limited
      console.log(req.userID ' has been rate limited.');

      res.status(429).send({
        message: 'Your request has been rate limited'
      });

      return;
    }

    next();
  });


```
