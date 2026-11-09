import { Pool, types } from "pg";

// date -> 'YYYY-MM-DD' apa adanya (tanpa konversi zona waktu), numeric/bigint -> number
types.setTypeParser(types.builtins.DATE, (v) => v);
types.setTypeParser(types.builtins.NUMERIC, (v) => Number(v));
types.setTypeParser(types.builtins.INT8, (v) => Number(v));

const globalForPg = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPg.pgPool ?? new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
if (process.env.NODE_ENV !== "production") globalForPg.pgPool = pool;

export async function query<T>(text: string, params: unknown[] = []): Promise<T[]> {
  const { rows } = await pool.query(text, params);
  return rows as T[];
}

export type Tx = { query<T>(text: string, params?: unknown[]): Promise<T[]> };

export type AuditContext = { userId: number; ip: string; reason?: string | null };

/**
 * Transaksi yang membawa konteks audit (user, IP, alasan) ke trigger audit_row().
 * Semua perubahan data bisnis harus lewat fungsi ini supaya tercatat atas nama user yang benar.
 */
export async function withAudit<T>(ctx: AuditContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      "select set_config('app.user_id', $1, true), set_config('app.ip', $2, true), set_config('app.reason', $3, true)",
      [String(ctx.userId), ctx.ip, ctx.reason ?? ""],
    );
    const result = await fn({
      query: async <R,>(text: string, params: unknown[] = []) =>
        (await client.query(text, params)).rows as R[],
    });
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}
