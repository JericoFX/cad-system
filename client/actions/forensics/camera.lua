local function usePoliceCamera()
    local Photos = _G.CadActions and _G.CadActions.Photos or nil
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
