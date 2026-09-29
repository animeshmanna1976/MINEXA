const pool = require("../db");

async function createAuditLog({
    userId = null,
    mineId = null,
    action,
    entityType = null,
    entityId = null,
    description = null,
    oldValues = null,
    newValues = null,
    ipAddress = null,
    userAgent = null
}) {

    try {

        console.log("AUDIT LOG CALLED:", {
            userId,
            mineId,
            action,
            entityType,
            entityId
        });

        const result = await pool.query(
            `
            INSERT INTO audit_logs
            (
                user_id,
                mine_id,
                action,
                entity_type,
                entity_id,
                description,
                old_values,
                new_values,
                ip_address,
                user_agent
            )
            VALUES
            (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7::JSONB,
                $8::JSONB,
                $9,
                $10
            )
            RETURNING id
            `,
            [
                userId,
                mineId,
                action,
                entityType,
                entityId !== null
                    ? String(entityId)
                    : null,
                description,

                oldValues
                    ? JSON.stringify(oldValues)
                    : null,

                newValues
                    ? JSON.stringify(newValues)
                    : null,

                ipAddress,
                userAgent
            ]
        );

        console.log(
            "AUDIT LOG CREATED:",
            result.rows[0].id
        );

        return result.rows[0].id;

    } catch (error) {

        console.error(
            "AUDIT LOG ERROR:",
            error
        );

        return null;
    }
}

module.exports = {
    createAuditLog
};