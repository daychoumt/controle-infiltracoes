import {problem,eventLabel} from '../assets/domain.js';
// Each write and its audit event commit together. The version predicate protects
// against two staff members overwriting each other's work.
export const SQL={
  get:'SELECT * FROM cases WHERE id = ?',
  patient:'SELECT prontuario, paciente, convenio FROM patients WHERE prontuario = ?',
  patientCases:"SELECT * FROM cases WHERE json_extract(payload, '$.prontuario') = ? AND stage_v3 NOT IN ('faturamento','cancelado') ORDER BY created_at DESC",
  list:'SELECT * FROM cases WHERE (? = 0 OR created_at < ? OR (created_at = ? AND id < ?)) ORDER BY created_at DESC, id DESC LIMIT 101',
  events:'SELECT at, role AS actor, actor_uid AS actorUid, action FROM events WHERE case_id = ? ORDER BY version ASC',
  create:'INSERT INTO cases (id, payload, stage, stage_v2, stage_v3, checks, version, created_at, updated_at, stage_changed_at, created_by) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)',
  createPatient:'INSERT OR IGNORE INTO patients (prontuario, paciente, convenio, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?)',
  updatePatient:'UPDATE patients SET paciente = ?, convenio = ?, updated_at = ?, updated_by = ? WHERE prontuario = ?',
  updatePatientCases:"UPDATE cases SET payload = json_set(payload, '$.paciente', ?, '$.convenio', ?) WHERE json_extract(payload, '$.prontuario') = ?",
  createPatientEvent:'INSERT INTO patient_events (prontuario, at, actor_uid, action) VALUES (?, ?, ?, ?)',
  createEvent:'INSERT INTO events (case_id, version, at, actor_uid, role, action) VALUES (?, 1, ?, ?, ?, ?)',
  updateEvent:'INSERT INTO events (case_id, version, at, actor_uid, role, action) SELECT id, version + 1, ?, ?, ?, ? FROM cases WHERE id = ? AND version = ?',
  update:'UPDATE cases SET payload = ?, stage = ?, stage_v2 = ?, stage_v3 = ?, checks = ?, version = version + 1, updated_at = ?, stage_changed_at = ? WHERE id = ? AND version = ?',
  listBatches:'SELECT b.*, count(i.case_id) AS total FROM delivery_batches b LEFT JOIN delivery_batch_items i ON i.batch_id = b.id GROUP BY b.id ORDER BY b.created_at DESC LIMIT 100',
  getBatch:'SELECT * FROM delivery_batches WHERE id = ?',
  batchItems:'SELECT c.* FROM delivery_batch_items i JOIN cases c ON c.id = i.case_id WHERE i.batch_id = ? ORDER BY json_extract(c.payload, \'$.paciente\') COLLATE NOCASE',
  createBatch:'INSERT INTO delivery_batches (id, reference, competencia, convenio, recebido_por, observacao, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  createBatchItem:"INSERT INTO delivery_batch_items (batch_id, case_id) VALUES (?, (SELECT id FROM cases WHERE id = ? AND version = ? AND stage_v3 = 'pronto_faturamento'))"
};
const legacyStage=stage=>({recebido:'autorizacao',solicitado:'autorizacao',autorizado:'agendado',agendado:'agendado',realizado:'realizado',conferencia:'faturamento',pronto_faturamento:'faturamento',faturamento:'concluido',cancelado:'autorizacao'})[stage] || 'autorizacao';
const legacyStageV2=stage=>({recebido:'recebido',solicitado:'solicitado',autorizado:'agendado',agendado:'agendado',realizado:'realizado',conferencia:'conferencia',pronto_faturamento:'conferencia',faturamento:'faturamento',cancelado:'recebido'})[stage] || 'recebido';
const decode=row=>({id:row.id,fields:JSON.parse(row.payload),stage:row.stage_v3 || row.stage_v2 || ({autorizacao:'solicitado',concluido:'faturamento'}[row.stage] || row.stage),checks:JSON.parse(row.checks),version:row.version,createdAt:row.created_at,updatedAt:row.updated_at,stageChangedAt:row.stage_changed_at || row.updated_at});
const decodeBatch=row=>({id:row.id,reference:row.reference,competencia:row.competencia,convenio:row.convenio,recebidoPor:row.recebido_por,observacao:row.observacao,createdAt:row.created_at,createdBy:row.created_by,total:Number(row.total || 0)});
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
  async patient(prontuario) {
    const row=await this.stmt('patient',prontuario).first();
    return row?{prontuario:row.prontuario,paciente:row.paciente,convenio:row.convenio}:null;
  }
  async patientCases(prontuario) {
    const {results}=await this.stmt('patientCases',prontuario).all();return results.map(decode);
  }
  async updatePatient(prontuario,profile,user) {
    const at=new Date().toISOString(),previous=await this.patient(prontuario);
    if(!previous)throw problem(404,'Paciente não encontrado.');
    const action=`Perfil corrigido: ${previous.paciente} / ${previous.convenio} → ${profile.paciente} / ${profile.convenio}`;
    const result=await this.db.batch([
      this.stmt('updatePatient',profile.paciente,profile.convenio,at,user.uid,prontuario),
      this.stmt('updatePatientCases',profile.paciente,profile.convenio,prontuario),
      this.stmt('createPatientEvent',prontuario,at,user.uid,action)
    ]);
    if(result[0].meta.changes!==1)throw problem(409,'O perfil do paciente mudou. Reabra antes de corrigir.');
    return this.patient(prontuario);
  }
  async create(record,user) {
    const existing=await this.stmt('get',record.id).first();
    if(existing) {
      if(existing.created_by!==user.uid || existing.payload!==JSON.stringify(record.fields))throw problem(409,'Este protocolo já existe. Confira a fila antes de abrir outro atendimento.');
      return this.get(record.id);
    }
    await this.db.batch([
      this.stmt('createPatient',record.fields.prontuario,record.fields.paciente,record.fields.convenio,record.createdAt,record.updatedAt,user.uid),
      this.stmt('create',record.id,JSON.stringify(record.fields),legacyStage(record.stage),legacyStageV2(record.stage),record.stage,JSON.stringify(record.checks),record.createdAt,record.updatedAt,record.stageChangedAt || record.updatedAt,user.uid),
      this.stmt('createEvent',record.id,record.createdAt,user.uid,user.role,eventLabel(null,record))
    ]);
    return this.get(record.id);
  }
  async update(previous,updated,user) {
    const result=await this.db.batch([
      this.stmt('updateEvent',updated.updatedAt,user.uid,user.role,eventLabel(previous,updated),previous.id,previous.version),
      this.stmt('update',JSON.stringify(updated.fields),legacyStage(updated.stage),legacyStageV2(updated.stage),updated.stage,JSON.stringify(updated.checks),updated.updatedAt,updated.stageChangedAt || updated.updatedAt,previous.id,previous.version)
    ]);
    if(result[1].meta.changes!==1)throw problem(409,'Este atendimento foi atualizado. Reabra os detalhes antes de alterar.');
    return this.get(previous.id);
  }
  async listBatches() {
    const {results}=await this.stmt('listBatches').all();return {items:results.map(decodeBatch)};
  }
  async getBatch(id) {
    const row=await this.stmt('getBatch',id).first();if(!row)throw problem(404,'Lote de entrega não encontrado.');
    const {results}=await this.stmt('batchItems',id).all();return {...decodeBatch({...row,total:results.length}),items:results.map(decode)};
  }
  async createBatch(batch,updates,user) {
    const statements=[this.stmt('createBatch',batch.id,batch.reference,batch.competencia,batch.convenio,batch.recebidoPor,batch.observacao,batch.createdAt,user.uid)];
    for(const {previous,updated} of updates)statements.push(
      this.stmt('createBatchItem',batch.id,previous.id,previous.version),
      this.stmt('updateEvent',updated.updatedAt,user.uid,user.role,`Guia entregue ao faturamento no lote ${batch.reference}`,previous.id,previous.version),
      this.stmt('update',JSON.stringify(updated.fields),legacyStage(updated.stage),legacyStageV2(updated.stage),updated.stage,JSON.stringify(updated.checks),updated.updatedAt,updated.stageChangedAt,previous.id,previous.version)
    );
    try{await this.db.batch(statements);}catch{throw problem(409,'Uma das guias mudou. Atualize a lista antes de criar o lote.');}
    return this.getBatch(batch.id);
  }
}
