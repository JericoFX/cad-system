local Registry = {}

---@type table<string, function>
local actions = {}

---@param name string
---@param action function
function Registry.Register(name, action)
    actions[name] = action
end

---@param name string
---@return function|nil
function Registry.Get(name)
    return actions[name]
end

---@param name string
---@return function|nil
function Registry.GetOptional(name)
    return actions[name]
end

return Registry
