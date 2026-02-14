--[[
C.A.D. System
Created by JericoFX
GitHub: https://github.com/JericoFX
License: GNU GPL v3
]]

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


    execute([[SET GLOBAL event_scheduler = ON]])

    -- 1
    execute([[
        CREATE EVENT IF NOT EXISTS ev_cleanup_stale_evidence
        ON SCHEDULE EVERY 6 HOUR
        DO
            DELETE FROM cad_evidence
            WHERE case_id = ''
            AND STR_TO_DATE(attached_at, '%Y-%m-%dT%H:%i:%s') < DATE_SUB(NOW(), INTERVAL 24 HOUR)
    ]])

    -- Event 2: Purge old closed dispatch calls
    execute([[
        CREATE EVENT IF NOT EXISTS ev_cleanup_closed_calls
        ON SCHEDULE EVERY 24 HOUR
        DO
            DELETE FROM cad_dispatch_calls
            WHERE status = 'CLOSED'
            AND STR_TO_DATE(created_at, '%Y-%m-%dT%H:%i:%s') < DATE_SUB(NOW(), INTERVAL 10 DAY)
    ]])

    -- Event 3: Purge old closed cases and related records
    execute([[
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
    ]])

    -- Event 4: Purge old paid fines
    execute([[
        CREATE EVENT IF NOT EXISTS ev_cleanup_paid_fines
        ON SCHEDULE EVERY 24 HOUR
        DO
            DELETE FROM cad_fines
            WHERE status = 'PAID'
            AND STR_TO_DATE(paid_at, '%Y-%m-%dT%H:%i:%s') < DATE_SUB(NOW(), INTERVAL 10 DAY)
    ]])

    -- Event 5: Purge expired EMS alerts
    execute([[
        CREATE EVENT IF NOT EXISTS ev_cleanup_expired_alerts
        ON SCHEDULE EVERY 1 HOUR
        DO
            DELETE FROM cad_ems_alerts
            WHERE status IN ('EXPIRED','RESOLVED')
            AND STR_TO_DATE(created_at, '%Y-%m-%dT%H:%i:%s') < DATE_SUB(NOW(), INTERVAL 1 HOUR)
    ]])

    -- Event 6: Purge old completed blood requests
    execute([[
        CREATE EVENT IF NOT EXISTS ev_cleanup_completed_blood_requests
        ON SCHEDULE EVERY 24 HOUR
        DO
            DELETE FROM cad_ems_blood_requests
            WHERE status IN ('COMPLETED', 'DECLINED', 'CANCELLED')
            AND STR_TO_DATE(COALESCE(analysis_completed_at, handled_at, requested_at), '%Y-%m-%dT%H:%i:%s') < DATE_SUB(NOW(), INTERVAL 14 DAY)
    ]])

    CAD.Log('success', 'Database schema and cleanup events ensured')
end
