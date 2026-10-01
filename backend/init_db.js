const pool = require('./db');
const bcrypt = require('bcryptjs');

async function initializeDatabase() {
    try {
        console.log('🚀 Initializing MINEXA database tables and schema...');

        // 1. Mines
        await pool.query(`
            CREATE TABLE IF NOT EXISTS mines (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                mine_code VARCHAR(100) UNIQUE NOT NULL,
                location VARCHAR(255),
                status VARCHAR(50) DEFAULT 'ACTIVE',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. Users & Workers
        await pool.query(`
            CREATE TABLE IF NOT EXISTS workers (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                employee_code VARCHAR(100) UNIQUE,
                phone VARCHAR(50),
                mine_id INTEGER REFERENCES mines(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE,
                login_id VARCHAR(100) UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL,
                worker_id INTEGER REFERENCES workers(id) ON DELETE SET NULL,
                mine_id INTEGER REFERENCES mines(id) ON DELETE SET NULL,
                account_status VARCHAR(50) DEFAULT 'ACTIVE',
                is_verified BOOLEAN DEFAULT TRUE,
                verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                mfa_enabled BOOLEAN DEFAULT FALSE,
                must_change_password BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 3. Registrations & Approvals
        await pool.query(`
            CREATE TABLE IF NOT EXISTS registration_requests (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255),
                phone VARCHAR(50) NOT NULL,
                password_hash VARCHAR(255),
                requested_role VARCHAR(50) NOT NULL,
                mine_id INTEGER REFERENCES mines(id) ON DELETE SET NULL,
                employee_id VARCHAR(100),
                department VARCHAR(100),
                designation VARCHAR(100),
                certification_number VARCHAR(100),
                safety_training_id VARCHAR(100),
                status VARCHAR(50) DEFAULT 'PENDING',
                rejection_reason TEXT,
                submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                reviewed_at TIMESTAMP,
                reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS approval_actions (
                id SERIAL PRIMARY KEY,
                registration_id INTEGER REFERENCES registration_requests(id) ON DELETE CASCADE,
                reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                action VARCHAR(50) NOT NULL,
                comments TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 4. Equipment
        await pool.query(`
            CREATE TABLE IF NOT EXISTS equipment (
                id SERIAL PRIMARY KEY,
                mine_id INTEGER REFERENCES mines(id) ON DELETE CASCADE,
                equipment_code VARCHAR(100) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                equipment_type VARCHAR(100) NOT NULL,
                manufacturer VARCHAR(255),
                model VARCHAR(255),
                serial_number VARCHAR(255),
                purchase_date DATE,
                last_service_date DATE,
                next_service_date DATE,
                last_inspection_date DATE,
                next_inspection_date DATE,
                location VARCHAR(255),
                status VARCHAR(50) DEFAULT 'AVAILABLE',
                assigned_worker_id INTEGER REFERENCES workers(id) ON DELETE SET NULL,
                assigned_at TIMESTAMP,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS equipment_inspections (
                id SERIAL PRIMARY KEY,
                equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
                inspector_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                inspection_date DATE DEFAULT CURRENT_DATE,
                status VARCHAR(50),
                notes TEXT,
                checklist_results JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS equipment_maintenance (
                id SERIAL PRIMARY KEY,
                equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE,
                maintenance_type VARCHAR(100),
                scheduled_date DATE,
                completed_date DATE,
                cost NUMERIC(12, 2),
                performed_by VARCHAR(255),
                notes TEXT,
                status VARCHAR(50) DEFAULT 'SCHEDULED',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 5. Incidents
        await pool.query(`
            CREATE TABLE IF NOT EXISTS incidents (
                id SERIAL PRIMARY KEY,
                mine_id INTEGER REFERENCES mines(id) ON DELETE CASCADE,
                reported_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                worker_id INTEGER REFERENCES workers(id) ON DELETE SET NULL,
                incident_type VARCHAR(100) NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                location VARCHAR(255),
                severity VARCHAR(50) DEFAULT 'MEDIUM',
                status VARCHAR(50) DEFAULT 'OPEN',
                incident_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                reviewed_at TIMESTAMP,
                resolved_at TIMESTAMP,
                resolution_notes TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 6. Shifts & Attendance
        await pool.query(`
            CREATE TABLE IF NOT EXISTS shifts (
                id SERIAL PRIMARY KEY,
                mine_id INTEGER REFERENCES mines(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                start_time TIME NOT NULL,
                end_time TIME NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS worker_shift_assignments (
                id SERIAL PRIMARY KEY,
                worker_id INTEGER REFERENCES workers(id) ON DELETE CASCADE,
                shift_id INTEGER REFERENCES shifts(id) ON DELETE CASCADE,
                effective_from DATE DEFAULT CURRENT_DATE,
                effective_to DATE,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS attendance (
                id SERIAL PRIMARY KEY,
                worker_id INTEGER REFERENCES workers(id) ON DELETE CASCADE,
                shift_id INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
                mine_id INTEGER REFERENCES mines(id) ON DELETE CASCADE,
                date DATE DEFAULT CURRENT_DATE,
                attendance_date DATE DEFAULT CURRENT_DATE,
                check_in TIMESTAMP,
                check_out TIMESTAMP,
                status VARCHAR(50) DEFAULT 'PRESENT',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 7. Leave Requests & Balances
        await pool.query(`
            CREATE TABLE IF NOT EXISTS leave_requests (
                id SERIAL PRIMARY KEY,
                worker_id INTEGER REFERENCES workers(id) ON DELETE CASCADE,
                leave_type VARCHAR(50) NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                days INTEGER NOT NULL,
                reason TEXT NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                rejection_reason TEXT,
                submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                reviewed_at TIMESTAMP,
                reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS worker_leave_balances (
                id SERIAL PRIMARY KEY,
                worker_id INTEGER REFERENCES workers(id) ON DELETE CASCADE,
                leave_type VARCHAR(50) NOT NULL,
                allocated_days INTEGER DEFAULT 12,
                year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(worker_id, leave_type, year)
            );
        `);

        // 8. Safety Checklists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS safety_checklists (
                id SERIAL PRIMARY KEY,
                mine_id INTEGER REFERENCES mines(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                equipment_type VARCHAR(100),
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS safety_checklist_items (
                id SERIAL PRIMARY KEY,
                checklist_id INTEGER REFERENCES safety_checklists(id) ON DELETE CASCADE,
                item_text TEXT NOT NULL,
                is_mandatory BOOLEAN DEFAULT TRUE,
                order_index INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS safety_checklist_submissions (
                id SERIAL PRIMARY KEY,
                checklist_id INTEGER REFERENCES safety_checklists(id) ON DELETE CASCADE,
                submitted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                mine_id INTEGER REFERENCES mines(id) ON DELETE CASCADE,
                equipment_id INTEGER REFERENCES equipment(id) ON DELETE SET NULL,
                status VARCHAR(50) DEFAULT 'COMPLETED',
                submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS safety_checklist_answers (
                id SERIAL PRIMARY KEY,
                submission_id INTEGER REFERENCES safety_checklist_submissions(id) ON DELETE CASCADE,
                item_id INTEGER REFERENCES safety_checklist_items(id) ON DELETE CASCADE,
                is_passed BOOLEAN NOT NULL,
                notes TEXT
            );
        `);

        // 9. PPE Management
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ppe_types (
                id SERIAL PRIMARY KEY,
                mine_id INTEGER REFERENCES mines(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                category VARCHAR(100) NOT NULL,
                description TEXT,
                replacement_period_days INTEGER,
                is_mandatory BOOLEAN DEFAULT TRUE,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS ppe_inventory (
                id SERIAL PRIMARY KEY,
                ppe_type_id INTEGER REFERENCES ppe_types(id) ON DELETE CASCADE,
                mine_id INTEGER REFERENCES mines(id) ON DELETE CASCADE,
                item_code VARCHAR(100) UNIQUE NOT NULL,
                size VARCHAR(50),
                condition VARCHAR(50) DEFAULT 'NEW',
                status VARCHAR(50) DEFAULT 'AVAILABLE',
                purchase_date DATE,
                expiry_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS worker_ppe_assignments (
                id SERIAL PRIMARY KEY,
                worker_id INTEGER REFERENCES workers(id) ON DELETE CASCADE,
                ppe_inventory_id INTEGER REFERENCES ppe_inventory(id) ON DELETE CASCADE,
                assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                issue_date DATE DEFAULT CURRENT_DATE,
                expected_replacement_date DATE,
                status VARCHAR(50) DEFAULT 'ACTIVE',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS ppe_inspections (
                id SERIAL PRIMARY KEY,
                ppe_inventory_id INTEGER REFERENCES ppe_inventory(id) ON DELETE CASCADE,
                inspector_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                inspection_date DATE DEFAULT CURRENT_DATE,
                condition VARCHAR(50),
                status VARCHAR(50),
                notes TEXT
            );
        `);

        // 10. Worker Health, Geofences, Locations, Risks & Emergency
        await pool.query(`
            CREATE TABLE IF NOT EXISTS worker_health (
                id SERIAL PRIMARY KEY,
                worker_id INTEGER UNIQUE REFERENCES workers(id) ON DELETE CASCADE,
                blood_group VARCHAR(10),
                medical_status VARCHAR(50) DEFAULT 'FIT',
                medical_check_date DATE,
                fitness_expiry_date DATE,
                restrictions TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            INSERT INTO worker_health (worker_id, medical_status, medical_check_date, fitness_expiry_date)
            SELECT id, 'FIT', CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months'
            FROM workers
            ON CONFLICT (worker_id) DO NOTHING;

            CREATE TABLE IF NOT EXISTS worker_health_logs (
                id SERIAL PRIMARY KEY,
                worker_id INTEGER REFERENCES workers(id) ON DELETE CASCADE,
                heart_rate INTEGER,
                blood_pressure VARCHAR(50),
                body_temperature NUMERIC(4, 1),
                oxygen_level INTEGER,
                recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS mine_geofences (
                id SERIAL PRIMARY KEY,
                mine_id INTEGER REFERENCES mines(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                zone_type VARCHAR(100) NOT NULL,
                latitude NUMERIC(10, 7) NOT NULL,
                longitude NUMERIC(10, 7) NOT NULL,
                radius_meters NUMERIC(10, 2) NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS worker_locations (
                id SERIAL PRIMARY KEY,
                worker_id INTEGER REFERENCES workers(id) ON DELETE CASCADE,
                mine_id INTEGER REFERENCES mines(id) ON DELETE CASCADE,
                latitude NUMERIC(10, 7) NOT NULL,
                longitude NUMERIC(10, 7) NOT NULL,
                accuracy_meters NUMERIC(10, 2),
                recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS risk_assessments (
                id SERIAL PRIMARY KEY,
                mine_id INTEGER REFERENCES mines(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                hazard_description TEXT,
                risk_level VARCHAR(50) DEFAULT 'MEDIUM',
                status VARCHAR(50) DEFAULT 'IDENTIFIED',
                mitigation_plan TEXT,
                assessed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS worker_risk_assessments (
                id SERIAL PRIMARY KEY,
                worker_id INTEGER REFERENCES workers(id) ON DELETE CASCADE,
                mine_id INTEGER REFERENCES mines(id) ON DELETE CASCADE,
                risk_score NUMERIC(5, 2) DEFAULT 0,
                risk_level VARCHAR(50) DEFAULT 'LOW',
                factors JSONB,
                calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS worker_risk_alerts (
                id SERIAL PRIMARY KEY,
                worker_id INTEGER REFERENCES workers(id) ON DELETE CASCADE,
                mine_id INTEGER REFERENCES mines(id) ON DELETE CASCADE,
                alert_type VARCHAR(100) NOT NULL,
                severity VARCHAR(50) DEFAULT 'MEDIUM',
                message TEXT,
                status VARCHAR(50) DEFAULT 'ACTIVE',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS emergency_alerts (
                id SERIAL PRIMARY KEY,
                mine_id INTEGER REFERENCES mines(id) ON DELETE CASCADE,
                worker_id INTEGER REFERENCES workers(id) ON DELETE SET NULL,
                alert_type VARCHAR(100) NOT NULL,
                severity VARCHAR(50) DEFAULT 'CRITICAL',
                description TEXT,
                status VARCHAR(50) DEFAULT 'ACTIVE',
                response_time_seconds INTEGER,
                resolution_time_seconds INTEGER,
                acknowledged_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                acknowledged_at TIMESTAMP,
                responding_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                resolved_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS notification_logs (
                id SERIAL PRIMARY KEY,
                worker_id INTEGER,
                phone VARCHAR(50),
                email VARCHAR(255),
                notification_type VARCHAR(100),
                message TEXT,
                channel VARCHAR(50),
                status VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS audit_logs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                action VARCHAR(100) NOT NULL,
                entity_type VARCHAR(100),
                entity_id INTEGER,
                details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 11. Seed Initial Mines
        await pool.query(`
            INSERT INTO mines (id, name, mine_code, location, status) VALUES
            (1, 'Eastern Coalfield - Pit A', 'MINE-001', 'Jharkhand, Sector 4', 'ACTIVE'),
            (2, 'Western Open Cast - Block 2', 'MINE-002', 'Odisha, Site B', 'ACTIVE'),
            (3, 'Southern Underground Dig', 'MINE-003', 'Andhra Pradesh, Zone 1', 'ACTIVE')
            ON CONFLICT (mine_code) DO NOTHING;
            SELECT setval('mines_id_seq', (SELECT MAX(id) FROM mines));
        `);

        // 12. Seed Default Platform Admin (Password: admin)
        const adminHash = await bcrypt.hash('admin', 10);
        await pool.query(`
            INSERT INTO users (name, email, login_id, password_hash, role, account_status, is_verified, must_change_password)
            VALUES (
                'Platform Administrator',
                'admin@minexa.com',
                'ADMIN-001',
                $1,
                'PLATFORM_ADMIN',
                'ACTIVE',
                TRUE,
                FALSE
            )
            ON CONFLICT (email) DO NOTHING;
        `, [adminHash]);

        // 13. Seed Standard Shifts
        await pool.query(`
            INSERT INTO shifts (mine_id, name, start_time, end_time, is_active)
            VALUES 
            (1, 'Morning Shift (A)', '06:00:00', '14:00:00', TRUE),
            (1, 'Evening Shift (B)', '14:00:00', '22:00:00', TRUE),
            (1, 'Night Shift (C)', '22:00:00', '06:00:00', TRUE)
            ON CONFLICT DO NOTHING;
        `);

        // 14. Seed Standard PPE Types
        await pool.query(`
            INSERT INTO ppe_types (mine_id, name, category, replacement_period_days, is_mandatory, is_active)
            VALUES 
            (1, 'Mining Hard Hat with Headlamp Mount', 'HEAD_PROTECTION', 365, TRUE, TRUE),
            (1, 'Steel Toe Safety Boots (Mining Spec)', 'FOOT_PROTECTION', 180, TRUE, TRUE),
            (1, 'Particulate Dust Mask (N95 / FFP2)', 'RESPIRATORY_PROTECTION', 30, TRUE, TRUE),
            (1, 'High-Visibility Reflective Vest (Class 3)', 'BODY_PROTECTION', 180, TRUE, TRUE)
            ON CONFLICT DO NOTHING;
        `);

        // 15. Seed Sample Equipment
        await pool.query(`
            INSERT INTO equipment (mine_id, equipment_code, name, equipment_type, status, next_inspection_date)
            VALUES 
            (1, 'EQ-HAUL-01', 'Heavy Haul Dump Truck 777G', 'HAUL_TRUCK', 'AVAILABLE', CURRENT_DATE + 14),
            (1, 'EQ-EXC-02', 'Hydraulic Excavator CAT 349', 'EXCAVATOR', 'AVAILABLE', CURRENT_DATE + 7),
            (1, 'EQ-DRILL-03', 'Rotary Blast Hole Drill', 'DRILLING_RIG', 'MAINTENANCE', CURRENT_DATE + 3)
            ON CONFLICT (equipment_code) DO NOTHING;
        `);

        console.log('✅ MINEXA database initialization complete!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Database initialization error:', err);
        process.exit(1);
    }
}

initializeDatabase();
