import Database from 'better-sqlite3';
import type { ColumnDefinition, Database as SqliteDatabase } from 'better-sqlite3';

import { env, ensureRuntimeDirectories } from '../config/env.js';
import { AppError } from '../middleware/error.js';
import type { JobRow, JobStatusGroup, PrinterRow, UserRole, UserRow } from '../types.js';
import { logger } from '../utils/logger.js';

ensureRuntimeDirectories();

const db: SqliteDatabase = new Database(env.sqlitePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    oidc_subject TEXT NOT NULL UNIQUE,
    email TEXT,
    name TEXT NOT NULL,
    picture TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    last_login_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS printers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    ipp_uri TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    printer_id INTEGER NOT NULL,
    original_file_name TEXT NOT NULL,
    stored_file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    copies INTEGER NOT NULL DEFAULT 1,
    duplex TEXT NOT NULL DEFAULT 'one-sided',
    color_mode TEXT NOT NULL DEFAULT 'color',
    status TEXT NOT NULL,
    status_detail TEXT,
    external_job_id INTEGER,
    external_job_uri TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (printer_id) REFERENCES printers (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    sess TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
`);

const ensureColumn = ({ table, name, definition }: { table: string; name: string; definition: string }) => {
  const columns = db.prepare<[], ColumnDefinition>(`PRAGMA table_info(${table})`).all();
  if (!columns.some((column) => column.name === name)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  }
};

ensureColumn({
  table: 'jobs',
  name: 'color_mode',
  definition: "TEXT NOT NULL DEFAULT 'color'",
});

const safeDbCall = <T>(label: string, fn: () => T): T => {
  try {
    return fn();
  } catch (error: any) {
    logger.error(`Database error in ${label}`, { message: error.message });

    if (String(error.code || '').startsWith('SQLITE_CONSTRAINT')) {
      throw new AppError(409, 'A record with the same unique value already exists.');
    }

    throw new AppError(500, 'Database operation failed.');
  }
};

const nowIso = () => new Date().toISOString();

const mapPrinter = (row: any): PrinterRow | null => {
  if (!row) {
    return null;
  }

  return {
    ...row,
    enabled: Boolean(row.enabled),
  };
};

const mapJob = (row: any): JobRow | null => {
  if (!row) {
    return null;
  }

  return {
    ...row,
    printerEnabled:
      row.printerEnabled === undefined ? undefined : Boolean(row.printerEnabled),
  };
};

export const upsertUser = ({
  subject,
  email,
  name,
  picture,
  role,
}: {
  subject: string;
  email: string | null;
  name: string;
  picture: string | null;
  role: UserRole;
}): UserRow =>
  safeDbCall('upsertUser', () => {
    const timestamp = nowIso();
    db.prepare(
      `
        INSERT INTO users (oidc_subject, email, name, picture, role, last_login_at, created_at, updated_at)
        VALUES (@subject, @email, @name, @picture, @role, @timestamp, @timestamp, @timestamp)
        ON CONFLICT(oidc_subject)
        DO UPDATE SET
          email = excluded.email,
          name = excluded.name,
          picture = excluded.picture,
          role = excluded.role,
          last_login_at = excluded.last_login_at,
          updated_at = excluded.updated_at
      `,
    ).run({ subject, email, name, picture, role, timestamp });

    return db.prepare<[string], UserRow>('SELECT * FROM users WHERE oidc_subject = ?').get(subject)!;
  });

export const getUserById = (id: number): UserRow | undefined =>
  safeDbCall('getUserById', () => db.prepare<[number], UserRow>('SELECT * FROM users WHERE id = ?').get(id));

export const listPrinters = ({ includeDisabled = false }: { includeDisabled?: boolean } = {}): PrinterRow[] =>
  safeDbCall('listPrinters', () => {
    const query = includeDisabled
      ? 'SELECT * FROM printers ORDER BY name ASC'
      : 'SELECT * FROM printers WHERE enabled = 1 ORDER BY name ASC';

    return db.prepare(query).all().map(mapPrinter);
  });

export const getPrinterById = (id: number | bigint): PrinterRow | null =>
  safeDbCall('getPrinterById', () => mapPrinter(db.prepare('SELECT * FROM printers WHERE id = ?').get(id)));

export const createPrinter = ({
  name,
  ippUri,
  description,
  enabled,
}: {
  name: string;
  ippUri: string;
  description: string;
  enabled: boolean;
}): PrinterRow | null =>
  safeDbCall('createPrinter', () => {
    const timestamp = nowIso();
    const result = db
      .prepare(
        `
          INSERT INTO printers (name, ipp_uri, description, enabled, created_at, updated_at)
          VALUES (@name, @ippUri, @description, @enabled, @timestamp, @timestamp)
        `,
      )
      .run({
        name,
        ippUri,
        description,
        enabled: enabled ? 1 : 0,
        timestamp,
      });

    return getPrinterById(result.lastInsertRowid);
  });

interface DiscoveredPrinterInput {
  name: string;
  ippUri: string;
  description: string;
}

export const syncDiscoveredPrinters = (discoveredPrinters: DiscoveredPrinterInput[]) =>
  safeDbCall('syncDiscoveredPrinters', () => {
    const timestamp = nowIso();
    const selectByUri = db.prepare<[string], PrinterRow>('SELECT * FROM printers WHERE ipp_uri = ?');
    const selectByName = db.prepare<[string], PrinterRow>('SELECT * FROM printers WHERE name = ?');
    const insertPrinter = db.prepare(
      `
        INSERT INTO printers (name, ipp_uri, description, enabled, created_at, updated_at)
        VALUES (@name, @ippUri, @description, 1, @timestamp, @timestamp)
      `,
    );
    const updateDiscoveredPrinter = db.prepare(
      `
        UPDATE printers
        SET name = @name,
            ipp_uri = @ippUri,
            description = @description,
            updated_at = @timestamp
        WHERE id = @id
      `,
    );

    const summary: {
      created: (PrinterRow | null)[];
      updated: (PrinterRow | null)[];
      skipped: { name: string; ippUri: string; reason: string }[];
    } = {
      created: [],
      updated: [],
      skipped: [],
    };

    const syncTransaction = db.transaction((printers: DiscoveredPrinterInput[]) => {
      for (const printer of printers) {
        const existingByUri = selectByUri.get(printer.ippUri);
        const existingByName = selectByName.get(printer.name);

        if (existingByUri && existingByName && existingByUri.id !== existingByName.id) {
          summary.skipped.push({
            name: printer.name,
            ippUri: printer.ippUri,
            reason: 'A different configured printer already uses this name or URI.',
          });
          continue;
        }

        const existing = existingByUri || existingByName;
        if (existing) {
          updateDiscoveredPrinter.run({
            id: existing.id,
            name: printer.name,
            ippUri: printer.ippUri,
            description: printer.description,
            timestamp,
          });
          summary.updated.push(getPrinterById(existing.id));
          continue;
        }

        const result = insertPrinter.run({
          name: printer.name,
          ippUri: printer.ippUri,
          description: printer.description,
          timestamp,
        });
        summary.created.push(getPrinterById(result.lastInsertRowid));
      }
    });

    syncTransaction(discoveredPrinters);
    return summary;
  });

export const updatePrinter = (
  id: number,
  fields: { name: string; ippUri: string; description: string; enabled: boolean },
): PrinterRow | null =>
  safeDbCall('updatePrinter', () => {
    const payload = {
      name: fields.name,
      ipp_uri: fields.ippUri,
      description: fields.description,
      enabled: fields.enabled ? 1 : 0,
      updated_at: nowIso(),
      id,
    };

    db.prepare(
      `
        UPDATE printers
        SET name = @name,
            ipp_uri = @ipp_uri,
            description = @description,
            enabled = @enabled,
            updated_at = @updated_at
        WHERE id = @id
      `,
    ).run(payload);

    return getPrinterById(id);
  });

export const deletePrinter = (id: number) =>
  safeDbCall('deletePrinter', () => db.prepare('DELETE FROM printers WHERE id = ?').run(id));

export const createJob = (job: {
  userId: number;
  printerId: number;
  originalFileName: string;
  storedFileName: string;
  filePath: string;
  mimeType: string;
  copies: number;
  duplex: string;
  colorMode: string;
  status: string;
  statusDetail?: string | null;
  externalJobId?: number | null;
  externalJobUri?: string | null;
  completedAt?: string | null;
}): JobRow =>
  safeDbCall('createJob', () => {
    const timestamp = nowIso();
    const result = db
      .prepare(
        `
          INSERT INTO jobs (
            user_id,
            printer_id,
            original_file_name,
            stored_file_name,
            file_path,
            mime_type,
            copies,
            duplex,
            color_mode,
            status,
            status_detail,
            external_job_id,
            external_job_uri,
            created_at,
            updated_at,
            completed_at
          )
          VALUES (
            @userId,
            @printerId,
            @originalFileName,
            @storedFileName,
            @filePath,
            @mimeType,
            @copies,
            @duplex,
            @colorMode,
            @status,
            @statusDetail,
            @externalJobId,
            @externalJobUri,
            @timestamp,
            @timestamp,
            @completedAt
          )
        `,
      )
      .run({
        userId: job.userId,
        printerId: job.printerId,
        originalFileName: job.originalFileName,
        storedFileName: job.storedFileName,
        filePath: job.filePath,
        mimeType: job.mimeType,
        copies: job.copies,
        duplex: job.duplex,
        colorMode: job.colorMode,
        status: job.status,
        statusDetail: job.statusDetail || null,
        externalJobId: job.externalJobId || null,
        externalJobUri: job.externalJobUri || null,
        completedAt: job.completedAt || null,
        timestamp,
      });

    return getJobById(result.lastInsertRowid)!;
  });

export const updateJob = (id: number | bigint, fields: Record<string, unknown>): JobRow =>
  safeDbCall('updateJob', () => {
    const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
    if (!entries.length) {
      return getJobById(id)!;
    }

    const payload = Object.fromEntries(entries);
    payload.updated_at = nowIso();
    payload.id = id;

    const assignments = Object.keys(payload)
      .filter((key) => key !== 'id')
      .map((key) => `${key} = @${key}`)
      .join(', ');

    db.prepare(`UPDATE jobs SET ${assignments} WHERE id = @id`).run(payload);
    return getJobById(id)!;
  });

const jobSelect = `
  SELECT
    jobs.*,
    printers.name AS printerName,
    printers.ipp_uri AS printerIppUri,
    printers.enabled AS printerEnabled,
    users.email AS userEmail,
    users.name AS userName,
    users.role AS userRole
  FROM jobs
  INNER JOIN printers ON printers.id = jobs.printer_id
  INNER JOIN users ON users.id = jobs.user_id
`;

export const getJobById = (id: number | bigint): JobRow | null =>
  safeDbCall('getJobById', () =>
    mapJob(db.prepare(`${jobSelect} WHERE jobs.id = ?`).get(id)),
  );

const activeStatuses = ['queued', 'pending', 'pending-held', 'processing', 'processing-stopped', 'submitting'];
const completedStatuses = ['completed', 'canceled', 'aborted', 'error'];

export const listJobs = ({
  role,
  userId,
  statusGroup = 'all',
  limit = 100,
}: {
  role: UserRole;
  userId: number;
  statusGroup?: JobStatusGroup;
  limit?: number;
}): JobRow[] =>
  safeDbCall('listJobs', () => {
    const whereClauses = [];
    const params: Record<string, string | number> = { limit };

    if (role !== 'admin') {
      whereClauses.push('jobs.user_id = @userId');
      params.userId = userId;
    }

    if (statusGroup === 'active') {
      whereClauses.push(`jobs.status IN (${activeStatuses.map((_, index) => `@active${index}`).join(', ')})`);
      activeStatuses.forEach((status, index) => {
        params[`active${index}`] = status;
      });
    }

    if (statusGroup === 'completed') {
      whereClauses.push(
        `jobs.status IN (${completedStatuses.map((_, index) => `@completed${index}`).join(', ')})`,
      );
      completedStatuses.forEach((status, index) => {
        params[`completed${index}`] = status;
      });
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const rows = db
      .prepare(`${jobSelect} ${whereSql} ORDER BY jobs.created_at DESC LIMIT @limit`)
      .all(params);

    return rows.map(mapJob);
  });

export const listRecentJobs = ({ userId, limit = 8 }: { userId: number; limit?: number }) =>
  listJobs({ role: 'user', userId, limit, statusGroup: 'all' }).slice(0, limit);

export const getDashboardStats = ({ userId }: { userId: number }) =>
  safeDbCall('getDashboardStats', () => {
    const params = { userId };
    const row = db
      .prepare(
        `
          SELECT
            SUM(CASE WHEN status IN ('queued', 'pending', 'pending-held', 'processing', 'processing-stopped', 'submitting') THEN 1 ELSE 0 END) AS activeJobs,
            SUM(CASE WHEN status = 'queued' OR status = 'pending' OR status = 'pending-held' THEN 1 ELSE 0 END) AS queuedJobs,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completedJobs
          FROM jobs
          WHERE user_id = @userId
        `,
      )
      .get(params) as { activeJobs?: number; queuedJobs?: number; completedJobs?: number } | undefined;

    const printersRow = db
      .prepare(
        'SELECT COUNT(*) AS total FROM printers WHERE enabled = 1',
      )
      .get() as { total?: number } | undefined;

    return {
      activeJobs: row?.activeJobs || 0,
      queuedJobs: row?.queuedJobs || 0,
      completedJobs: row?.completedJobs || 0,
      availablePrinters: printersRow?.total || 0,
    };
  });

export default db;
