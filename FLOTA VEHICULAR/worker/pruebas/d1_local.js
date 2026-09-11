/**
 * Adaptador mínimo que imita la API de D1 sobre node:sqlite, para poder probar
 * el Worker sin desplegarlo. Solo cubre lo que la API usa: prepare, bind,
 * first, all, run — con la misma forma de respuesta que devuelve D1.
 */
import { DatabaseSync } from 'node:sqlite';

const normalizar = v => (typeof v === 'boolean' ? (v ? 1 : 0) : v === undefined ? null : v);

export function crearD1(rutaSql) {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  return {
    _db: db,
    exec: sql => db.exec(sql),
    prepare(sql) {
      let argumentos = [];
      const api = {
        bind(...a) { argumentos = a.map(normalizar); return api; },
        first() {
          const st = db.prepare(sql);
          return st.get(...argumentos) ?? null;
        },
        all() {
          const st = db.prepare(sql);
          return { results: st.all(...argumentos), success: true };
        },
        run() {
          const st = db.prepare(sql);
          const r = st.run(...argumentos);
          return {
            success: true,
            meta: { last_row_id: Number(r.lastInsertRowid), changes: Number(r.changes) },
          };
        },
      };
      return api;
    },
  };
}
