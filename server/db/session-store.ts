import session from 'express-session';
import type { Database, Statement } from 'better-sqlite3';
import type { SessionData } from 'express-session';

type SessionCallback = (error?: unknown, session?: SessionData | null) => void;

class SQLiteSessionStore extends session.Store {
  private db: Database;
  private getStatement: Statement<[string], { sess: string; expiresAt: number }>;
  private setStatement: Statement<[Record<string, unknown>]>;
  private destroyStatement: Statement<[string]>;
  private cleanupStatement: Statement<[number]>;
  private cleanupTimer: NodeJS.Timeout;

  constructor(db: Database) {
    super();
    this.db = db;

    this.getStatement = db.prepare(
      'SELECT sess, expires_at AS expiresAt FROM sessions WHERE sid = ?',
    );
    this.setStatement = db.prepare(
      `
        INSERT INTO sessions (sid, sess, expires_at)
        VALUES (@sid, @sess, @expiresAt)
        ON CONFLICT(sid)
        DO UPDATE SET sess = excluded.sess, expires_at = excluded.expires_at
      `,
    );
    this.destroyStatement = db.prepare('DELETE FROM sessions WHERE sid = ?');
    this.cleanupStatement = db.prepare('DELETE FROM sessions WHERE expires_at < ?');

    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, 60 * 60 * 1000);
    this.cleanupTimer.unref();
  }

  get(sid: string, callback: SessionCallback) {
    try {
      const row = this.getStatement.get(sid);
      if (!row) {
        return callback(null, null);
      }

      if (row.expiresAt <= Date.now()) {
        this.destroyStatement.run(sid);
        return callback(null, null);
      }

        return callback(null, JSON.parse(row.sess) as SessionData);
    } catch (error) {
      return callback(error);
    }
  }

  set(sid: string, sess: SessionData, callback: (error?: unknown) => void = () => {}) {
    try {
      const expiresAt = this.#resolveExpiration(sess);
      this.setStatement.run({
        sid,
        sess: JSON.stringify(sess),
        expiresAt,
      });
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  destroy(sid: string, callback: (error?: unknown) => void = () => {}) {
    try {
      this.destroyStatement.run(sid);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  touch(sid: string, sess: SessionData, callback: (error?: unknown) => void = () => {}) {
    this.set(sid, sess, callback);
  }

  cleanupExpired() {
    this.cleanupStatement.run(Date.now());
  }

  #resolveExpiration(sess: SessionData) {
    if (sess?.cookie?.expires) {
      return new Date(sess.cookie.expires).getTime();
    }

    if (sess?.cookie?.maxAge) {
      return Date.now() + sess.cookie.maxAge;
    }

    return Date.now() + 1000 * 60 * 60 * 8;
  }
}

export { SQLiteSessionStore };
