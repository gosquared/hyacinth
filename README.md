# Hyacinth

### Actually, it's a Token **Bouquet** rate limiter

## Installation

```sh
npm install hyacinth
```

## Usage

```js
var TokenBucket = require('token-bucket-rate-limiter');

var rateLimiter = new TokenBucket({
	redis: redisClient,
	poolMax: 250,
	fillRate: 240,
	identifier: 'api-token-bucket-'
});

rateLimiter.rateLimitWithRedis(testKey, 10).then(function(data){
	if(!data) return requestDenied();

	requestApproved();
});
```

## Full API

### Coming soon
