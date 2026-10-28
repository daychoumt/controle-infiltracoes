import {problem,localDate,validDate} from '../assets/domain.js';
import {validateCourse,mergeCourse,closingSummary,courseId,versionsMatch} from '../assets/agenda-domain.js';

const decode=row=>({...JSON.parse(row.payload),version:row.version,createdAt:row.created_at,updatedAt:row.updated_at});
export class AgendaRepository {
  constructor(db){this.db=db;}
  stmt(sql,...values){return this.db.prepare(sql).bind(...values);}
  async list(cursor='') {
    if(cursor&&!courseId.test(cursor))throw problem(400,'Página inválida.');
    const {results}=await this.stmt('SELECT * FROM agenda_courses WHERE id > ? ORDER BY id LIMIT 101',cursor).all();
    return {items:results.slice(0,100).map(decode),nextCursor:results.length>100?results[99].id:null};
  }
  async all(){const {results}=await this.stmt('SELECT * FROM agenda_courses ORDER BY id').all();return results.map(decode);}
  async get(id) {
    const row=await this.stmt('SELECT * FROM agenda_courses WHERE id = ?',id).first();
    if(!row)throw problem(404,'Acompanhamento não encontrado.');
    return decode(row);
  }
  async save(input,user,create=false) {
    if(!['admin','recepcao'].includes(user.role))throw problem(403,'A agenda é atualizada pelo setor de autorizações.');
    const today=localDate(),at=new Date().toISOString();
    const previous=create?null:await this.get(input.id);
    const record=create?{...validateCourse(input,today),version:1}:mergeCourse(previous,input,today);
    const payload=JSON.stringify(validateCourse(record,today));
    try {
      if(create) {
        const existing=await this.stmt('SELECT * FROM agenda_courses WHERE id = ?',record.id).first();
        if(existing) {
          if(existing.created_by===user.uid&&existing.payload===payload)return decode(existing);
          throw problem(409,'Este acompanhamento já existe. Atualize a agenda.');
        }
        await this.db.batch([
          this.stmt('INSERT INTO agenda_courses (id,prontuario,archived,payload,created_at,updated_at,created_by) VALUES (?,?,?,?,?,?,?)',record.id,record.prontuario,record.archived?1:0,payload,at,at,user.uid),
          this.stmt('INSERT INTO agenda_events (course_id,version,at,actor_uid,action,payload) VALUES (?,1,?,?,?,?)',record.id,at,user.uid,'Acompanhamento aberto na agenda',payload)
        ]);
      } else {
        const result=await this.db.batch([
          this.stmt('INSERT INTO agenda_events (course_id,version,at,actor_uid,action,payload) SELECT id,version+1,?,?,?,? FROM agenda_courses WHERE id = ? AND version = ?',at,user.uid,'Datas e solicitações conferidas na agenda',payload,record.id,previous.version),
          this.stmt('UPDATE agenda_courses SET prontuario = ?,archived = ?,payload = ?,version = version+1,updated_at = ? WHERE id = ? AND version = ?',record.prontuario,record.archived?1:0,payload,at,record.id,previous.version)
        ]);
        if(result[1].meta.changes!==1)throw problem(409,'Este acompanhamento mudou. Atualize a agenda antes de salvar.');
      }
    } catch(error) {
      if(/agenda_active_patient|UNIQUE constraint failed: agenda_courses.prontuario/i.test(String(error?.message)))throw problem(409,'Este prontuário já tem um acompanhamento ativo. Abra o paciente para registrar o dia.');
      throw error;
    }
    return this.get(record.id);
  }
  async closing(day) {
    const row=await this.stmt('SELECT * FROM agenda_closings WHERE day = ?',day).first();
    if(!row)return null;
    return {day:row.day,summary:JSON.parse(row.summary),courseVersions:JSON.parse(row.course_versions),version:row.version,closedAt:row.closed_at};
  }
  async close(input,user) {
    if(!['admin','recepcao'].includes(user.role))throw problem(403,'O fechamento é feito pelo setor de autorizações.');
    if(!validDate(input.day)||input.day>localDate()||input.confirmed!==true)throw problem(400,'Confira a data e confirme a revisão do dia.');
    const courses=await this.all(),summary=closingSummary(courses,input.day),versions=Object.fromEntries(courses.map(course=>[course.id,course.version]));
    if(!versionsMatch(courses,input.courseVersions))throw problem(409,'A agenda mudou durante a conferência. Reabra o fechamento para revisar as alterações.');
    const previous=await this.closing(input.day);
    if((input.version || 0)!==(previous?.version || 0))throw problem(409,'O fechamento mudou. Reabra a conferência do dia.');
    const at=new Date().toISOString();
    if(previous) {
      const result=await this.db.batch([this.stmt('UPDATE agenda_closings SET summary = ?,course_versions = ?,version = version+1,closed_at = ?,closed_by = ? WHERE day = ? AND version = ?',JSON.stringify(summary),JSON.stringify(versions),at,user.uid,input.day,previous.version)]);
      if(result[0].meta.changes!==1)throw problem(409,'O fechamento mudou. Reabra a conferência do dia.');
    } else {
      try{await this.db.batch([this.stmt('INSERT INTO agenda_closings (day,summary,course_versions,closed_at,closed_by) VALUES (?,?,?,?,?)',input.day,JSON.stringify(summary),JSON.stringify(versions),at,user.uid)]);}catch{throw problem(409,'Este dia já foi conferido. Reabra o fechamento.');}
    }
    return this.closing(input.day);
  }
}

export async function agendaRoute(request,url,env,user,readJson,dependencies={}) {
  const repository=dependencies.agendaRepository || new AgendaRepository(env.DB);
  const match=/^\/agenda\/courses\/([\da-f-]+)$/i.exec(url.pathname);
  if(match&&!courseId.test(match[1]))throw problem(400,'Acompanhamento inválido.');
  if(url.pathname==='/agenda/courses'&&request.method==='GET')return {status:200,body:await repository.list(url.searchParams.get('cursor') || '')};
  if(url.pathname==='/agenda/courses'&&request.method==='POST')return {status:201,body:await repository.save(await readJson(request,24576),user,true)};
  if(match&&request.method==='PATCH') {
    const input=await readJson(request,24576);
    if(input.id!==match[1])throw problem(400,'Acompanhamento inválido.');
    return {status:200,body:await repository.save(input,user)};
  }
  if(url.pathname==='/agenda/closing'&&request.method==='GET') {
    const day=url.searchParams.get('day');if(!validDate(day))throw problem(400,'Informe uma data válida.');
    return {status:200,body:{closing:await repository.closing(day)}};
  }
  if(url.pathname==='/agenda/closing'&&request.method==='POST')return {status:200,body:{closing:await repository.close(await readJson(request),user)}};
  throw problem(405,'Método não permitido nesta rota.');
}
