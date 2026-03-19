

CAD = CAD or {}
CAD.Database = CAD.Database or {}

local function execute(query)
    local ok, err = pcall(function()
        MySQL.query.await(query)
    end)
    if not ok then
        CAD.Log('error', 'Schema query failed: %s', tostring(err))
    end
end

local function executeOptional(query, context)
    local ok, err = pcall(function()
        MySQL.query.await(query)
    end)

    if not ok then
        CAD.Log('warn', 'Optional schema query skipped (%s): %s', tostring(context or 'unknown'), tostring(err))
        return false
    end

    return true
end

function CAD.Database.EnsureSchema()
    execute([[
        CREATE TABLE IF NOT EXISTS cad_cases (
            case_id VARCHAR(64) PRIMARY KEY,
            case_type VARCHAR(64) NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            status VARCHAR(32) NOT NULL,
            priority INT NOT NULL DEFAULT 2,
            created_by VARCHAR(128) NOT NULL,
            assigned_to VARCHAR(128) NULL,
            linked_call_id VARCHAR(64) NULL,
            person_id VARCHAR(64) NULL,
            person_name VARCHAR(128) NULL,
            created_at VARCHAR(32) NOT NULL,
            updated_at VARCHAR(32) NOT NULL,
            INDEX idx_cases_status_created (status, created_at)
        )
    ]])

    execute([[
        CREATE TABLE IF NOT EXISTS cad_case_notes (
            note_id VARCHAR(64) PRIMARY KEY,
            case_id VARCHAR(64) NOT NULL,
            author VARCHAR(128) NOT NULL,
            content TEXT NOT NULL,
            note_type VARCHAR(32) NOT NULL,
            timestamp VARCHAR(32) NOT NULL,
            INDEX idx_case_notes_case_id (case_id)
        )
    ]])

    execute([[
        CREATE TABLE IF NOT EXISTS cad_case_tasks (
            task_id VARCHAR(64) PRIMARY KEY,
            case_id VARCHAR(64) NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            status VARCHAR(32) NOT NULL,
            due_date VARCHAR(32) NULL,
            created_by VARCHAR(128) NOT NULL,
            created_at VARCHAR(32) NOT NULL,
            completed_at VARCHAR(32) NULL,
            INDEX idx_case_tasks_case_id (case_id)
        )
    ]])

    execute([[
        CREATE TABLE IF NOT EXISTS cad_evidence (
            evidence_id VARCHAR(64) PRIMARY KEY,
            case_id VARCHAR(64) NOT NULL,
            evidence_type VARCHAR(64) NOT NULL,
            payload LONGTEXT NOT NULL,
            attached_by VARCHAR(128) NOT NULL,
            attached_at VARCHAR(32) NOT NULL,
            custody_chain LONGTEXT NOT NULL,
            INDEX idx_evidence_case_id (case_id),
            INDEX idx_evidence_staging (case_id, attached_at)
        )
    ]])

    execute([[
        CREATE TABLE IF NOT EXISTS cad_dispatch_calls (
            call_id VARCHAR(64) PRIMARY KEY,
            call_type VARCHAR(64) NOT NULL,
            priority INT NOT NULL DEFAULT 2,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            location VARCHAR(255) NULL,
            coordinates LONGTEXT NULL,
            status VARCHAR(32) NOT NULL,
            assigned_units LONGTEXT NOT NULL,
            created_at VARCHAR(32) NOT NULL,
            INDEX idx_calls_status_created (status, created_at)
        )
    ]])

    execute([[
        CREATE TABLE IF NOT EXISTS cad_fines (
            fine_id VARCHAR(64) PRIMARY KEY,
            target_type VARCHAR(32) NOT NULL,
            target_id VARCHAR(128) NOT NULL,
            target_name VARCHAR(128) NULL,
            fine_code VARCHAR(32) NOT NULL,
            description VARCHAR(255) NOT NULL,
            amount INT NOT NULL,
            jail_time INT NOT NULL DEFAULT 0,
            issued_by VARCHAR(128) NOT NULL,
            issued_by_name VARCHAR(128) NOT NULL,
            issued_at VARCHAR(32) NOT NULL,
            paid TINYINT NOT NULL DEFAULT 0,
            paid_at VARCHAR(32) NULL,
            paid_method VARCHAR(64) NULL,
            status VARCHAR(32) NOT NULL,
            is_bail TINYINT NOT NULL DEFAULT 0,
            INDEX idx_fines_target_id (target_id),
            INDEX idx_fines_status_paid (status, paid_at)
        )
    ]])

    execute([[
        CREATE TABLE IF NOT EXISTS cad_ems_alerts (
            alert_id VARCHAR(64) PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            severity VARCHAR(32) NOT NULL,
            coords LONGTEXT NULL,
            status VARCHAR(32) NOT NULL,
            created_by VARCHAR(128) NOT NULL,
            created_at VARCHAR(32) NOT NULL,
            INDEX idx_alerts_status_created (status, created_at)
        )
    ]])

    execute([[
        CREATE TABLE IF NOT EXISTS cad_ems_blood_requests (
            request_id VARCHAR(64) PRIMARY KEY,
            case_id VARCHAR(64) NULL,
            citizen_id VARCHAR(64) NULL,
            person_name VARCHAR(120) NOT NULL,
            reason VARCHAR(500) NULL,
            location VARCHAR(120) NULL,
            status VARCHAR(32) NOT NULL,
            requested_by VARCHAR(128) NOT NULL,
            requested_by_name VARCHAR(128) NULL,
            requested_by_job VARCHAR(64) NULL,
            requested_at VARCHAR(32) NOT NULL,
            handled_by VARCHAR(128) NULL,
            handled_by_name VARCHAR(128) NULL,
            handled_at VARCHAR(32) NULL,
            notes TEXT NULL,
            analysis_started_at VARCHAR(32) NULL,
            analysis_started_ms BIGINT NULL,
            analysis_duration_ms INT NULL,
            analysis_ends_at VARCHAR(32) NULL,
            analysis_ends_ms BIGINT NULL,
            analysis_completed_at VARCHAR(32) NULL,
            analysis_completed_ms BIGINT NULL,
            last_reminder_at VARCHAR(32) NULL,
            last_reminder_ms BIGINT NULL,
            sample_stash_id VARCHAR(128) NULL,
            sample_slot INT NULL,
            sample_item_name VARCHAR(128) NULL,
            sample_metadata LONGTEXT NULL,
            evidence_id VARCHAR(64) NULL,
            INDEX idx_blood_status_requested (status, requested_at),
            INDEX idx_blood_case (case_id),
            INDEX idx_blood_analysis_started (analysis_started_at)
        )
    ]])

    execute([[ALTER TABLE cad_ems_blood_requests ADD COLUMN IF NOT EXISTS analysis_started_ms BIGINT NULL]])
    execute([[ALTER TABLE cad_ems_blood_requests ADD COLUMN IF NOT EXISTS analysis_ends_ms BIGINT NULL]])
    execute([[ALTER TABLE cad_ems_blood_requests ADD COLUMN IF NOT EXISTS analysis_completed_ms BIGINT NULL]])
    execute([[ALTER TABLE cad_ems_blood_requests ADD COLUMN IF NOT EXISTS last_reminder_at VARCHAR(32) NULL]])
    execute([[ALTER TABLE cad_ems_blood_requests ADD COLUMN IF NOT EXISTS last_reminder_ms BIGINT NULL]])
    execute([[ALTER TABLE cad_ems_blood_requests ADD COLUMN IF NOT EXISTS evidence_id VARCHAR(64) NULL]])

    execute([[
        CREATE TABLE IF NOT EXISTS cad_virtual_container_slots (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            container_key VARCHAR(128) NOT NULL,
            container_type VARCHAR(32) NOT NULL,
            endpoint_id VARCHAR(128) NULL,
            slot_index INT NOT NULL,
            item_name VARCHAR(64) NOT NULL,
            item_label VARCHAR(128) NULL,
            item_count INT NOT NULL DEFAULT 1,
            metadata LONGTEXT NULL,
            inserted_by VARCHAR(128) NULL,
            inserted_at VARCHAR(32) NULL,
            updated_at VARCHAR(32) NULL,
            UNIQUE KEY uq_virtual_container_slot (container_key, slot_index),
            KEY idx_virtual_container_key (container_key),
            KEY idx_virtual_container_type (container_type)
        )
    ]])

    execute([[
        CREATE TABLE IF NOT EXISTS cad_entity_notes (
            note_id VARCHAR(64) PRIMARY KEY,
            entity_type VARCHAR(16) NOT NULL,
            entity_id VARCHAR(128) NOT NULL,
            author_identifier VARCHAR(128) NOT NULL,
            author_name VARCHAR(128) NULL,
            content TEXT NOT NULL,
            is_important TINYINT NOT NULL DEFAULT 0,
            created_at VARCHAR(32) NOT NULL,
            INDEX idx_entity_notes_entity (entity_type, entity_id, created_at),
            INDEX idx_entity_notes_important (entity_type, entity_id, is_important)
        )
    ]])

    execute([[
        CREATE TABLE IF NOT EXISTS cad_vehicle_stops (
            stop_id VARCHAR(64) PRIMARY KEY,
            officer_identifier VARCHAR(128) NOT NULL,
            officer_name VARCHAR(128) NULL,
            plate VARCHAR(32) NOT NULL,
            vehicle_model VARCHAR(128) NULL,
            owner_identifier VARCHAR(128) NULL,
            owner_name VARCHAR(128) NULL,
            risk_level VARCHAR(16) NOT NULL DEFAULT 'NONE',
            risk_tags LONGTEXT NULL,
            note_hint VARCHAR(255) NULL,
            stop_source VARCHAR(32) NOT NULL DEFAULT 'QUICK_DOCK',
            created_at VARCHAR(32) NOT NULL,
            INDEX idx_vehicle_stops_officer (officer_identifier, created_at),
            INDEX idx_vehicle_stops_plate (plate, created_at)
        )
    ]])

    execute([[
        CREATE TABLE IF NOT EXISTS cad_officers (
            identifier VARCHAR(128) PRIMARY KEY,
            callsign VARCHAR(32) NULL,
            unit_type VARCHAR(32) NULL,
            updated_at VARCHAR(32) NOT NULL,
            INDEX idx_officers_callsign (callsign)
        )
    ]])

    execute([[
        CREATE TABLE IF NOT EXISTS cad_security_cameras (
            camera_id VARCHAR(64) PRIMARY KEY,
            camera_number INT NOT NULL,
            label VARCHAR(128) NOT NULL,
            street VARCHAR(128) NULL,
            cross_street VARCHAR(128) NULL,
            zone_name VARCHAR(128) NULL,
            coords LONGTEXT NOT NULL,
            rotation LONGTEXT NOT NULL,
            fov FLOAT NOT NULL DEFAULT 55,
            status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
            installed_by VARCHAR(128) NOT NULL,
            installed_by_name VARCHAR(128) NULL,
            created_at VARCHAR(32) NOT NULL,
            updated_at VARCHAR(32) NOT NULL,
            UNIQUE KEY uq_security_camera_number (camera_number),
            KEY idx_security_camera_status (status),
            KEY idx_security_camera_zone (zone_name)
        )
    ]])

    execute([[
        CREATE TABLE IF NOT EXISTS cad_news_articles (
            article_id VARCHAR(64) PRIMARY KEY,
            status VARCHAR(32) NOT NULL,
            updated_at VARCHAR(32) NOT NULL,
            payload LONGTEXT NOT NULL,
            KEY idx_news_status_updated (status, updated_at)
        )
    ]])

    execute([[
        CREATE TABLE IF NOT EXISTS cad_medical_records (
            record_id VARCHAR(64) NOT NULL PRIMARY KEY,
            citizen_id VARCHAR(64) NOT NULL,
            citizen_name VARCHAR(128) NOT NULL,
            visit_date VARCHAR(32) NOT NULL,
            diagnosis VARCHAR(500) NOT NULL,
            treatment_summary TEXT NOT NULL,
            prescriptions LONGTEXT NULL,
            treating_medic VARCHAR(128) NOT NULL,
            treating_medic_name VARCHAR(128) NOT NULL,
            vitals_snapshot LONGTEXT NULL,
            notes TEXT NULL,
            created_at VARCHAR(32) NOT NULL,
            INDEX idx_medical_citizen (citizen_id),
            INDEX idx_medical_date (visit_date)
        )
    ]])

    executeOptional([[SET GLOBAL event_scheduler = ON]], 'event_scheduler')

    executeOptional([[
        CREATE EVENT IF NOT EXISTS ev_cleanup_stale_evidence
        ON SCHEDULE EVERY 6 HOUR
        DO
            DELETE FROM cad_evidence
            WHERE case_id = ''
            AND STR_TO_DATE(attached_at, '%Y-%m-%dT%H:%i:%s') < DATE_SUB(NOW(), INTERVAL 24 HOUR)
    ]], 'ev_cleanup_stale_evidence')

    executeOptional([[
        CREATE EVENT IF NOT EXISTS ev_cleanup_closed_calls
        ON SCHEDULE EVERY 24 HOUR
        DO
            DELETE FROM cad_dispatch_calls
            WHERE status = 'CLOSED'
            AND STR_TO_DATE(created_at, '%Y-%m-%dT%H:%i:%s') < DATE_SUB(NOW(), INTERVAL 10 DAY)
    ]], 'ev_cleanup_closed_calls')

    executeOptional([[
        CREATE EVENT IF NOT EXISTS ev_cleanup_closed_cases
        ON SCHEDULE EVERY 24 HOUR
        DO
            DELETE c, n, t, e
            FROM cad_cases c
            LEFT JOIN cad_case_notes n ON c.case_id = n.case_id
            LEFT JOIN cad_case_tasks t ON c.case_id = t.case_id
            LEFT JOIN cad_evidence e ON c.case_id = e.case_id
            WHERE c.status = 'CLOSED'
            AND STR_TO_DATE(c.created_at, '%Y-%m-%dT%H:%i:%s') < DATE_SUB(NOW(), INTERVAL 10 DAY)
    ]], 'ev_cleanup_closed_cases')

    executeOptional([[
        CREATE EVENT IF NOT EXISTS ev_cleanup_paid_fines
        ON SCHEDULE EVERY 24 HOUR
        DO
            DELETE FROM cad_fines
            WHERE status = 'PAID'
            AND STR_TO_DATE(paid_at, '%Y-%m-%dT%H:%i:%s') < DATE_SUB(NOW(), INTERVAL 10 DAY)
    ]], 'ev_cleanup_paid_fines')

    executeOptional([[
        CREATE EVENT IF NOT EXISTS ev_cleanup_expired_alerts
        ON SCHEDULE EVERY 1 HOUR
        DO
            DELETE FROM cad_ems_alerts
            WHERE status IN ('EXPIRED','RESOLVED')
            AND STR_TO_DATE(created_at, '%Y-%m-%dT%H:%i:%s') < DATE_SUB(NOW(), INTERVAL 1 HOUR)
    ]], 'ev_cleanup_expired_alerts')

    executeOptional([[
        CREATE EVENT IF NOT EXISTS ev_cleanup_completed_blood_requests
        ON SCHEDULE EVERY 24 HOUR
        DO
            DELETE FROM cad_ems_blood_requests
            WHERE status IN ('COMPLETED', 'DECLINED', 'CANCELLED')
            AND STR_TO_DATE(COALESCE(analysis_completed_at, handled_at, requested_at), '%Y-%m-%dT%H:%i:%s') < DATE_SUB(NOW(), INTERVAL 14 DAY)
    ]], 'ev_cleanup_completed_blood_requests')

    CAD.Log('success', 'Database schema and cleanup events ensured')
end
