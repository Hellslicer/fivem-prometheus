local _TriggerEvent = TriggerEvent
local _TriggerClientEvent = TriggerClientEvent

local countS = 0
local countC = 0
function TriggerEvent(event, ...)
    countS = countS + 1
    return _TriggerEvent(event, ...)
end

function TriggerClientEvent(event, source, ...)
    countC = countC + 1
    return _TriggerClientEvent(event, source, ...)
end

AddEventHandler('prometheus:_gatherEventCount', function(cb)
    cb(countS, countC)
    countS = 0
    countC = 0
end)