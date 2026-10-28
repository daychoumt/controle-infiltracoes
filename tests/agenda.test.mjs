import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {localDate,addDays} from '../assets/domain.js';
import {validateCourse,emptyApplications,agendaRows,applicationPlan,closingSummary,calendarFile,versionsMatch} from '../assets/agenda-domain.js';
import {DemoAgendaStore,ApiAgendaStore} from '../assets/agenda-store.js';
import {AgendaRepository} from '../worker/agenda.mjs';
import {handle} from '../worker/index.mjs';

const id='10000000-0000-4000-8000-000000000001';
const makeCourse=()=>({id,prontuario:'TESTE-01',paciente:'Paciente fictício da agenda',convenio:'Porto (teste)',intervalDays:7,archived:false,sites:['Direito','Esquerdo'].map(side=>({joint:'Joelho',side,applications:emptyApplications()}))});
const at=(course,side,number)=>course.sites.find(site=>site.side===side).applications[number-1];

test('bilateral mantém a mesma realização e solicitações independentes em 28 e 31/10',()=>{
  const input=makeCourse();
  Object.assign(at(input,'Direito',1),{appliedOn:'2026-10-28',requestedOn:'2026-10-28',reminderOn:'2026-10-28'});
  Object.assign(at(input,'Esquerdo',1),{appliedOn:'2026-10-28',reminderOn:'2026-10-31'});
  const course=validateCourse(input,'2026-10-28'),rows=agendaRows([course],'2026-10-28');
  assert.equal(rows.find(row=>row.site.side==='Direito'&&row.app.number===1).status,'sent');
  const left=rows.find(row=>row.site.side==='Esquerdo'&&row.app.number===1);
  assert.equal(left.due,'2026-10-31');assert.equal(left.status,'upcoming');assert.equal(left.app.appliedOn,'2026-10-28');
  assert.equal(left.app.requestedOn,'');
});

test('sete dias partem da aplicação real de cada lado, mesmo com envio em outro dia',()=>{
  const course=makeCourse();
  Object.assign(at(course,'Direito',1),{appliedOn:'2026-10-28',requestedOn:'2026-10-28'});
  Object.assign(at(course,'Esquerdo',1),{appliedOn:'2026-10-28',requestedOn:'2026-10-31'});
  const rows=agendaRows([course],'2026-11-01');
  assert.deepEqual(rows.filter(row=>row.app.number===2).map(row=>row.earliest),['2026-11-04','2026-11-04']);
  assert.equal(rows.find(row=>row.app.number===3).due,'');
  assert.equal(rows.find(row=>row.app.number===3).status,'waiting');
});

test('corrigir ou remarcar a aplicação recalcula a próxima sem marcar uma previsão como realizada',()=>{
  const course=makeCourse(),site=course.sites[0];
  at(course,'Direito',1).appliedOn='2026-10-28';
  at(course,'Direito',2).reminderOn='2026-11-04';
  assert.equal(applicationPlan(course,site,site.applications[1]).due,'2026-11-04');
  at(course,'Direito',1).appliedOn='2026-10-30';
  assert.equal(applicationPlan(course,site,site.applications[1]).due,'2026-11-06');
  assert.equal(site.applications[1].appliedOn,'');
  at(course,'Direito',2).appliedOn='2026-11-06';
  assert.equal(applicationPlan(course,site,site.applications[2]).due,'2026-11-13');
});

test('datas futuras são permitidas para lembretes e recusadas para acontecimentos reais',()=>{
  const course=makeCourse();at(course,'Direito',1).reminderOn='2026-11-04';
  assert.doesNotThrow(()=>validateCourse(course,'2026-10-28'));
  at(course,'Direito',1).requestedOn='2026-10-29';
  assert.throws(()=>validateCourse(course,'2026-10-28'),{status:400});
  at(course,'Direito',1).requestedOn='';at(course,'Direito',1).appliedOn='2026-02-30';
  assert.throws(()=>validateCourse(course,'2026-10-28'),{status:400});
});

test('histórico divergente é preservado e sinalizado para conferência',()=>{
  const course=makeCourse(),site=course.sites[0];
  site.applications[0].appliedOn='2026-10-20';site.applications[1].appliedOn='2026-10-22';
  const validated=validateCourse(course,'2026-10-28');
  assert.equal(validated.sites[0].applications[1].appliedOn,'2026-10-22');
  assert.match(applicationPlan(validated,validated.sites[0],validated.sites[0].applications[1]).issues.join(' '),/intervalo/);
});

test('um lembrete sem data real anterior continua identificado como previsão',()=>{
  const course=makeCourse(),site=course.sites[0];site.applications[1].reminderOn='2026-11-04';
  const plan=applicationPlan(course,site,site.applications[1]);assert.equal(plan.provisional,true);assert.equal(plan.earliest,'');assert.equal(plan.due,'2026-11-04');
});

test('fechamento conta envio na data real e mantém a pendência no dia seguinte',()=>{
  const course=makeCourse();
  Object.assign(at(course,'Direito',1),{appliedOn:'2026-10-28',requestedOn:'2026-10-28',reminderOn:'2026-10-28'});
  Object.assign(at(course,'Esquerdo',1),{appliedOn:'2026-10-28',reminderOn:'2026-10-30'});
  assert.deepEqual(closingSummary([course],'2026-10-28'),{day:'2026-10-28',requested:1,applied:2,pending:0,tomorrow:0,issues:0});
  assert.equal(closingSummary([course],'2026-10-30').pending,1);
  assert.equal(agendaRows([course],'2026-10-31').find(row=>row.site.side==='Esquerdo'&&row.app.number===1).status,'overdue');
  assert.equal(at(course,'Esquerdo',1).requestedOn,'');
});

test('encerrar tira as pendências da fila e mantém o histórico e os totais reais',()=>{
  const course=makeCourse();Object.assign(at(course,'Direito',1),{requestedOn:'2026-10-28',reminderOn:'2026-10-27'});course.archived=true;
  assert.equal(agendaRows([course],'2026-10-28').length,0);
  assert.equal(agendaRows([course],'2026-10-28',{includeArchived:true}).length,6);
  assert.equal(closingSummary([course],'2026-10-28').requested,1);
});

test('validação rejeita lado repetido e entrada incompleta sem falha interna',()=>{
  const course=makeCourse();course.sites[1]=structuredClone(course.sites[0]);assert.throws(()=>validateCourse(course),{status:400});
  course.sites=[null];assert.throws(()=>validateCourse(course),{status:400});
});

test('calendário leva somente datas e quantidades, com alarme e identificadores estáveis',()=>{
  const course=makeCourse();at(course,'Direito',1).reminderOn='2026-11-04';at(course,'Esquerdo',1).reminderOn='2026-11-04';at(course,'Direito',1).guide='GUIA-SECRETA';
  const ics=calendarFile([course],'2026-10-28');
  assert.equal((ics.match(/BEGIN:VEVENT/g)||[]).length,1);assert.match(ics,/DTSTART:20261104T110000Z/);assert.match(ics,/BEGIN:VALARM/);
  assert.doesNotMatch(ics,/TESTE-01|Paciente fictício|GUIA-SECRETA|Joelho|Porto/);
  for(const line of ics.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
});

test('demonstração não reaproveita os pacientes ao abrir outra sessão e protege contra sobrescrita',async()=>{
  const demo=new DemoAgendaStore(),course=await demo.save(makeCourse(),true);
  assert.equal((await new DemoAgendaStore().listAll()).length,0);
  await demo.save({...course,paciente:'Nome corrigido'});
  await assert.rejects(demo.save({...course,paciente:'Nome antigo'}),{status:409});
});

function fixture() {
  const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../migrations/0007_agenda.sql',import.meta.url),'utf8'));
  const binding={prepare(sql){return {bind(...args){return {sql,args,async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};}};}}},async batch(statements){db.exec('BEGIN');try{const result=statements.map(({sql,args})=>({meta:db.prepare(sql).run(...args)}));db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}};
  return {db,binding,repository:new AgendaRepository(binding)};
}
const user={uid:'staff-test',role:'recepcao',name:'Equipe de teste'};
const env={FIREBASE_PROJECT_ID:'test',FIREBASE_WEB_API_KEY:'test',ALLOWED_ORIGINS:'https://clinic.example',DB:{}};
const request=(path,method='GET',body,headers={})=>new Request('https://worker.example'+path,{method,headers:{Origin:'https://clinic.example',Authorization:'Bearer test','Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});

test('API da agenda exige a mesma autenticação e origem protegida do painel',async()=>{
  assert.equal((await handle(request('/agenda/courses','GET',undefined,{Authorization:''}),env)).status,401);
  assert.equal((await handle(request('/agenda/courses','GET',undefined,{Origin:'https://evil.example'}),env)).status,403);
  assert.equal((await handle(request('/agenda/closing?day=2026-10-28','GET',undefined,{Authorization:''}),env)).status,401);
});

test('criação é idempotente e o banco impede dois acompanhamentos ativos do prontuário',async()=>{
  const {db,repository}=fixture(),course=makeCourse();
  await repository.save(course,user,true);await repository.save(course,user,true);
  assert.equal(db.prepare('SELECT count(*) AS total FROM agenda_events').get().total,1);
  await assert.rejects(repository.save({...course,id:crypto.randomUUID()},user,true),{status:409});
  const archived=await repository.save({...await repository.get(course.id),archived:true},user);
  assert.equal(archived.archived,true);await repository.save({...course,id:crypto.randomUUID()},user,true);
  db.close();
});

test('escrita concorrente não perde datas e cada versão preserva a fotografia do registro',async()=>{
  const {db,repository}=fixture(),created=await repository.save(makeCourse(),user,true),first=structuredClone(created),second=structuredClone(created);
  at(first,'Direito',1).requestedOn=localDate();at(second,'Esquerdo',1).requestedOn=localDate();
  await repository.save(first,user);await assert.rejects(repository.save(second,user),{status:409});
  const persisted=await repository.get(id);assert.equal(at(persisted,'Direito',1).requestedOn,localDate());assert.equal(at(persisted,'Esquerdo',1).requestedOn,'');
  const events=db.prepare('SELECT version,payload FROM agenda_events ORDER BY version').all();assert.equal(events.length,2);
  assert.equal(at(JSON.parse(events[0].payload),'Direito',1).requestedOn,'');assert.equal(at(JSON.parse(events[1].payload),'Direito',1).requestedOn,localDate());
  db.close();
});

test('fechar o dia não envia pedidos e recusa uma conferência baseada em versões antigas',async()=>{
  const {db,repository}=fixture(),course=makeCourse();at(course,'Esquerdo',1).reminderOn=addDays(localDate(),-1);
  const created=await repository.save(course,user,true),versions={[id]:created.version};
  const closed=await repository.close({day:localDate(),confirmed:true,courseVersions:versions},user);
  assert.equal(closed.summary.pending,1);assert.equal(at(await repository.get(id),'Esquerdo',1).requestedOn,'');
  const changed=await repository.get(id);at(changed,'Esquerdo',1).requestedOn=localDate();await repository.save(changed,user);
  await assert.rejects(repository.close({day:localDate(),confirmed:true,version:closed.version,courseVersions:versions},user),{status:409});
  assert.equal(versionsMatch(await repository.all(),closed.courseVersions),false);
  db.close();
});

test('API cria, lê e atualiza sem aceitar outro id no caminho ou papel sem permissão',async()=>{
  const {db,binding,repository}=fixture(),deps={authenticate:async()=>user,agendaRepository:repository};
  const created=await handle(request('/agenda/courses','POST',makeCourse()),{...env,DB:binding},deps);assert.equal(created.status,201);
  const list=await handle(request('/agenda/courses'),{...env,DB:binding},deps);assert.equal((await list.json()).items.length,1);assert.equal(list.headers.get('Cache-Control'),'no-store');
  const mismatch=await handle(request('/agenda/courses/'+id,'PATCH',{...makeCourse(),id:crypto.randomUUID(),version:1}),{...env,DB:binding},deps);assert.equal(mismatch.status,400);
  await assert.rejects(repository.save({...makeCourse(),id:crypto.randomUUID(),prontuario:'TESTE-02'},{...user,role:'visitor'},true),{status:403});db.close();
});

test('carregamento da API percorre todas as páginas para não omitir pacientes do fechamento',async()=>{
  const store=new ApiAgendaStore({apiUrl:'https://example.invalid',firebaseApiKey:'test'},'test'),calls=[];
  store.api.request=async path=>{calls.push(path);return calls.length===1?{items:[{id:'first'}],nextCursor:id}:{items:[{id:'last'}],nextCursor:null};};
  assert.deepEqual((await store.listAll()).map(course=>course.id),['first','last']);assert.equal(calls.length,2);
});
