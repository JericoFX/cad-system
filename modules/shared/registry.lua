local Registry = {}
local actions = {}

function Registry.Register(name, action)
    actions[name] = action
end

function Registry.Get(name)
    return actions[name]
end

function Registry.GetOptional(name)
    return actions[name]
end

return Registry
