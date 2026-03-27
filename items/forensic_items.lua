

local items = {

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
    },

    ['security_camera'] = {
        label = 'Security Camera',
        weight = 350,
        stack = false,
        description = 'Deployable CCTV camera for dispatch live grid',
        client = {
            export = 'cad-system.useSecurityCamera'
        }
    },

    ['cad_evidence_item'] = {
        label = 'Evidence Record',
        weight = 0,
        stack = false,
        close = true,
        description = 'CAD evidence record with linked case metadata',
    },

    ['cad_ticket'] = {
        label = 'Citation',
        weight = 0,
        stack = false,
        close = true,
        description = 'Traffic citation or fine record',
    },

    ['cad_blood_sample'] = {
        label = 'Blood Evidence Sample',
        weight = 50,
        stack = false,
        close = true,
        description = 'Collected blood sample for forensic analysis',
    },
}

return items
