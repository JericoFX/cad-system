CAD = CAD or {}
CAD.Forensic = CAD.Forensic or {}
CAD.Forensic.Camera = CAD.Forensic.Camera or {}

local function usePoliceCamera()
    if CAD.Photos and CAD.Photos.CapturePolicePhoto then
        CAD.Photos.CapturePolicePhoto()
        return
    end

    lib.notify({
        title = 'Camera',
        description = 'Photo module is not available',
        type = 'error',
    })
end

exports('usePoliceCamera', usePoliceCamera)
