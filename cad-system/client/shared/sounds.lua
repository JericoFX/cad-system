

CAD = CAD or {}
CAD.Sounds = {}

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

function CAD.Sounds.Play(soundConfig)
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

    CAD.Sounds.Play(soundConfig)
    cb({ ok = true })
end)

function CAD.Sounds.PTTStart()
    CAD.Sounds.Play(SOUND_IDS.PTT_START)
end

function CAD.Sounds.PTTEnd()
    CAD.Sounds.Play(SOUND_IDS.PTT_END)
end

function CAD.Sounds.DispatchIncoming()

    CAD.Sounds.Play(SOUND_IDS.DISPATCH_INCOMING)
    Citizen.SetTimeout(200, function()
        CAD.Sounds.Play(SOUND_IDS.DISPATCH_INCOMING)
    end)
end

function CAD.Sounds.EmergencyAlert()

    for i = 1, 5 do
        Citizen.SetTimeout(i * 200, function()
            CAD.Sounds.Play(SOUND_IDS.DISPATCH_EMERGENCY)
        end)
    end
end

function CAD.Sounds.Success()
    CAD.Sounds.Play(SOUND_IDS.SUCCESS)
end

function CAD.Sounds.Error()
    CAD.Sounds.Play(SOUND_IDS.ERROR)
end

function CAD.Sounds.Click()
    CAD.Sounds.Play(SOUND_IDS.CLICK)
end

function CAD.Sounds.Back()
    CAD.Sounds.Play(SOUND_IDS.BACK)
end

exports('PlayPTTStart', CAD.Sounds.PTTStart)
exports('PlayPTTEnd', CAD.Sounds.PTTEnd)
exports('PlayDispatchIncoming', CAD.Sounds.DispatchIncoming)
exports('PlayEmergencyAlert', CAD.Sounds.EmergencyAlert)
exports('PlaySuccess', CAD.Sounds.Success)
exports('PlayError', CAD.Sounds.Error)

print('[CAD Sounds] Sound system initialized')
