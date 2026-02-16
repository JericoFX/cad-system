--[[
CAD Forensic - ox_inventory Items
Defines all forensic tools and evidence items for inventory system
]]

local items = {
    -- Forensic Tools
    ['forensic_kit'] = {
        label = 'Forensic Kit',
        weight = 200,
        stack = true,
        description = 'General purpose evidence collection kit',
        client = {
            export = 'cad-system.useForensicKit'
        }
    },

    ['uv_flashlight'] = {
        label = 'UV Flashlight',
        weight = 150,
        stack = false,
        description = 'Reveals hidden blood and biological evidence',
        client = {
            export = 'cad-system.useUVFlashlight'
        }
    },

    ['fingerprint_powder'] = {
        label = 'Fingerprint Powder',
        weight = 50,
        stack = true,
        description = 'Reveals latent fingerprints on surfaces',
        client = {
            export = 'cad-system.useFingerprintPowder'
        }
    },

    ['fingerprint_tape'] = {
        label = 'Fingerprint Lifting Tape',
        weight = 10,
        stack = true,
        description = 'Used to lift and preserve fingerprints',
        client = {
            export = 'cad-system.useFingerprintTape'
        }
    },

    ['hydrogen_peroxide'] = {
        label = 'Hydrogen Peroxide',
        weight = 100,
        stack = true,
        description = 'Destroys blood evidence',
        client = {
            export = 'cad-system.useHydrogenPeroxide'
        }
    },

    -- Collected Evidence Items
    ['collected_blood'] = {
        label = 'Blood Sample',
        weight = 10,
        stack = false,
        description = 'Collected blood evidence in vial'
    },

    ['collected_fingerprint'] = {
        label = 'Fingerprint Card',
        weight = 5,
        stack = false,
        description = 'Lifted fingerprint preserved on card'
    },

    ['collected_casing'] = {
        label = 'Bullet Casing',
        weight = 15,
        stack = false,
        description = 'Recovered bullet casing in evidence bag'
    }
}

return items