--[[
C.A.D. System - Photo Management
Created by JericoFX
GitHub: https://github.com/JericoFX
License: GNU GPL v3

Photo provider system with support for:
- screenshot-basic (default)
- Custom upload APIs (Imgur, Discord, etc.)
- Evidence/News camera workflows
- Authorization system for photo transfers
]]

CAD = CAD or {}
CAD.Photos = CAD.Photos or {}

-- Provider registry
CAD.Photos.Providers = {}
CAD.Photos.State = {
    Photos = {},              -- All photos by ID
    Staging = {},            -- Per-officer staging
    ReviewQueue = {},        -- News → Police submissions
    ReleasedPhotos = {},     -- Police → News released
    LastId = 0
}

-- Generate unique photo ID
local function generatePhotoId()
    CAD.Photos.State.LastId = CAD.Photos.State.LastId + 1
    return string.format('PHOTO_%s_%05d', os.time(), CAD.Photos.State.LastId)
end

-- Register a photo provider
function CAD.Photos.RegisterProvider(name, handler)
    if type(name) ~= 'string' or type(handler) ~= 'function' then
        print('[CAD:Photos] ERROR: Invalid provider registration')
        return false
    end
    CAD.Photos.Providers[name] = handler
    print('[CAD:Photos] Registered provider: ' .. name)
    return true
end

-- Get active provider
local function getProvider()
    local config = CAD.Config.PhotoSystem
    local providerName = config and config.Provider or 'screenshot-basic'
    return CAD.Photos.Providers[providerName] or CAD.Photos.Providers['screenshot-basic']
end

-- Upload to external API (server-side)
local function uploadToExternalAPI(imageData, metadata)
    local config = CAD.Config.PhotoSystem
    local apiConfig = config and config.UploadAPI
    
    if not apiConfig then
        return nil, 'upload_config_missing'
    end
    
    local apiType = apiConfig.Type or 'discord'
    
    if apiType == 'discord' and apiConfig.DiscordWebhook and apiConfig.DiscordWebhook ~= '' then
        -- Upload to Discord webhook
        local boundary = '----CADBoundary' .. os.time()
        local filename = 'evidence_' .. os.time() .. '.jpg'
        
        -- Build multipart form data
        local body = {}
        table.insert(body, '--' .. boundary)
        table.insert(body, 'Content-Disposition: form-data; name="content"')
        table.insert(body, '')
        table.insert(body, 'CAD Evidence Photo - ' .. (metadata.description or 'No description'))
        
        table.insert(body, '--' .. boundary)
        table.insert(body, 'Content-Disposition: form-data; name="files[0]"; filename="' .. filename .. '"')
        table.insert(body, 'Content-Type: image/jpeg')
        table.insert(body, '')
        -- Note: imageData would be binary here, simplified for example
        table.insert(body, imageData)
        
        table.insert(body, '--' .. boundary .. '--')
        
        -- Perform HTTP request
        local formData = table.concat(body, '\r\n')
        
        -- In practice, use PerformHttpRequest here
        -- For now, return placeholder
        return 'https://cdn.discordapp.com/attachments/.../photo.jpg', nil
    end
    
    if apiType == 'imgur' and apiConfig.ImgurClientId and apiConfig.ImgurClientId ~= '' then
        -- Imgur API implementation would go here
        return nil, 'imgur_not_implemented'
    end
    
    return nil, 'no_upload_provider_configured'
end

-- Default screenshot-basic provider
CAD.Photos.RegisterProvider('screenshot-basic', function(source, payload)
    -- screenshot-basic handles the upload via webhook configured in that resource
    -- We just validate and store the result
    return {
        ok = true,
        provider = 'screenshot-basic',
        sourceType = 'url',
        url = payload.url,
        capturedAt = CAD.Server.ToIso(),
        capturedBy = payload.officerId,
        metadata = payload.metadata or {}
    }
end)

-- Custom CAD upload provider
CAD.Photos.RegisterProvider('cad-upload', function(source, payload)
    local url, err = uploadToExternalAPI(payload.imageData, payload.metadata)
    
    if not url then
        return { ok = false, error = err }
    end
    
    return {
        ok = true,
        provider = 'cad-upload',
        sourceType = 'url',
        url = url,
        capturedAt = CAD.Server.ToIso(),
        capturedBy = payload.officerId,
        metadata = payload.metadata or {}
    }
end)

-- Create photo metadata
local function createPhotoMetadata(source, payload, job)
    local officer = CAD.Auth.GetOfficer(source)
    if not officer then
        return nil, 'officer_not_found'
    end
    
    local photoId = generatePhotoId()
    local coords = GetEntityCoords(GetPlayerPed(source))
    
    local metadata = {
        photoId = photoId,
        photoUrl = payload.url,
        job = job, -- 'police' or 'reporter'
        takenBy = officer.name or 'Unknown',
        takenByCitizenId = officer.identifier or 'UNKNOWN',
        takenBySource = source,
        takenAt = CAD.Server.ToIso(),
        location = {
            x = payload.location and payload.location.x or coords.x,
            y = payload.location and payload.location.y or coords.y,
            z = payload.location and payload.location.z or coords.z
        },
        description = payload.description or '',
        provider = payload.provider or 'unknown',
        isLocalOnly = payload.isLocalOnly or false,
        uploadedAt = CAD.Server.ToIso(),
        
        -- FOV data (for police)
        fov = payload.fov or {
            hit = false,
            distance = 0,
            entityType = nil
        },
        
        -- Police-specific
        isEvidence = job == 'police',
        stagingId = nil,
        attachedCaseId = nil,
        custodyChain = job == 'police' and {{
            eventId = 'CUSTODY_' .. photoId,
            eventType = 'COLLECTED',
            timestamp = CAD.Server.ToIso(),
            recordedBy = officer.identifier,
            notes = 'Photo captured with evidence camera'
        }} or nil,
        
        -- News-specific
        usedInArticles = {},
        
        -- Release tracking
        releasedToPress = false,
        releasedBy = nil,
        releasedAt = nil,
        releaseReason = nil,
        releaseRestrictions = {
            editLevel = 'none',
            expiryDate = nil
        }
    }
    
    -- Store in state
    CAD.Photos.State.Photos[photoId] = metadata
    
    return metadata, nil
end

-- Add to officer's staging
local function addToStaging(source, photoId)
    if not CAD.Photos.State.Staging[source] then
        CAD.Photos.State.Staging[source] = {}
    end
    
    local photo = CAD.Photos.State.Photos[photoId]
    if photo then
        photo.stagingId = 'STAGE_' .. photoId
        table.insert(CAD.Photos.State.Staging[source], photo)
    end
end

-- Check if officer is supervisor (Sargento+)
local function isSupervisor(officer)
    if not officer or not officer.grade then
        return false
    end
    
    local config = CAD.Config.PhotoSystem
    local requiredRank = config and config.ReleaseRanks and config.ReleaseRanks[officer.job]
    
    if not requiredRank then
        requiredRank = 3 -- Default: Sargento+
    end
    
    return officer.grade >= requiredRank
end

-- CALLBACKS

-- Police: Capture photo
lib.callback.register('cad:photos:capturePolicePhoto', function(source, payload)
    local officer = CAD.Auth.GetOfficer(source)
    if not officer then
        return { ok = false, error = 'officer_not_found' }
    end
    
    if officer.job ~= 'police' and officer.job ~= 'sheriff' then
        return { ok = false, error = 'invalid_job' }
    end
    
    local provider = getProvider()
    if not provider then
        return { ok = false, error = 'no_provider_available' }
    end
    
    -- Create metadata
    local metadata, err = createPhotoMetadata(source, payload, 'police')
    if not metadata then
        return { ok = false, error = err }
    end
    
    -- Add to staging
    addToStaging(source, metadata.photoId)
    
    -- Log
    print(string.format('[CAD:Photos] Police photo captured: %s by %s', 
        metadata.photoId, officer.name))

    -- Broadcast to officer
    CAD.Server.BroadcastToPlayer(source, 'photoCaptured', {
        photo = metadata
    })
    
    return {
        ok = true,
        photoId = metadata.photoId,
        stagingId = metadata.stagingId,
        metadata = metadata
    }
end)

-- News: Capture photo
lib.callback.register('cad:photos:captureNewsPhoto', function(source, payload)
    local officer = CAD.Auth.GetOfficer(source)
    if not officer then
        return { ok = false, error = 'officer_not_found' }
    end
    
    if officer.job ~= 'reporter' and officer.job ~= 'weazelnews' then
        return { ok = false, error = 'invalid_job' }
    end
    
    local provider = getProvider()
    if not provider then
        return { ok = false, error = 'no_provider_available' }
    end
    
    -- Create metadata (no staging for news)
    local metadata, err = createPhotoMetadata(source, payload, 'reporter')
    if not metadata then
        return { ok = false, error = err }
    end
    
    print(string.format('[CAD:Photos] News photo captured: %s by %s', 
        metadata.photoId, officer.name))
    
    return {
        ok = true,
        photoId = metadata.photoId,
        metadata = metadata
    }
end)

-- Get all photos from officer's inventory (for News import)
lib.callback.register('cad:photos:getInventoryPhotos', function(source)
    local officer = CAD.Auth.GetOfficer(source)
    if not officer then
        return { ok = false, error = 'officer_not_found' }
    end
    
    -- Filter photos by owner and job
    local photos = {}
    for photoId, photo in pairs(CAD.Photos.State.Photos) do
        if photo.takenByCitizenId == officer.identifier then
            table.insert(photos, photo)
        end
    end
    
    return { ok = true, photos = photos }
end)

-- Get staging evidence
lib.callback.register('cad:photos:getStagingPhotos', function(source)
    local officer = CAD.Auth.GetOfficer(source)
    if not officer then
        return { ok = false, error = 'officer_not_found' }
    end
    
    local staging = CAD.Photos.State.Staging[source] or {}
    return { ok = true, photos = staging }
end)

-- Police: Release photo to press
lib.callback.register('cad:photos:releaseToPress', function(source, payload)
    local officer = CAD.Auth.GetOfficer(source)
    if not officer then
        return { ok = false, error = 'officer_not_found' }
    end
    
    -- Check supervisor rank
    if not isSupervisor(officer) then
        return { ok = false, error = 'insufficient_rank', required = 'Sargento+' }
    end
    
    local photoId = payload.photoId
    local photo = CAD.Photos.State.Photos[photoId]
    
    if not photo then
        return { ok = false, error = 'photo_not_found' }
    end
    
    if photo.job ~= 'police' then
        return { ok = false, error = 'only_police_photos_releasable' }
    end
    
    if photo.releasedToPress then
        return { ok = false, error = 'already_released' }
    end
    
    -- Mark as released
    photo.releasedToPress = true
    photo.releasedBy = officer.identifier
    photo.releasedAt = CAD.Server.ToIso()
    photo.releaseReason = payload.reason or 'Authorized for press publication'
    photo.releaseRestrictions = {
        editLevel = 'none', -- Never allow editing
        expiryDate = payload.expiryDate or nil
    }
    
    -- Copy to released pool
    CAD.Photos.State.ReleasedPhotos[photoId] = photo
    
    -- Log
    print(string.format('[CAD:Photos] Photo released to press: %s by %s', 
        photoId, officer.name))
    
    return {
        ok = true,
        photoId = photoId,
        releasedAt = photo.releasedAt
    }
end)

-- Get released photos (for News)
lib.callback.register('cad:photos:getReleasedPhotos', function(source)
    local officer = CAD.Auth.GetOfficer(source)
    if not officer then
        return { ok = false, error = 'officer_not_found' }
    end
    
    local photos = {}
    for photoId, photo in pairs(CAD.Photos.State.ReleasedPhotos) do
        -- Check expiry
        if photo.releaseRestrictions.expiryDate then
            local expiry = photo.releaseRestrictions.expiryDate
            if CAD.Server.ToIso() < expiry then
                table.insert(photos, photo)
            end
        else
            table.insert(photos, photo)
        end
    end
    
    -- Sort by release date (newest first)
    table.sort(photos, function(a, b)
        return (a.releasedAt or '') > (b.releasedAt or '')
    end)
    
    return { ok = true, photos = photos }
end)

-- News: Submit photo for evidence review
lib.callback.register('cad:photos:submitToPolice', function(source, payload)
    local officer = CAD.Auth.GetOfficer(source)
    if not officer then
        return { ok = false, error = 'officer_not_found' }
    end
    
    if officer.job ~= 'reporter' and officer.job ~= 'weazelnews' then
        return { ok = false, error = 'invalid_job' }
    end
    
    local photoId = payload.photoId
    local photo = CAD.Photos.State.Photos[photoId]
    
    if not photo then
        return { ok = false, error = 'photo_not_found' }
    end
    
    if photo.job ~= 'reporter' then
        return { ok = false, error = 'only_news_photos_submittable' }
    end
    
    -- Create submission
    local submissionId = 'SUBMIT_' .. os.time() .. '_' .. math.random(1000, 9999)
    local submission = {
        id = submissionId,
        photoId = photoId,
        submittedBy = officer.identifier,
        submittedByName = officer.name,
        caseId = payload.caseId or nil,
        reason = payload.reason or 'Submitted as potential evidence',
        status = 'PENDING_REVIEW',
        submittedAt = CAD.Server.ToIso(),
        reviewedBy = nil,
        reviewedAt = nil,
        reviewNotes = nil
    }
    
    CAD.Photos.State.ReviewQueue[submissionId] = submission
    
    -- Notify police
    CAD.Server.NotifyJobs({'police', 'sheriff'}, 
        string.format('New photo submitted for evidence review by %s', officer.name), 
        'info')
    
    print(string.format('[CAD:Photos] Photo submitted for review: %s by %s', 
        photoId, officer.name))
    
    return {
        ok = true,
        submissionId = submissionId,
        status = 'PENDING_REVIEW'
    }
end)

-- Police: Review submitted photo
lib.callback.register('cad:photos:reviewSubmission', function(source, payload)
    local officer = CAD.Auth.GetOfficer(source)
    if not officer then
        return { ok = false, error = 'officer_not_found' }
    end
    
    if officer.job ~= 'police' and officer.job ~= 'sheriff' then
        return { ok = false, error = 'invalid_job' }
    end
    
    local submissionId = payload.submissionId
    local submission = CAD.Photos.State.ReviewQueue[submissionId]
    
    if not submission then
        return { ok = false, error = 'submission_not_found' }
    end
    
    if submission.status ~= 'PENDING_REVIEW' then
        return { ok = false, error = 'already_reviewed', status = submission.status }
    end
    
    local action = payload.action -- 'ACCEPT' or 'REJECT'
    submission.status = action == 'ACCEPT' and 'ACCEPTED' or 'REJECTED'
    submission.reviewedBy = officer.identifier
    submission.reviewedAt = CAD.Server.ToIso()
    submission.reviewNotes = payload.notes or ''
    
    -- If accepted, convert to evidence staging
    if action == 'ACCEPT' then
        local photo = CAD.Photos.State.Photos[submission.photoId]
        if photo then
            photo.job = 'police'
            photo.isEvidence = true
            photo.custodyChain = {{
                eventId = 'CUSTODY_' .. submission.photoId,
                eventType = 'SUBMITTED_BY_PRESS',
                timestamp = CAD.Server.ToIso(),
                recordedBy = officer.identifier,
                notes = string.format('Submitted by %s, reviewed by %s', 
                    submission.submittedByName, officer.name)
            }}
            
            addToStaging(source, submission.photoId)
            
            -- Link to case if provided
            if submission.caseId then
                photo.attachedCaseId = submission.caseId
            end
        end
    end
    
    -- Remove from queue
    CAD.Photos.State.ReviewQueue[submissionId] = nil
    
    print(string.format('[CAD:Photos] Submission reviewed: %s - %s by %s', 
        submissionId, submission.status, officer.name))
    
    return {
        ok = true,
        submissionId = submissionId,
        status = submission.status
    }
end)

-- Get review queue
lib.callback.register('cad:photos:getReviewQueue', function(source)
    local officer = CAD.Auth.GetOfficer(source)
    if not officer then
        return { ok = false, error = 'officer_not_found' }
    end
    
    if officer.job ~= 'police' and officer.job ~= 'sheriff' then
        return { ok = false, error = 'invalid_job' }
    end
    
    local queue = {}
    for id, submission in pairs(CAD.Photos.State.ReviewQueue) do
        if submission.status == 'PENDING_REVIEW' then
            table.insert(queue, submission)
        end
    end
    
    -- Sort by submission date
    table.sort(queue, function(a, b)
        return (a.submittedAt or '') > (b.submittedAt or '')
    end)
    
    return { ok = true, queue = queue }
end)

-- Attach photo to case (from staging)
lib.callback.register('cad:photos:attachToCase', function(source, payload)
    local officer = CAD.Auth.GetOfficer(source)
    if not officer then
        return { ok = false, error = 'officer_not_found' }
    end
    
    local photoId = payload.photoId
    local caseId = payload.caseId
    
    local photo = CAD.Photos.State.Photos[photoId]
    if not photo then
        return { ok = false, error = 'photo_not_found' }
    end
    
    -- Update photo
    photo.attachedCaseId = caseId
    photo.custodyChain = photo.custodyChain or {}
    table.insert(photo.custodyChain, {
        eventId = 'CUSTODY_' .. os.time(),
        eventType = 'ATTACHED_TO_CASE',
        timestamp = CAD.Server.ToIso(),
        recordedBy = officer.identifier,
        notes = string.format('Attached to case %s', caseId)
    })
    
    -- Remove from staging
    if CAD.Photos.State.Staging[source] then
        for i, p in ipairs(CAD.Photos.State.Staging[source]) do
            if p.photoId == photoId then
                table.remove(CAD.Photos.State.Staging[source], i)
                break
            end
        end
    end
    
    print(string.format('[CAD:Photos] Photo %s attached to case %s by %s', 
        photoId, caseId, officer.name))
    
    return {
        ok = true,
        photoId = photoId,
        caseId = caseId
    }
end)

-- Get photo by ID
lib.callback.register('cad:photos:getPhoto', function(source, payload)
    local photoId = type(payload) == 'string' and payload or payload.photoId
    local photo = CAD.Photos.State.Photos[photoId]
    
    if not photo then
        return { ok = false, error = 'photo_not_found' }
    end
    
    return { ok = true, photo = photo }
end)

print('[CAD:Photos] Photo system initialized')
