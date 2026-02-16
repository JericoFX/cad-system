--[[
CAD Evidence Types Registry
]]
CAD = CAD or {}
CAD.EvidenceTypes = {
    blood = {
        label = 'Blood',
        icon = 'fa-droplet',
        collectItem = 'collected_blood',
        requiredTool = 'forensic_kit',
        schema = {
            bloodType = 'O+',
            dnaHash = function() return 'DNA_'..math.random(10000) end,
            quality = 100
        }
    },
    fingerprint = {
        label = 'Fingerprint',
        icon = 'fa-fingerprint',
        collectItem = 'collected_fingerprint',
        requiredTool = 'fingerprint_tape',
        schema = {
            hash = function() return 'FP_'..math.random(10000) end,
            quality = 100
        }
    },
    casing = {
        label = 'Casing',
        icon = 'fa-gun',
        collectItem = 'collected_casing',
        requiredTool = 'forensic_kit',
        schema = {
            caliber = '9mm',
            quality = 100
        }
    }
}

CAD.Tools = {
    forensic_kit = { label = 'Forensic Kit', collects = {'blood','casing'} },
    fingerprint_tape = { label = 'Fingerprint Tape', collects = {'fingerprint'} },
    uv_flashlight = { label = 'UV Light', reveals = {'blood'} },
    camera = {
        label = 'Evidence Camera',
        features = {
            fov = { min=20, max=90 },
            dof = true,
            flash = { range=15, intensity=1.0 }
        }
    }
}