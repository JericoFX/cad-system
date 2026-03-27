-- modules/shared/state.lua

local State = {
    Cases = {},
    Dispatch = {
        Units = {},
        Calls = {},
    },
    SecurityCameras = {
        Cameras = {},
        LastNumber = 0,
    },
    Evidence = {
        Staging = {},
    },
    Fines = {},
    EMS = {
        Alerts = {},
        Units = {},
        BloodRequests = {},
    },
    Police = {
        JailTransfers = {},
    },
    OfficerStatus = {},
    Forensics = {
        LockerItems = {},
        WorldTraces = {},
        IdReaders = {},
        VirtualContainers = {},
        VirtualContainerLocks = {},
    },
    News = {
        Articles = {},
    },
    Photos = {
        Photos = {},
        Staging = {},
        ReviewQueue = {},
        ReleasedPhotos = {},
        LastId = 0,
    },
}

return State
