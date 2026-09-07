import { Pool } from 'pg';
declare function initDatabase(): Promise<Pool>;
declare function getPool(): Pool;
export { initDatabase, getPool };
declare const _default: {
    initDatabase: typeof initDatabase;
    getPool: typeof getPool;
};
export default _default;
//# sourceMappingURL=db.d.ts.map