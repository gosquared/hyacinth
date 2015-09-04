# Hyacinth

### Actually, it's a Token **Bouquet** rate limiter

## Installation

When its on npm...

```sh
npm install hyacinth
```

## Usage

```js
var TokenBucket = require('hyacinth');

var rateLimiter = new TokenBucket({
	redis: redisClient
});

rateLimiter.rateLimit(testKey, 10, 250, 240).then(function(tokensRemaining){
    // Negative number indicates the tokens remaining but limited
    // as the cost was higher than those remaining

	if(data < 0) return requestDenied();
	requestApproved();
});
```

## Full API

### Coming soon
