local key = KEYS[1]
local now = ARGV[1]
local cost = ARGV[2]
local poolMax = tonumber(ARGV[3])
local fillRate = ARGV[4]
local expiry = ARGV[5]

local timestampKey = key..'timestamp'
local poolKey = key..'pool'

local before = redis.call('get', timestampKey)

if before == false then
  redis.call('set', timestampKey, now, 'ex', expiry)

  local remaining = poolMax - cost

  if remaining < 0 then
    return tostring(-1)
  end

  redis.call('set', poolKey, remaining, 'ex', expiry)
  return tostring(remaining)
end

local timediff = now - before

if timediff > 0 then
  redis.call('set', timestampKey, now, 'ex', expiry)
else
  timediff = 0
end

local earned = timediff / fillRate
local balance = redis.call('get', poolKey)

if balance == false then
  balance = poolMax
end
balance = math.min(balance + earned, poolMax)

local remaining = balance - cost
if remaining < 0 then
  return tostring(-1)
end

redis.call('set', poolKey, remaining, 'ex', expiry)

return tostring(remaining)
