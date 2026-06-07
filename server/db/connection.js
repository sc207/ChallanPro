const fs = require('fs');
const path = require('path');
const config = require('../config');

let db = null;
let isTurso = false;

function wrapLibsql(client) {
  return {
    exec(sql) {
      return client.executeMultiple(sql);
    },
    prepare(sql) {
      return {
        run(...params) {
          return client.execute({ sql, args: params });
        },
        get(...params) {
          return client.execute({ sql, args: params }).then(r => r.rows[0] || null);
        },
        all(...params) {
          return client.execute({ sql, args: params }).then(r => r.rows);
        },
      };
    },
    transaction(fn) {
      return async () => {
        await client.execute('BEGIN');
        try {
          const result = await fn();
          await client.execute('COMMIT');
          return result;
        } catch (e) {
          await client.execute('ROLLBACK');
          throw e;
        }
      };
    },
  };
}

function wrapSqlite(native) {
  return {
    exec(sql) {
      native.exec(sql);
    },
    prepare(sql) {
      return native.prepare(sql);
    },
    transaction(fn) {
      return native.transaction(fn);
    },
  };
}

async function getDb() {
  if (db) return db;

  if (config.turso.url && config.turso.token) {
    const { createClient } = require('@libsql/client');
    const client = createClient({ url: config.turso.url, authToken: config.turso.token });
    isTurso = true;
    db = wrapLibsql(client);
    return db;
  }

  const Database = require('better-sqlite3');
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const native = new Database(path.join(dataDir, 'challan.db'));
  native.pragma('journal_mode = WAL');
  native.pragma('foreign_keys = ON');
  db = wrapSqlite(native);
  return db;
}

function rowToObj(row) {
  if (!row) return null;
  if (Array.isArray(row)) {
    const obj = {};
    row.forEach((v, i) => { obj[i] = v; });
    return obj;
  }
  const obj = {};
  for (const [k, v] of Object.entries(row)) obj[k] = v;
  return obj;
}

async function queryAll(sql, params = []) {
  const database = await getDb();
  if (isTurso) {
    const rows = await database.prepare(sql).all(...params);
    return rows.map(r => {
      const o = {};
      for (const [k, v] of Object.entries(r)) o[k] = v;
      return o;
    });
  }
  return database.prepare(sql).all(...params);
}

async function queryOne(sql, params = []) {
  const database = await getDb();
  if (isTurso) {
    const row = await database.prepare(sql).get(...params);
    if (!row) return null;
    const o = {};
    for (const [k, v] of Object.entries(row)) o[k] = v;
    return o;
  }
  return database.prepare(sql).get(...params) || null;
}

async function run(sql, params = []) {
  const database = await getDb();
  if (isTurso) {
    const r = await database.prepare(sql).run(...params);
    return { lastInsertRowid: r.lastInsertRowid, changes: r.rowsAffected };
  }
  return database.prepare(sql).run(...params);
}

module.exports = { getDb, queryAll, queryOne, run, isTurso: () => isTurso };
