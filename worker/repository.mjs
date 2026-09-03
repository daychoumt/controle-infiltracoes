import {problem,eventLabel} from '../assets/domain.js';
// Each write and its audit event commit together. The version predicate protects
// against two staff members overwriting each other's work.
export const SQL={
  get:'SELECT * FROM cases WHERE id = ?',
  list:'SELECT * FROM cases WHERE (? = 0 OR created_at < ? OR (created_at = ? AND id < ?)) ORDER BY created_at DESC, id DESC LIMIT 101',
  events:'SELECT at, role AS actor, actor_uid AS actorUid, action FROM events WHERE case_id = ? ORDER BY version ASC',
  create:'INSERT INTO cases (id, payload, stage, checks, version, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, 1, ?, ?, ?)',
  createEvent:'INSERT INTO events (case_id, version, at, actor_uid, role, action) VALUES (?, 1, ?, ?, ?, ?)',
  updateEvent:'INSERT INTO events (case_id, version, at, actor_uid, role, action) SELECT id, version + 1, ?, ?, ?, ? FROM cases WHERE id = ? AND version = ?',
  update:'UPDATE cases SET stage = ?, checks = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?'
};
const decode=row=>({id:row.id,fields:JSON.parse(row.payload),stage:row.stage,checks:JSON.parse(row.checks),version:row.version,createdAt:row.created_at,updatedAt:row.updated_at});
export class Repository {
  constructor(db){this.db=db;}
  stmt(key,...values){return this.db.prepare(SQL[key]).bind(...values);}
  async list(cursor='') {
    const [at='',id='']=cursor.split('|');
    const {results}=await this.stmt('list',cursor?1:0,at,at,id).all();
    const items=results.slice(0,100).map(decode);
    return {items,nextCursor:results.length>100?`${items.at(-1).createdAt}|${items.at(-1).id}`:null};
  }
  async get(id) {
    const row=await this.stmt('get',id).first();
    if(!row)throw problem(404,'Atendimento não encontrado.');
    const {results}=await this.stmt('events',id).all();
    return {...decode(row),events:results};
  }
  async create(record,user) {
    const existing=await this.stmt('get',record.id).first();
    if(existing) {
      if(existing.created_by!==user.uid || existing.payload!==JSON.stringify(record.fields))throw problem(409,'Este protocolo já existe. Confira a fila antes de abrir outro atendimento.');
      return this.get(record.id);
    }
    await this.db.batch([
      this.stmt('create',record.id,JSON.stringify(record.fields),record.stage,JSON.stringify(record.checks),record.createdAt,record.updatedAt,user.uid),
      this.stmt('createEvent',record.id,record.createdAt,user.uid,user.role,eventLabel(null,record))
    ]);
    return this.get(record.id);
  }
  async update(previous,updated,user) {
    const result=await this.db.batch([
      this.stmt('updateEvent',updated.updatedAt,user.uid,user.role,eventLabel(previous,updated),previous.id,previous.version),
      this.stmt('update',updated.stage,JSON.stringify(updated.checks),updated.updatedAt,previous.id,previous.version)
    ]);
    if(result[1].meta.changes!==1)throw problem(409,'Este atendimento foi atualizado. Reabra os detalhes antes de alterar.');
    return this.get(previous.id);
  }
}
