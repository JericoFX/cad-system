

CAD = CAD or {}
CAD.Photos = CAD.Photos or {}

CAD.Photos.Providers = {}
CAD.Photos.State = {
    Photos = {},
    Staging = {},
    ReviewQueue = {},
    ReleasedPhotos = {},
    LastId = 0
}

local function generatePhotoId()
    CAD.Photos.State.LastId = CAD.Photos.State.LastId + 1
    return string.format('PHOTO_%s_%05d', os.time(), CAD.Photos.State.LastId)
end

function CAD.Photos.RegisterProvider(name, handler)
    if type(name) ~= 'string' or type(handler) ~= 'function' then
        CAD.Log('error', 'Invalid photo provider registration')
        return false
    end
    CAD.Photos.Providers[name] = handler
    CAD.Log('info', 'Registered photo provider: %s', name)
    return true
end

local function getProvider()
    local config = CAD.Config.PhotoSystem
    local providerName = config and config.Provider or 'screenshot-basic'
    return CAD.Photos.Providers[providerName] or CAD.Photos.Providers['screenshot-basic']
end

local function appendQueryParam(url, key, value)
    if type(url) ~= 'string' or url == '' then
        return url
    end

    local separator = string.find(url, '?', 1, true) and '&' or '?'
    return string.format('%s%s%s=%s', url, separator, key, value)
end

local function getUploadSelectionConfig()
    local photoConfig = CAD.Config.PhotoSystem or {}
    local upload = type(photoConfig.Upload) == 'table' and photoConfig.Upload or {}
    local methodByType = type(upload.MethodByType) == 'table' and upload.MethodByType or {}
    local apiConfig = type(photoConfig.UploadAPI) == 'table' and photoConfig.UploadAPI or {}

    local method = string.lower(tostring(methodByType.image or upload.Method or photoConfig.UploadMethod or 'server_proxy'))
    if method ~= 'server_proxy' and method ~= 'client_direct' then
        method = 'server_proxy'
    end

    local service = string.lower(tostring(upload.Service or apiConfig.Type or 'fivemanage'))

    return method, service, apiConfig
end

local function getFiveManageConfig(apiConfig)
    local cfg = type(apiConfig.FiveManage) == 'table' and apiConfig.FiveManage or {}

    return {
        formEndpoint = tostring(cfg.FormEndpoint or 'https://api.fivemanage.com/api/v3/file'),
        base64Endpoint = tostring(cfg.Base64Endpoint or 'https://api.fivemanage.com/api/v3/file/base64'),
        fieldName = tostring(cfg.FieldName or 'file'),
        apiKey = tostring(cfg.ApiKey or GetConvar('CAD_FIVEMANAGE_API_KEY', '')),
        useApiKeyQueryForClientDirect = cfg.UseApiKeyQueryForClientDirect == true,
        apiKeyQueryParam = tostring(cfg.ApiKeyQueryParam or 'apiKey'),
        filenamePrefix = CAD.Server.SanitizeString(cfg.FilenamePrefix, 64),
        uploadPath = CAD.Server.SanitizeString(cfg.Path, 120),
    }
end

local function getDiscordConfig(apiConfig)
    local cfg = type(apiConfig.Discord) == 'table' and apiConfig.Discord or {}
    return {
        webhook = tostring(cfg.Webhook or apiConfig.DiscordWebhook or GetConvar('CAD_DISCORD_WEBHOOK', '')),
        fieldName = tostring(cfg.FieldName or 'files[]'),
    }
end

local function getMedalConfig(apiConfig)
    local cfg = type(apiConfig.Medal) == 'table' and apiConfig.Medal or {}
    return {
        uploadUrl = tostring(cfg.UploadUrl or GetConvar('CAD_MEDAL_UPLOAD_URL', '')),
        fieldName = tostring(cfg.FieldName or 'file'),
        authHeader = tostring(cfg.AuthHeader or 'Authorization'),
        apiKey = tostring(cfg.ApiKey or GetConvar('CAD_MEDAL_API_KEY', '')),
        useApiKeyQueryForClientDirect = cfg.UseApiKeyQueryForClientDirect == true,
        apiKeyQueryParam = tostring(cfg.ApiKeyQueryParam or 'apiKey'),
    }
end

local function getCustomUploadConfig(apiConfig)
    local cfg = type(apiConfig.Custom) == 'table' and apiConfig.Custom or {}
    return {
        endpoint = tostring(cfg.Endpoint or apiConfig.CustomEndpoint or ''),
        fieldName = tostring(cfg.FieldName or apiConfig.CustomFieldName or 'file'),
        authHeader = tostring(cfg.AuthHeader or 'Authorization'),
        apiKey = tostring(cfg.ApiKey or ''),
        useApiKeyQueryForClientDirect = cfg.UseApiKeyQueryForClientDirect == true,
        apiKeyQueryParam = tostring(cfg.ApiKeyQueryParam or 'apiKey'),
        headers = type(cfg.Headers) == 'table' and cfg.Headers or {},
    }
end

local function getCaptureUploadConfig()
    local method, service, apiConfig = getUploadSelectionConfig()

    if method == 'server_proxy' then
        if service ~= 'fivemanage' then
            return nil, 'server_proxy_service_unsupported'
        end

        local fiveManage = getFiveManageConfig(apiConfig)
        if fiveManage.base64Endpoint == '' then
            return nil, 'fivemanage_base64_endpoint_missing'
        end
        if fiveManage.apiKey == '' then
            return nil, 'fivemanage_api_key_missing'
        end

        return {
            mode = 'server_proxy',
            provider = 'fivemanage',
            service = 'fivemanage',
        }
    end

    if service == 'fivemanage' then
        local fiveManage = getFiveManageConfig(apiConfig)
        local endpoint = fiveManage.formEndpoint
        if endpoint == '' then
            return nil, 'fivemanage_endpoint_missing'
        end

        local options = {}
        if fiveManage.apiKey ~= '' then
            if fiveManage.useApiKeyQueryForClientDirect then
                endpoint = appendQueryParam(endpoint, fiveManage.apiKeyQueryParam, fiveManage.apiKey)
            else
                options.headers = {
                    Authorization = fiveManage.apiKey,
                }
            end
        end

        return {
            mode = 'client_direct',
            provider = 'fivemanage',
            service = 'fivemanage',
            endpoint = endpoint,
            fieldName = fiveManage.fieldName,
            options = options,
        }
    end

    if service == 'discord' then
        local discord = getDiscordConfig(apiConfig)
        if discord.webhook == '' then
            return nil, 'discord_webhook_missing'
        end

        return {
            mode = 'client_direct',
            provider = 'discord',
            service = 'discord',
            endpoint = discord.webhook,
            fieldName = discord.fieldName,
            options = {},
        }
    end

    if service == 'medal' then
        local medal = getMedalConfig(apiConfig)
        if medal.uploadUrl == '' then
            return nil, 'medal_upload_url_missing'
        end

        local endpoint = medal.uploadUrl
        local options = {}
        if medal.apiKey ~= '' then
            if medal.useApiKeyQueryForClientDirect then
                endpoint = appendQueryParam(endpoint, medal.apiKeyQueryParam, medal.apiKey)
            else
                options.headers = {
                    [medal.authHeader] = medal.apiKey,
                }
            end
        end

        return {
            mode = 'client_direct',
            provider = 'medal',
            service = 'medal',
            endpoint = endpoint,
            fieldName = medal.fieldName,
            options = options,
        }
    end

    if service == 'custom' then
        local custom = getCustomUploadConfig(apiConfig)
        if custom.endpoint == '' then
            return nil, 'custom_endpoint_missing'
        end

        local headers = {}
        for key, value in pairs(custom.headers) do
            headers[key] = value
        end

        local endpoint = custom.endpoint
        local options = {
            headers = headers,
        }

        if custom.apiKey ~= '' then
            if custom.useApiKeyQueryForClientDirect then
                endpoint = appendQueryParam(endpoint, custom.apiKeyQueryParam, custom.apiKey)
            else
                options.headers[custom.authHeader] = custom.apiKey
            end
        end

        return {
            mode = 'client_direct',
            provider = 'custom',
            service = 'custom',
            endpoint = endpoint,
            fieldName = custom.fieldName,
            options = options,
        }
    end

    return nil, 'unsupported_upload_type'
end

local function isoToTime(value)
    if type(value) ~= 'string' then
        return nil
    end

    local year, month, day, hour, minute, second = string.match(value, '^(%d+)%-(%d+)%-(%d+)T(%d+):(%d+):(%d+)Z$')
    if not year then
        return nil
    end

    local parsedLocal = os.time({
        year = tonumber(year),
        month = tonumber(month),
        day = tonumber(day),
        hour = tonumber(hour),
        min = tonumber(minute),
        sec = tonumber(second),
    })

    if not parsedLocal then
        return nil
    end

    local utcOffset = os.difftime(os.time(), os.time(os.date('!*t')))
    return parsedLocal + utcOffset
end

local function decodeJson(raw)
    if type(raw) ~= 'string' or raw == '' then
        return nil
    end

    local ok, decoded = pcall(json.decode, raw)
    if not ok then
        return nil
    end

    if type(decoded) ~= 'table' then
        return nil
    end

    return decoded
end

local function extractUploadedUrl(responseBody)
    local decoded = decodeJson(responseBody)
    if not decoded then
        return nil
    end

    if type(decoded.data) == 'table' and type(decoded.data.url) == 'string' and decoded.data.url ~= '' then
        return decoded.data.url
    end

    if type(decoded.url) == 'string' and decoded.url ~= '' then
        return decoded.url
    end

    if type(decoded.image) == 'string' and decoded.image ~= '' then
        return decoded.image
    end

    if type(decoded.link) == 'string' and decoded.link ~= '' then
        return decoded.link
    end

    if type(decoded.attachments) == 'table' and type(decoded.attachments[1]) == 'table' then
        local attachment = decoded.attachments[1]
        if type(attachment.proxy_url) == 'string' and attachment.proxy_url ~= '' then
            return attachment.proxy_url
        end
        if type(attachment.url) == 'string' and attachment.url ~= '' then
            return attachment.url
        end
    end

    return nil
end

local function performHttpRequestAwait(url, method, body, headers)
    local pending = promise.new()

    PerformHttpRequest(url, function(statusCode, responseText, responseHeaders)
        pending:resolve({
            statusCode = tonumber(statusCode) or 0,
            responseText = responseText or '',
            responseHeaders = responseHeaders,
        })
    end, method, body, headers)

    return Citizen.Await(pending)
end

local function requestScreenshotDataUri(source)
    if GetResourceState('screenshot-basic') ~= 'started' then
        return nil, 'screenshot_basic_missing'
    end

    local pending = promise.new()
    local requestOk, requestErr = pcall(function()
        exports['screenshot-basic']:requestClientScreenshot(source, {
            encoding = 'jpg',
            quality = 0.92,
        }, function(err, data)
            if err then
                pending:resolve({ ok = false, error = tostring(err) })
                return
            end

            if type(data) ~= 'string' or data == '' then
                pending:resolve({ ok = false, error = 'screenshot_empty' })
                return
            end

            pending:resolve({ ok = true, data = data })
        end)
    end)

    if not requestOk then
        return nil, 'screenshot_request_failed:' .. tostring(requestErr)
    end

    local result = Citizen.Await(pending)
    if not result or result.ok ~= true then
        return nil, result and result.error or 'screenshot_failed'
    end

    return result.data, nil
end

local function uploadScreenshotToFiveManage(dataUri, payload)
    local _, _, apiConfig = getUploadSelectionConfig()
    local fiveManage = getFiveManageConfig(apiConfig)

    if fiveManage.base64Endpoint == '' then
        return nil, 'fivemanage_base64_endpoint_missing'
    end
    if fiveManage.apiKey == '' then
        return nil, 'fivemanage_api_key_missing'
    end

    local prefix = fiveManage.filenamePrefix ~= '' and fiveManage.filenamePrefix or 'cad_capture'
    local filename = string.format('%s_%s_%04d.jpg', prefix, os.date('%Y%m%d_%H%M%S'), math.random(0, 9999))

    local requestBody = {
        base64 = dataUri,
        filename = filename,
        metadata = json.encode({
            source = 'cad-system',
            category = tostring(payload and payload.job or 'unknown'),
            capturedAt = CAD.Server.ToIso(),
        }),
    }

    if fiveManage.uploadPath ~= '' then
        requestBody.path = fiveManage.uploadPath
    end

    local response = performHttpRequestAwait(
        fiveManage.base64Endpoint,
        'POST',
        json.encode(requestBody),
        {
            ['Content-Type'] = 'application/json',
            ['Authorization'] = fiveManage.apiKey,
        }
    )

    local statusCode = tonumber(response and response.statusCode) or 0
    if statusCode < 200 or statusCode >= 300 then
        return nil, 'fivemanage_upload_http_' .. tostring(statusCode)
    end

    local url = extractUploadedUrl(response and response.responseText)
    if not url then
        return nil, 'fivemanage_response_invalid'
    end

    return url, nil
end

local function uploadToExternalAPI(imageData, metadata)
    local config = CAD.Config.PhotoSystem
    local apiConfig = config and config.UploadAPI

    if not apiConfig then
        return nil, 'upload_config_missing'
    end

    local apiType = apiConfig.Type or 'discord'

    if apiType == 'discord' and apiConfig.DiscordWebhook and apiConfig.DiscordWebhook ~= '' then

        local boundary = '----CADBoundary' .. os.time()
        local filename = 'evidence_' .. os.time() .. '.jpg'

        local body = {}
        table.insert(body, '--' .. boundary)
        table.insert(body, 'Content-Disposition: form-data; name="content"')
        table.insert(body, '')
        table.insert(body, 'CAD Evidence Photo - ' .. (metadata.description or 'No description'))

        table.insert(body, '--' .. boundary)
        table.insert(body, 'Content-Disposition: form-data; name="files[0]"; filename="' .. filename .. '"')
        table.insert(body, 'Content-Type: image/jpeg')
        table.insert(body, '')

        table.insert(body, imageData)

        table.insert(body, '--' .. boundary .. '--')

        local formData = table.concat(body, '\r\n')

        return 'https://cdn.discordapp.com/attachments/.../photo.jpg', nil
    end

    if apiType == 'imgur' and apiConfig.ImgurClientId and apiConfig.ImgurClientId ~= '' then

        return nil, 'imgur_not_implemented'
    end

    return nil, 'no_upload_provider_configured'
end

CAD.Photos.RegisterProvider('screenshot-basic', function(source, payload)

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
        job = job,
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

        fov = payload.fov or {
            hit = false,
            distance = 0,
            entityType = nil
        },

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

        usedInArticles = {},

        releasedToPress = false,
        releasedBy = nil,
        releasedAt = nil,
        releaseReason = nil,
        releaseRestrictions = {
            editLevel = 'none',
            expiryDate = nil
        }
    }

    CAD.Photos.State.Photos[photoId] = metadata

    return metadata, nil
end

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

local function removePhotoFromAllStaging(photoId)
    for source, bucket in pairs(CAD.Photos.State.Staging) do
        if type(bucket) == 'table' then
            for i = #bucket, 1, -1 do
                if bucket[i] and bucket[i].photoId == photoId then
                    table.remove(bucket, i)
                end
            end

            if #bucket == 0 then
                CAD.Photos.State.Staging[source] = nil
            end
        end
    end
end

local function isSupervisor(officer)
    if not officer or not officer.grade then
        return false
    end

    local config = CAD.Config.PhotoSystem
    local requiredRank = config and config.ReleaseRanks and config.ReleaseRanks[officer.job]

    if not requiredRank then
        requiredRank = 3
    end

    return officer.grade >= requiredRank
end

local function withPhotoGuard(bucket, handler)
    return CAD.Auth.WithGuard(bucket, function(source, payload, officer)
        return handler(source, type(payload) == 'table' and payload or {}, officer)
    end)
end

lib.callback.register('cad:photos:getCaptureConfig', CAD.Auth.WithGuard('default', function()
    local uploadConfig, err = getCaptureUploadConfig()
    if not uploadConfig then
        return {
            ok = false,
            error = err or 'upload_config_missing',
        }
    end

    return {
        ok = true,
        mode = uploadConfig.mode,
        provider = uploadConfig.provider,
        endpoint = uploadConfig.endpoint,
        fieldName = uploadConfig.fieldName,
        options = uploadConfig.options,
    }
end))

lib.callback.register('cad:photos:uploadCapture', CAD.Auth.WithGuard('default', function(source, payload, officer)
    local uploadConfig, configErr = getCaptureUploadConfig()
    if not uploadConfig then
        return { ok = false, error = configErr or 'upload_config_missing' }
    end

    if uploadConfig.mode ~= 'server_proxy' then
        return { ok = false, error = 'capture_not_server_proxy' }
    end

    if not officer or not officer.job then
        return { ok = false, error = 'officer_not_found' }
    end

    local isAllowedJob = officer.job == 'police' or officer.job == 'sheriff' or officer.job == 'reporter' or
        officer.job == 'weazelnews'
    if not isAllowedJob then
        return { ok = false, error = 'invalid_job' }
    end

    local screenshotData, screenshotErr = requestScreenshotDataUri(source)
    if not screenshotData then
        return { ok = false, error = screenshotErr or 'screenshot_failed' }
    end

    local url, uploadErr = nil, nil
    if uploadConfig.provider == 'fivemanage' then
        url, uploadErr = uploadScreenshotToFiveManage(screenshotData, payload)
    else
        uploadErr = 'server_proxy_service_unsupported'
    end

    if not url then
        return { ok = false, error = uploadErr or 'upload_failed' }
    end

    return {
        ok = true,
        provider = uploadConfig.provider,
        url = url,
    }
end))

lib.callback.register('cad:photos:capturePolicePhoto', withPhotoGuard('default', function(source, payload, officer)

    if officer.job ~= 'police' and officer.job ~= 'sheriff' then
        return { ok = false, error = 'invalid_job' }
    end

    local provider = getProvider()
    if not provider then
        return { ok = false, error = 'no_provider_available' }
    end

    local metadata, err = createPhotoMetadata(source, payload, 'police')
    if not metadata then
        return { ok = false, error = err }
    end

    addToStaging(source, metadata.photoId)

    print(string.format('[CAD:Photos] Police photo captured: %s by %s',
        metadata.photoId, officer.name))

    CAD.Server.BroadcastToPlayer(source, 'photoCaptured', {
        photo = metadata
    })

    return {
        ok = true,
        photoId = metadata.photoId,
        stagingId = metadata.stagingId,
        metadata = metadata
    }
end))

lib.callback.register('cad:photos:captureNewsPhoto', withPhotoGuard('default', function(source, payload, officer)

    if officer.job ~= 'reporter' and officer.job ~= 'weazelnews' then
        return { ok = false, error = 'invalid_job' }
    end

    local provider = getProvider()
    if not provider then
        return { ok = false, error = 'no_provider_available' }
    end

    local metadata, err = createPhotoMetadata(source, payload, 'reporter')
    if not metadata then
        return { ok = false, error = err }
    end

    print(string.format('[CAD:Photos] News photo captured: %s by %s',
        metadata.photoId, officer.name))

    CAD.Server.BroadcastToPlayer(source, 'photoCaptured', {
        photo = metadata
    })

    return {
        ok = true,
        photoId = metadata.photoId,
        metadata = metadata
    }
end))

lib.callback.register('cad:photos:getInventoryPhotos', withPhotoGuard('default', function(_, _, officer)

    local photos = {}
    for photoId, photo in pairs(CAD.Photos.State.Photos) do
        if photo.takenByCitizenId == officer.identifier then
            table.insert(photos, photo)
        end
    end

    return { ok = true, photos = photos }
end))

lib.callback.register('cad:photos:getStagingPhotos', withPhotoGuard('default', function(source)

    local staging = CAD.Photos.State.Staging[source] or {}
    return { ok = true, photos = staging }
end))

lib.callback.register('cad:photos:releaseToPress', withPhotoGuard('heavy', function(_, payload, officer)

    if not isSupervisor(officer) then
        return { ok = false, error = 'insufficient_rank', required = 'Sargento+' }
    end

    local photoId = CAD.Server.SanitizeString(payload.photoId, 64)
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

    photo.releasedToPress = true
    photo.releasedBy = officer.identifier
    photo.releasedAt = CAD.Server.ToIso()
    photo.releaseReason = payload.reason or 'Authorized for press publication'
    photo.releaseRestrictions = {
        editLevel = 'none',
        expiryDate = payload.expiryDate or nil
    }

    CAD.Photos.State.ReleasedPhotos[photoId] = photo

    print(string.format('[CAD:Photos] Photo released to press: %s by %s',
        photoId, officer.name))

    return {
        ok = true,
        photoId = photoId,
        releasedAt = photo.releasedAt
    }
end))

lib.callback.register('cad:photos:getReleasedPhotos', withPhotoGuard('default', function()

    local photos = {}
    local now = os.time()
    for photoId, photo in pairs(CAD.Photos.State.ReleasedPhotos) do

        if photo.releaseRestrictions.expiryDate then
            local expiry = isoToTime(photo.releaseRestrictions.expiryDate)
            if expiry and now < expiry then
                table.insert(photos, photo)
            end
        else
            table.insert(photos, photo)
        end
    end

    table.sort(photos, function(a, b)
        return (a.releasedAt or '') > (b.releasedAt or '')
    end)

    return { ok = true, photos = photos }
end))

lib.callback.register('cad:photos:submitToPolice', withPhotoGuard('heavy', function(_, payload, officer)

    if officer.job ~= 'reporter' and officer.job ~= 'weazelnews' then
        return { ok = false, error = 'invalid_job' }
    end

    local photoId = CAD.Server.SanitizeString(payload.photoId, 64)
    local photo = CAD.Photos.State.Photos[photoId]

    if not photo then
        return { ok = false, error = 'photo_not_found' }
    end

    if photo.job ~= 'reporter' then
        return { ok = false, error = 'only_news_photos_submittable' }
    end

    local submissionId = 'SUBMIT_' .. os.time() .. '_' .. math.random(1000, 9999)
    local submission = {
        id = submissionId,
        photoId = photoId,
        submittedBy = officer.identifier,
        submittedByName = officer.name,
        caseId = CAD.Server.SanitizeString(payload.caseId, 64),
        reason = CAD.Server.SanitizeString(payload.reason, 300),
        status = 'PENDING_REVIEW',
        submittedAt = CAD.Server.ToIso(),
        reviewedBy = nil,
        reviewedAt = nil,
        reviewNotes = nil
    }

    if submission.caseId == '' then
        submission.caseId = nil
    end

    if submission.reason == '' then
        submission.reason = 'Submitted as potential evidence'
    end

    CAD.Photos.State.ReviewQueue[submissionId] = submission

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
end))

lib.callback.register('cad:photos:reviewSubmission', withPhotoGuard('heavy', function(source, payload, officer)

    if officer.job ~= 'police' and officer.job ~= 'sheriff' then
        return { ok = false, error = 'invalid_job' }
    end

    local submissionId = CAD.Server.SanitizeString(payload.submissionId, 64)
    local submission = CAD.Photos.State.ReviewQueue[submissionId]

    if not submission then
        return { ok = false, error = 'submission_not_found' }
    end

    if submission.status ~= 'PENDING_REVIEW' then
        return { ok = false, error = 'already_reviewed', status = submission.status }
    end

    local action = CAD.Server.SanitizeString(payload.action, 16):upper()
    if action ~= 'ACCEPT' and action ~= 'REJECT' then
        return { ok = false, error = 'invalid_action' }
    end

    submission.status = action == 'ACCEPT' and 'ACCEPTED' or 'REJECTED'
    submission.reviewedBy = officer.identifier
    submission.reviewedAt = CAD.Server.ToIso()
    submission.reviewNotes = CAD.Server.SanitizeString(payload.notes, 500)

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

            if submission.caseId then
                photo.attachedCaseId = submission.caseId
            end
        end
    end

    CAD.Photos.State.ReviewQueue[submissionId] = nil

    print(string.format('[CAD:Photos] Submission reviewed: %s - %s by %s',
        submissionId, submission.status, officer.name))

    return {
        ok = true,
        submissionId = submissionId,
        status = submission.status
    }
end))

lib.callback.register('cad:photos:getReviewQueue', withPhotoGuard('default', function(_, _, officer)

    if officer.job ~= 'police' and officer.job ~= 'sheriff' then
        return { ok = false, error = 'invalid_job' }
    end

    local queue = {}
    for id, submission in pairs(CAD.Photos.State.ReviewQueue) do
        if submission.status == 'PENDING_REVIEW' then
            table.insert(queue, submission)
        end
    end

    table.sort(queue, function(a, b)
        return (a.submittedAt or '') > (b.submittedAt or '')
    end)

    return { ok = true, queue = queue }
end))

lib.callback.register('cad:photos:attachToCase', withPhotoGuard('heavy', function(source, payload, officer)

    if officer.job ~= 'police' and officer.job ~= 'sheriff' then
        return { ok = false, error = 'invalid_job' }
    end

    local photoId = CAD.Server.SanitizeString(payload.photoId, 64)
    local caseId = CAD.Server.SanitizeString(payload.caseId, 64)

    local caseObj = CAD.State.Cases and CAD.State.Cases[caseId] or nil
    if not caseObj then
        return { ok = false, error = 'case_not_found' }
    end

    local photo = CAD.Photos.State.Photos[photoId]
    if not photo then
        return { ok = false, error = 'photo_not_found' }
    end

    photo.attachedCaseId = caseId
    photo.custodyChain = photo.custodyChain or {}
    table.insert(photo.custodyChain, {
        eventId = 'CUSTODY_' .. os.time(),
        eventType = 'ATTACHED_TO_CASE',
        timestamp = CAD.Server.ToIso(),
        recordedBy = officer.identifier,
        notes = string.format('Attached to case %s', caseId)
    })

    local evidence = {
        evidenceId = CAD.Server.GenerateId('EVID'),
        caseId = caseId,
        evidenceType = 'PHOTO',
        data = {
            url = photo.photoUrl,
            photoId = photo.photoId,
            description = photo.description,
            location = photo.location,
            takenAt = photo.takenAt,
            takenBy = photo.takenBy,
            provider = photo.provider,
            fov = photo.fov,
        },
        attachedBy = officer.identifier,
        attachedAt = CAD.Server.ToIso(),
        custodyChain = {
            {
                eventId = CAD.Server.GenerateId('CUSTODY'),
                evidenceId = '',
                eventType = 'ATTACHED_FROM_PHOTO_STAGING',
                location = photo.location and string.format('%.2f, %.2f, %.2f', photo.location.x or 0.0, photo.location.y or 0.0, photo.location.z or 0.0) or 'Unknown',
                notes = ('Photo %s attached to case %s'):format(photo.photoId, caseId),
                timestamp = CAD.Server.ToIso(),
                recordedBy = officer.identifier,
            }
        },
    }
    evidence.custodyChain[1].evidenceId = evidence.evidenceId

    if CAD.Evidence and type(CAD.Evidence.AppendCaseEvidence) == 'function' then
        local ok, appendErr = CAD.Evidence.AppendCaseEvidence(caseId, evidence)
        if not ok then
            return { ok = false, error = appendErr or 'cannot_attach_evidence' }
        end
    else
        caseObj.evidence = caseObj.evidence or {}
        caseObj.evidence[#caseObj.evidence + 1] = evidence
        caseObj.updatedAt = CAD.Server.ToIso()

        if CAD.Cases and type(CAD.Cases.PublishPublicState) == 'function' then
            CAD.Cases.PublishPublicState(false)
        end
    end

    removePhotoFromAllStaging(photoId)

    CAD.Log('info', 'Photo %s attached to case %s by %s', photoId, caseId, officer.name)

    return {
        ok = true,
        photoId = photoId,
        caseId = caseId,
        evidenceId = evidence.evidenceId,
    }
end))

lib.callback.register('cad:photos:getPhoto', CAD.Auth.WithGuard('default', function(source, payload, officer)
    if not officer then
        return { ok = false, error = 'officer_not_found' }
    end

    local photoIdRaw = type(payload) == 'string' and payload or (payload and payload.photoId)
    local photoId = CAD.Server.SanitizeString(photoIdRaw, 64)
    if photoId == '' then
        return { ok = false, error = 'photo_id_required' }
    end

    local photo = CAD.Photos.State.Photos[photoId]
    if not photo then
        return { ok = false, error = 'photo_not_found' }
    end

    local isOwner = photo.takenByCitizenId == officer.identifier
    local isLaw = officer.job == 'police' or officer.job == 'sheriff'
    local isMedia = officer.job == 'reporter' or officer.job == 'weazelnews'
    local canView = officer.isAdmin == true or isOwner or photo.releasedToPress == true

    if not canView and isLaw and (photo.job == 'police' or photo.isEvidence == true or photo.attachedCaseId ~= nil) then
        canView = true
    end

    if not canView and isMedia and photo.job == 'reporter' then
        canView = true
    end

    if not canView then
        return { ok = false, error = 'not_owner' }
    end

    return { ok = true, photo = CAD.DeepCopy(photo) }
end))

lib.callback.register('cad:photos:updateDescription', CAD.Auth.WithGuard('default', function(_, payload, officer)
    if not officer then
        return { ok = false, error = 'officer_not_found' }
    end

    local photoId = CAD.Server.SanitizeString(payload and payload.photoId, 64)
    local description = CAD.Server.SanitizeString(payload and payload.description, 300)
    if photoId == '' then
        return { ok = false, error = 'photo_id_required' }
    end

    local photo = CAD.Photos.State.Photos[photoId]
    if not photo then
        return { ok = false, error = 'photo_not_found' }
    end

    local canEdit = officer.isAdmin == true or photo.takenByCitizenId == officer.identifier
    if not canEdit then
        return { ok = false, error = 'not_owner' }
    end

    photo.description = description
    return { ok = true, photoId = photoId }
end))

lib.callback.register('cad:photos:deletePhoto', CAD.Auth.WithGuard('heavy', function(source, payload, officer)
    if not officer then
        return { ok = false, error = 'officer_not_found' }
    end

    local photoId = CAD.Server.SanitizeString(payload and payload.photoId, 64)
    if photoId == '' then
        return { ok = false, error = 'photo_id_required' }
    end

    local photo = CAD.Photos.State.Photos[photoId]
    if not photo then
        return { ok = false, error = 'photo_not_found' }
    end

    local canDelete = officer.isAdmin == true or photo.takenByCitizenId == officer.identifier
    if not canDelete then
        return { ok = false, error = 'not_owner' }
    end

    CAD.Photos.State.Photos[photoId] = nil

    local staging = CAD.Photos.State.Staging[source]
    if type(staging) == 'table' then
        for i = #staging, 1, -1 do
            if staging[i].photoId == photoId then
                table.remove(staging, i)
            end
        end
    end

    return { ok = true, photoId = photoId }
end))

CAD.Log('info', 'Photo system initialized')
