local Registry = require 'modules.shared.registry'

---@return nil
local function usePoliceCamera()
    local Photos = Registry.Get('Photos')
    if Photos and Photos.CapturePolicePhoto then
        Photos.CapturePolicePhoto()
        return
    end

    lib.notify({
        title = 'Camera',
        description = 'Photo module is not available',
        type = 'error',
    })
end

exports('usePoliceCamera', usePoliceCamera)
