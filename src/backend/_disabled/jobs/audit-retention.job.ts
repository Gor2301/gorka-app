import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';

const prisma = new PrismaClient();

/**
 * Audit Retention Job
 * Deletes audit logs older than retention days in batches
 * DISABLED BY DEFAULT - requires explicit approval to enable
 */
export async function runAuditRetention(): Promise<void> {
    const retentionDays = parseInt(process.env.AUDIT_RETENTION_DAYS || '365');
    const autoPurge = process.env.AUDIT_AUTO_PURGE === 'true';

    if (!autoPurge) {
        logger.info('🔒 Audit retention disabled by AUDIT_AUTO_PURGE=false');
        return;
    }

    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    let totalDeleted = 0;

    logger.info(`🧹 Starting audit retention purge (${retentionDays} days, cutoff: ${cutoff.toISOString()})`);

    while (true) {
        try {
            const ids = await prisma.$queryRaw<{ id: string }[]>`
                SELECT id FROM activity_logs
                WHERE created_at < ${cutoff}
                ORDER BY created_at ASC
                LIMIT 1000
            `;

            if (ids.length === 0) break;

            const idList = ids.map(r => r.id);

            const deleted = await prisma.activityLog.deleteMany({
                where: {
                    id: { in: idList }
                }
            });

            totalDeleted += deleted.count;
            logger.info(`🧹 Deleted ${deleted.count} records (${totalDeleted} total)`);

            await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
            logger.error('❌ Error in audit retention batch:', error);
            break;
        }
    }

    logger.info(`✅ Audit retention complete: ${totalDeleted} records deleted`);
}

if (require.main === module) {
    runAuditRetention()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('Fatal error in audit retention job:', error);
            process.exit(1);
        });
}