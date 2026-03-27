local Sounds = {}

local SOUND_IDS = {

    PTT_START = { soundName = "Start_Squelch", soundSet = "CB_RADIO_SFX" },
    PTT_END = { soundName = "End_Squelch", soundSet = "CB_RADIO_SFX" },

    DISPATCH_INCOMING = { soundName = "BEEP", soundSet = "MP_PROPERTIES_ELEVATOR_DOORS" },
    DISPATCH_EMERGENCY = { soundName = "TIMER_STOP", soundSet = "HUD_MINI_GAME_SOUNDSET" },

    SUCCESS = { soundName = "Payment_Non_Payment", soundSet = "phone", soundRef = "PHONE_SFX" },
    ERROR = { soundName = "ERROR", soundSet = "HUD_AMMO_SHOP_SOUNDSET" },

    CLICK = { soundName = "SELECT", soundSet = "HUD_FRONTEND_DEFAULT_SOUNDSET" },
    BACK = { soundName = "BACK", soundSet = "HUD_FRONTEND_DEFAULT_SOUNDSET" },
}

function Sounds.Play(soundConfig)
    if not soundConfig then return end

    PlaySoundFrontend(-1, soundConfig.soundName, soundConfig.soundSet, true)
end

RegisterNUICallback('playSound', function(data, cb)
    local soundType = data and data.type
    if not soundType then
        cb({ ok = false, error = 'no_sound_type' })
        return
    end

    local soundConfig = SOUND_IDS[soundType]
    if not soundConfig then
        cb({ ok = false, error = 'unknown_sound_type' })
        return
    end

    Sounds.Play(soundConfig)
    cb({ ok = true })
end)

function Sounds.PTTStart()
    Sounds.Play(SOUND_IDS.PTT_START)
end

function Sounds.PTTEnd()
    Sounds.Play(SOUND_IDS.PTT_END)
end

function Sounds.DispatchIncoming()

    Sounds.Play(SOUND_IDS.DISPATCH_INCOMING)
    Citizen.SetTimeout(200, function()
        Sounds.Play(SOUND_IDS.DISPATCH_INCOMING)
    end)
end

function Sounds.EmergencyAlert()

    for i = 1, 5 do
        Citizen.SetTimeout(i * 200, function()
            Sounds.Play(SOUND_IDS.DISPATCH_EMERGENCY)
        end)
    end
end

function Sounds.Success()
    Sounds.Play(SOUND_IDS.SUCCESS)
end

function Sounds.Error()
    Sounds.Play(SOUND_IDS.ERROR)
end

function Sounds.Click()
    Sounds.Play(SOUND_IDS.CLICK)
end

function Sounds.Back()
    Sounds.Play(SOUND_IDS.BACK)
end

exports('PlayPTTStart', Sounds.PTTStart)
exports('PlayPTTEnd', Sounds.PTTEnd)
exports('PlayDispatchIncoming', Sounds.DispatchIncoming)
exports('PlayEmergencyAlert', Sounds.EmergencyAlert)
exports('PlaySuccess', Sounds.Success)
exports('PlayError', Sounds.Error)

_G.CadActions = _G.CadActions or {}
_G.CadActions.Sounds = Sounds

print('[CAD Sounds] Sound system initialized')
