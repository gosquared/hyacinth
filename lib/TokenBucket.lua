local t = redis.call('getset',KEYS[1]..'timestamp', KEYS[2])
redis.call('expire', KEYS[1]..'timestamp', KEYS[6])
if t == false then
  redis.call('set', KEYS[1]..'pool', KEYS[4] - KEYS[3])
  redis.call('expire',KEYS[1]..'pool', KEYS[6])
  return tostring(KEYS[4] - KEYS[3])
end

local owed = (KEYS[2] - t) / KEYS[5]
local r = redis.call('get', KEYS[1]..'pool')
redis.call('expire',KEYS[1]..'pool', KEYS[6])
if r == false then
  r = KEYS[4]
end
if r + owed < tonumber(KEYS[4]) then
  r = r + owed
else
  r = KEYS[4]
end
local limit = 1
if r - KEYS[3] >= 0 then
  r = r - KEYS[3]
else
  limit = -1
end
redis.call('set', KEYS[1]..'pool', r)
redis.call('expire',KEYS[1]..'pool', KEYS[6])
return tostring(r * limit)
