import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handle} from '../worker/index.mjs';
import {authenticate} from '../worker/auth.mjs';
import {Repository,SQL} from '../worker/repository.mjs';
import {emptyChecks} from '../assets/domain.js';
const fields={prontuario:'10021',paciente:'Paciente fictício',convenio:'Particular',medicacao:'',articulacao:'Joelho',lado:'Direito',numeroAplicacao:'1',pedidoRacimed:'RC-100',aplicacao:'1ª aplicação · Joelho direito',data:'2026-01-01',executor:'Dr. Arthur',atendente:'Equipe'};
const env={FIREBASE_PROJECT_ID:'clinic-test',FIREBASE_WEB_API_KEY:'public-test-config',DB:{},ALLOWED_ORIGINS:'https://clinic.example',STAFF_ROLES:JSON.stringify({'staff-1':'recepcao'})};
const user={uid:'staff-1',role:'recepcao'};
const id='10000000-0000-4000-8000-000000000001';
const all={autorizada:true,assinada:true,execucao:true,documentos:true};
function request(path,method='GET',body,extra={}) {return new Request('https://worker.example'+path,{method,headers:{Origin:'https://clinic.example',Authorization:'Bearer test','Content-Type':'application/json',...extra},body:body===undefined?undefined:JSON.stringify(body)});}
function fixture() {
  const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../migrations/0001_cases.sql',import.meta.url),'utf8'));
  const binding={
    prepare(sql){return {bind(...args){return {sql,args,async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};}};}}},
    async batch(statements){db.exec('BEGIN');try{const results=statements.map(({sql,args})=>({meta:db.prepare(sql).run(...args)}));db.exec('COMMIT');return results;}catch(error){db.exec('ROLLBACK');throw error;}}
  };
  return {db,binding,repository:new Repository(binding)};
}
test('nega origem não autorizada e não toca na autenticação',async()=>{
  let calls=0;const r=await handle(request('/cases','GET',undefined,{Origin:'https://evil.example'}),env,{authenticate:()=>{calls++;}});
  assert.equal(r.status,403);assert.equal(calls,0);assert.equal(r.headers.get('Access-Control-Allow-Origin'),null);
});
test('preflight permitido e respostas de dados não são cacheáveis',async()=>{
  const r=await handle(request('/cases','OPTIONS'),env);assert.equal(r.status,204);assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://clinic.example');assert.equal(r.headers.get('Cache-Control'),'no-store');
});
test('ninguém consulta casos sem token',async()=>{
  const r=await handle(request('/cases','GET',undefined,{Authorization:''}),env);assert.equal(r.status,401);
});
test('projeto não configurado permanece fechado',async()=>assert.equal((await handle(request('/cases'),{})).status,403));
function token(overrides={}){const data={aud:'clinic-test',iss:'https://securetoken.google.com/clinic-test',sub:'staff-1',exp:Date.now()/1000+3600,auth_time:1000,...overrides};return 'header.'+Buffer.from(JSON.stringify(data)).toString('base64url')+'.signature';}
const lookup=(account={localId:'staff-1'})=>async()=>Response.json({users:[account]});
test('token precisa ser validado pelo Firebase, não apenas decodificado',async()=>{
  await assert.rejects(authenticate(token(),env,async()=>Response.json({}, {status:400})),{status:401});
  assert.deepEqual(await authenticate(token(),env,lookup()),user);
});
test('tokens de outro projeto ou expirados são recusados antes da consulta',async()=>{
  let calls=0;const fetcher=()=>{calls++;};
  await assert.rejects(authenticate(token({aud:'finance-project'}),env,fetcher),{status:401});
  await assert.rejects(authenticate(token({exp:1}),env,fetcher),{status:401});assert.equal(calls,0);
});
test('conta sem liberação, desativada ou com sessão revogada é recusada',async()=>{
  await assert.rejects(authenticate(token(),{...env,STAFF_ROLES:'{}'},lookup()),{status:403});
  await assert.rejects(authenticate(token(),env,lookup({localId:'staff-1',disabled:true})),{status:401});
  await assert.rejects(authenticate(token(),env,lookup({localId:'staff-1',validSince:'2000'})),{status:401});
});
test('faturamento não cria atendimentos',async()=>{
  const r=await handle(request('/cases','POST',{id,fields}),env,{authenticate:async()=>({...user,role:'faturamento'})});assert.equal(r.status,403);
});
test('limite considera bytes reais, mesmo sem Content-Length',async()=>{
  const r=await handle(request('/cases','POST',{id,fields,padding:'a'.repeat(9000)}),env,{authenticate:async()=>user});assert.equal(r.status,413);
});
test('API grava, consulta, confere, encaminha e recebe usando SQL real',async()=>{
  const {db,repository}=fixture(),deps={repository,authenticate:async()=>user};
  let response=await handle(request('/cases','POST',{id,fields}),env,deps);assert.equal(response.status,201);
  let record=await response.json();assert.equal(record.events.length,1);
  for(const [version,stage,role] of [[1,'agendado','recepcao'],[2,'realizado','recepcao'],[3,'faturamento','recepcao'],[4,'concluido','faturamento']]) {
    response=await handle(request('/cases/'+id,'PATCH',{version,stage,checks:all}),env,{...deps,authenticate:async()=>({...user,role})});
    assert.equal(response.status,200);record=await response.json();
  }
  assert.equal(record.version,5);assert.equal(record.events.length,5);assert.equal(record.stage,'concluido');
  const list=await (await handle(request('/cases'),env,deps)).json();assert.equal(list.items.length,1);assert.equal(list.items[0].fields.paciente,fields.paciente);db.close();
});
test('repetir cadastro com mesmo protocolo não duplica após falha de rede',async()=>{
  const {db,repository}=fixture(),deps={repository,authenticate:async()=>user};
  await handle(request('/cases','POST',{id,fields}),env,deps);
  assert.equal((await handle(request('/cases','POST',{id,fields}),env,deps)).status,201);
  assert.equal((await repository.list()).items.length,1);assert.equal((await repository.get(id)).events.length,1);
  assert.equal((await handle(request('/cases','POST',{id,fields:{...fields,paciente:'Outro paciente'}}),env,deps)).status,409);db.close();
});
test('atualização concorrente não sobrescreve nem acrescenta evento falso',async()=>{
  const {db,repository}=fixture(),at='2026-01-01T00:00:00.000Z';
  await repository.create({id,fields,checks:emptyChecks(),stage:'autorizacao',createdAt:at,updatedAt:at},user);
  const previous=await repository.get(id),changed={...previous,checks:all,stage:'agendado',updatedAt:at};
  await repository.update(previous,changed,user);
  await assert.rejects(repository.update(previous,{...changed,stage:'realizado'},user),{status:409});
  const result=await repository.get(id);assert.equal(result.stage,'agendado');assert.equal(result.events.length,2);db.close();
});
test('falha na segunda escrita desfaz evento e registro no mesmo lote',async()=>{
  const {db,repository}=fixture(),at='2026-01-01T00:00:00.000Z';
  await repository.create({id,fields,checks:emptyChecks(),stage:'autorizacao',createdAt:at,updatedAt:at},user);
  const previous=await repository.get(id);
  await assert.rejects(repository.update(previous,{...previous,checks:all,stage:'invalid',updatedAt:at},user));
  assert.equal((await repository.get(id)).events.length,1);assert.equal((await repository.get(id)).version,1);db.close();
});
test('paginação cobre 102 registros sem perdas e ordena pelos mais recentes',async()=>{
  const {db,repository}=fixture();
  for(let i=0;i<102;i++) {
    const at=new Date(Date.UTC(2026,0,1,0,i)).toISOString();
    db.prepare(SQL.create).run(crypto.randomUUID(),JSON.stringify(fields),'autorizacao',JSON.stringify(emptyChecks()),at,at,user.uid);
  }
  const first=await repository.list(),second=await repository.list(first.nextCursor);
  assert.equal(first.items.length,100);assert.equal(second.items.length,2);assert.equal(second.nextCursor,null);
  assert.equal(new Set([...first.items,...second.items].map(r=>r.id)).size,102);assert.ok(first.items[0].createdAt>first.items[99].createdAt);db.close();
});
test('erros internos não expõem dados, SQL ou configuração',async()=>{
  const r=await handle(request('/cases'),env,{authenticate:async()=>user,repository:{list(){throw new Error('SELECT patient secret-key');}}});
  assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/SELECT|patient|secret-key/);
});
