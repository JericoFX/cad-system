CAD = CAD or {}
CAD.News = CAD.News or {}

CAD.State.News = CAD.State.News or {}
CAD.State.News.Articles = CAD.State.News.Articles or {}

local loadedFromDatabase = false

local VALID_STATUS = {
    DRAFT = true,
    PENDING_APPROVAL = true,
    PUBLISHED = true,
    EXPIRED = true,
    ARCHIVED = true,
}

local VALID_CATEGORIES = {
    BREAKING = true,
    POLICE = true,
    EMS = true,
    COMMUNITY = true,
    TRAFFIC = true,
    WEATHER = true,
    OFFICIAL = true,
}

local function newsFeatureEnabled()
    return CAD.IsFeatureEnabled('News')
end

local function isNewsJob(job)
    local normalized = tostring(job or ''):lower()
    if normalized == '' then
        return false
    end

    if normalized == 'reporter' or normalized == 'weazelnews' then
        return true
    end

    return CAD.Config.Security.AllowedJobs[normalized] == true or CAD.Config.Security.AdminJobs[normalized] == true
end

local function getNewsIdentity(source, write)
    local identity = CAD.Server.GetPlayerIdentity(source)
    if not identity then
        return nil, 'not_authorized'
    end

    if identity.isAdmin then
        return identity, nil
    end

    if write then
        local job = tostring(identity.job or ''):lower()
        if job ~= 'reporter' and job ~= 'weazelnews' then
            return nil, 'forbidden'
        end
        return identity, nil
    end

    if not isNewsJob(identity.job) then
        return nil, 'forbidden'
    end

    return identity, nil
end

local function clampPriority(value)
    local priority = math.floor(tonumber(value) or 3)
    if priority < 1 then
        return 1
    end
    if priority > 5 then
        return 5
    end
    return priority
end

local function sanitizeStatus(value)
    local status = CAD.Server.SanitizeString(value, 32):upper()
    if VALID_STATUS[status] then
        return status
    end
    return 'DRAFT'
end

local function sanitizeCategory(value)
    local category = CAD.Server.SanitizeString(value, 32):upper()
    if VALID_CATEGORIES[category] then
        return category
    end
    return 'COMMUNITY'
end

local function sanitizeArticle(payload, identity, existingArticle)
    if type(payload) ~= 'table' then
        return nil, 'invalid_article_payload'
    end

    local articleId = CAD.Server.SanitizeString(payload.articleId, 64)
    if articleId == '' then
        return nil, 'article_id_required'
    end

    local snapshot = CAD.DeepCopy(payload)
    snapshot.articleId = articleId
    snapshot.headline = CAD.Server.SanitizeString(snapshot.headline, 140)
    if snapshot.headline == '' then
        snapshot.headline = 'Sin titulo'
    end

    local subheadline = CAD.Server.SanitizeString(snapshot.subheadline, 180)
    snapshot.subheadline = subheadline ~= '' and subheadline or nil

    local location = CAD.Server.SanitizeString(snapshot.location, 120)
    snapshot.location = location ~= '' and location or nil

    local conclusion = CAD.Server.SanitizeString(snapshot.conclusion, 2000)
    snapshot.conclusion = conclusion ~= '' and conclusion or nil

    local relatedCaseId = CAD.Server.SanitizeString(snapshot.relatedCaseId, 64)
    snapshot.relatedCaseId = relatedCaseId ~= '' and relatedCaseId or nil

    local expiresAt = CAD.Server.SanitizeString(snapshot.expiresAt, 32)
    snapshot.expiresAt = expiresAt ~= '' and expiresAt or nil

    local publishedAt = CAD.Server.SanitizeString(snapshot.publishedAt, 32)
    snapshot.publishedAt = publishedAt ~= '' and publishedAt or nil

    local nowIso = CAD.Server.ToIso()
    local existingCreatedAt = CAD.Server.SanitizeString(existingArticle and existingArticle.createdAt, 32)
    if existingCreatedAt ~= '' then
        snapshot.createdAt = existingCreatedAt
    else
        snapshot.createdAt = nowIso
    end

    snapshot.updatedAt = nowIso

    snapshot.category = sanitizeCategory(snapshot.category)
    snapshot.priority = clampPriority(snapshot.priority)
    snapshot.status = sanitizeStatus(snapshot.status)
    snapshot.shareCode = CAD.Server.SanitizeString(snapshot.shareCode, 16)
    snapshot.lead = CAD.Server.SanitizeString(snapshot.lead, 600)
    snapshot.isPinned = snapshot.isPinned == true
    snapshot.viewCount = math.max(0, math.floor(tonumber(snapshot.viewCount) or 0))

    snapshot.paragraphs = type(snapshot.paragraphs) == 'table' and snapshot.paragraphs or {}
    snapshot.gallery = type(snapshot.gallery) == 'table' and snapshot.gallery or {}
    snapshot.attachments = type(snapshot.attachments) == 'table' and snapshot.attachments or {}
    snapshot.tags = type(snapshot.tags) == 'table' and snapshot.tags or {}

    local author = type(snapshot.author) == 'table' and snapshot.author or {}
    local authorId = CAD.Server.SanitizeString(author.id, 64)
    local authorName = CAD.Server.SanitizeString(author.name, 80)
    local authorGrade = CAD.Server.SanitizeString(author.grade, 24):upper()
    local authorBadge = CAD.Server.SanitizeString(author.badge, 32)

    snapshot.author = {
        id = authorId ~= '' and authorId or CAD.Server.SanitizeString(identity.identifier, 64),
        name = authorName ~= '' and authorName or CAD.Server.SanitizeString(identity.name, 80),
        grade = authorGrade ~= '' and authorGrade or 'REPORTER',
        badge = authorBadge ~= '' and authorBadge or nil,
    }

    return snapshot, nil
end

local function persistArticle(article)
    local ok, err = pcall(function()
        MySQL.insert.await([[
            INSERT INTO cad_news_articles (article_id, status, updated_at, payload)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                status = VALUES(status),
                updated_at = VALUES(updated_at),
                payload = VALUES(payload)
        ]], {
            article.articleId,
            article.status,
            article.updatedAt,
            json.encode(article),
        })
    end)

    if not ok then
        CAD.Log('error', 'Failed saving news article %s: %s', tostring(article.articleId), tostring(err))
        return false, 'db_write_failed'
    end

    return true, nil
end

local function removePersistedArticle(articleId)
    local ok, err = pcall(function()
        MySQL.query.await('DELETE FROM cad_news_articles WHERE article_id = ?', { articleId })
    end)

    if not ok then
        CAD.Log('error', 'Failed deleting news article %s: %s', tostring(articleId), tostring(err))
        return false, 'db_delete_failed'
    end

    return true, nil
end

local function loadArticlesFromDatabase()
    if loadedFromDatabase then
        return
    end

    loadedFromDatabase = true

    local ok, rows = pcall(function()
        return MySQL.query.await('SELECT article_id, payload FROM cad_news_articles', {})
    end)

    if not ok then
        CAD.Log('warn', 'Unable to load news articles: %s', tostring(rows))
        return
    end

    rows = rows or {}
    for i = 1, #rows do
        local row = rows[i]
        if type(row.payload) == 'string' and row.payload ~= '' then
            local decodeOk, article = pcall(json.decode, row.payload)
            if decodeOk and type(article) == 'table' then
                local articleId = CAD.Server.SanitizeString(article.articleId or row.article_id, 64)
                if articleId ~= '' then
                    article.articleId = articleId
                    CAD.State.News.Articles[articleId] = article
                end
            end
        end
    end

    CAD.Log('info', 'News loaded: %s article(s)', tostring(#rows))
end

local function listArticles()
    local output = {}
    for _, article in pairs(CAD.State.News.Articles) do
        output[#output + 1] = CAD.DeepCopy(article)
    end

    table.sort(output, function(a, b)
        return tostring(a.updatedAt or '') > tostring(b.updatedAt or '')
    end)

    return output
end

local function upsertNewsArticle(source, payload)
    if not newsFeatureEnabled() then
        return { ok = false, error = 'news_disabled' }
    end

    local identity, authErr = getNewsIdentity(source, true)
    if not identity then
        return { ok = false, error = authErr or 'forbidden' }
    end

    loadArticlesFromDatabase()

    payload = type(payload) == 'table' and payload or {}
    local articlePayload = type(payload.article) == 'table' and payload.article or payload
    local requestedArticleId = CAD.Server.SanitizeString(articlePayload and articlePayload.articleId, 64)
    local existing = requestedArticleId ~= '' and CAD.State.News.Articles[requestedArticleId] or nil

    local article, articleErr = sanitizeArticle(articlePayload, identity, existing)
    if not article then
        return { ok = false, error = articleErr or 'invalid_article_payload' }
    end

    existing = existing or CAD.State.News.Articles[article.articleId]
    if existing and existing.author and existing.author.id and existing.author.id ~= identity.identifier and not identity.isAdmin then
        return { ok = false, error = 'not_owner' }
    end

    CAD.State.News.Articles[article.articleId] = article
    local persisted, persistErr = persistArticle(article)
    if not persisted then
        return { ok = false, error = persistErr or 'db_write_failed' }
    end

    return {
        ok = true,
        articleId = article.articleId,
        updatedAt = article.updatedAt,
    }
end

lib.callback.register('cad:news:getArticles', CAD.Auth.WithGuard('default', function(source)
    if not newsFeatureEnabled() then
        return {
            ok = true,
            articles = {},
        }
    end

    local identity, authErr = getNewsIdentity(source, false)
    if not identity then
        return {
            ok = false,
            error = authErr or 'forbidden',
        }
    end

    loadArticlesFromDatabase()

    return {
        ok = true,
        articles = listArticles(),
    }
end))

lib.callback.register('cad:news:published', CAD.Auth.WithGuard('heavy', function(source, payload)
    return upsertNewsArticle(source, payload)
end))

lib.callback.register('cad:news:updated', CAD.Auth.WithGuard('heavy', function(source, payload)
    return upsertNewsArticle(source, payload)
end))

lib.callback.register('cad:news:expired', CAD.Auth.WithGuard('heavy', function(source, payload)
    return upsertNewsArticle(source, payload)
end))

lib.callback.register('cad:news:deleted', CAD.Auth.WithGuard('heavy', function(source, payload)
    if not newsFeatureEnabled() then
        return { ok = false, error = 'news_disabled' }
    end

    local identity, authErr = getNewsIdentity(source, true)
    if not identity then
        return { ok = false, error = authErr or 'forbidden' }
    end

    loadArticlesFromDatabase()

    payload = type(payload) == 'table' and payload or {}
    local articleId = CAD.Server.SanitizeString(payload.articleId, 64)
    if articleId == '' then
        return { ok = false, error = 'article_id_required' }
    end

    local current = CAD.State.News.Articles[articleId]
    if not current then
        return { ok = true, articleId = articleId }
    end

    local ownerId = current.author and CAD.Server.SanitizeString(current.author.id, 64) or ''
    if ownerId ~= '' and ownerId ~= identity.identifier and not identity.isAdmin then
        return { ok = false, error = 'not_owner' }
    end

    CAD.State.News.Articles[articleId] = nil

    local deleted, deleteErr = removePersistedArticle(articleId)
    if not deleted then
        return { ok = false, error = deleteErr or 'db_delete_failed' }
    end

    return {
        ok = true,
        articleId = articleId,
    }
end))
