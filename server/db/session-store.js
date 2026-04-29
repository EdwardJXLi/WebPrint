import session from 'express-session';

class SQLiteSessionStore extends session.Store {
  constructor(db) {
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

  get(sid, callback) {
    try {
      const row = this.getStatement.get(sid);
      if (!row) {
        return callback(null, null);
      }

      if (row.expiresAt <= Date.now()) {
        this.destroyStatement.run(sid);
        return callback(null, null);
      }

      return callback(null, JSON.parse(row.sess));
    } catch (error) {
      return callback(error);
    }
  }

  set(sid, sess, callback = () => {}) {
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

  destroy(sid, callback = () => {}) {
    try {
      this.destroyStatement.run(sid);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  touch(sid, sess, callback = () => {}) {
    this.set(sid, sess, callback);
  }

  cleanupExpired() {
    this.cleanupStatement.run(Date.now());
  }

  #resolveExpiration(sess) {
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
