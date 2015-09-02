local key = KEYS[1]
local now = KEYS[2]
local cost = KEYS[3]
local poolMax = tonumber(KEYS[4])
local fillRate = KEYS[5]
local expiry = KEYS[6]

local timestampKey = key..'timestamp'
local poolKey = key..'pool'

local before = redis.call('get', timestampKey)

if before == false then
  redis.call('set', timestampKey, now, 'ex', expiry)

  local ret = poolMax - cost
  redis.call('set', poolKey, ret, 'ex', expiry)
  return tostring(ret)
end

local timediff = now - before

if timediff > 0 then
  redis.call('set', timestampKey, now, 'ex', expiry)
else
  timediff = 0
end

local owed = timediff / fillRate
local r = redis.call('get', poolKey)

if r == false then
  r = poolMax
end

r = math.min(r + owed, poolMax)

local limit = 1
if r - cost >= 0 then
  r = r - cost
else
  limit = -1
end

redis.call('set', poolKey, r, 'ex', expiry)

return tostring(r * limit)
