---@class CadState
---@field Cases table<string, table>
---@field Dispatch { Units: table<string, table>, Calls: table<string, table> }
---@field SecurityCameras { Cameras: table<string, table>, LastNumber: integer }
---@field Evidence { Staging: table<string, table> }
---@field Fines table<string, table>
---@field EMS { Alerts: table<string, table>, Units: table<string, table>, BloodRequests: table<string, table> }
---@field Police { JailTransfers: table<string, table> }
---@field OfficerStatus table<string, table>
---@field Forensics { LockerItems: table, WorldTraces: table, IdReaders: table, VirtualContainers: table, VirtualContainerLocks: table }
---@field News { Articles: table<string, table> }
---@field Photos { Photos: table<string, table>, Staging: table<string, table>, ReviewQueue: table, ReleasedPhotos: table, LastId: integer }

---@type CadState
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
