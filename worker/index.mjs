import {problem,validateCaseFields,emptyChecks,transition,ROLES,localDate} from '../assets/domain.js';
import {authenticate} from './auth.mjs';
import {Repository} from './repository.mjs';
import {parseReferences} from './references.mjs';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function readJson(request) {
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw problem(415,'Envie os dados em JSON.');
  const reader=request.body?.getReader();if(!reader)throw problem(400,'Dados ausentes.');
  let bytes=0,chunks=[];
  while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>8192){await reader.cancel();throw problem(413,'Registro acima do limite de tamanho.');}chunks.push(value);}
  try{return JSON.parse(await new Blob(chunks).text());}catch{throw problem(400,'Dados inválidos.');}
}
export async function handle(request,env,dependencies={}) {
  const origin=request.headers.get('Origin'),headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
  const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers});
  const allowed=(env.ALLOWED_ORIGINS || '').split(',').map(s=>s.trim()).filter(Boolean);
  if(origin && !allowed.includes(origin))return reply(403,{error:'Origem não autorizada.'});
  if(origin)headers['Access-Control-Allow-Origin']=origin;
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, POST, PATCH, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'600'}});
  try {
    const url=new URL(request.url),match=/^\/cases\/([\da-f-]+)$/i.exec(url.pathname),batchMatch=/^\/batches\/([\da-f-]+)$/i.exec(url.pathname);
    if(!['/session','/references','/patient','/cases','/batches'].includes(url.pathname) && !match && !batchMatch)throw problem(404,'Rota não encontrada.');
    if(!env.FIREBASE_PROJECT_ID || !env.FIREBASE_WEB_API_KEY || !env.DB)throw problem(503,'O painel da equipe ainda precisa ser configurado.');
    const token=/^Bearer (\S+)$/.exec(request.headers.get('Authorization') || '')?.[1];
    if(!token || token.length>8192)throw problem(401,'Entre com sua conta da equipe.');
    const user=await (dependencies.authenticate || authenticate)(token,env);
    const repository=dependencies.repository || new Repository(env.DB);
    if(url.pathname==='/session' && request.method==='GET')return reply(200,{role:user.role,name:user.name || ROLES[user.role]});
    if(url.pathname==='/references' && request.method==='GET')return reply(200,parseReferences(env.REFERENCE_DATA));
    if(url.pathname==='/patient' && request.method==='GET') {
      const prontuario=String(url.searchParams.get('prontuario') || '').trim().toUpperCase();
      if(!/^[A-Z0-9./-]{2,30}$/.test(prontuario))throw problem(400,'Informe um prontuário válido.');
      return reply(200,{patient:await repository.patient(prontuario)});
    }
    if(url.pathname==='/patient' && request.method==='PATCH') {
      if(!['admin','recepcao'].includes(user.role))throw problem(403,'A correção de pacientes é feita pelo setor de autorizações.');
      const input=await readJson(request),prontuario=String(input.prontuario || '').trim().toUpperCase();
      const paciente=String(input.paciente || '').trim(),convenio=String(input.convenio || '').trim();
      if(!/^[A-Z0-9./-]{2,30}$/.test(prontuario) || paciente.length<2 || paciente.length>120 || !parseReferences(env.REFERENCE_DATA).convenios.includes(convenio))throw problem(400,'Confira o prontuário, o nome e o convênio.');
      return reply(200,{patient:await repository.updatePatient(prontuario,{paciente,convenio},user)});
    }
    if(url.pathname==='/cases' && request.method==='GET') {
      const cursor=url.searchParams.get('cursor') || '';
      if(cursor) {
        const parts=cursor.split('|');
        if(parts.length!==2 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(parts[0]) || !uuid.test(parts[1]))throw problem(400,'Página inválida.');
      }
      return reply(200,await repository.list(cursor));
    }
    if(match && !uuid.test(match[1]))throw problem(400,'Protocolo inválido.');
    if(match && request.method==='GET')return reply(200,await repository.get(match[1]));
    if(batchMatch && !uuid.test(batchMatch[1]))throw problem(400,'Lote inválido.');
    if(batchMatch && request.method==='GET')return reply(200,await repository.getBatch(batchMatch[1]));
    if(url.pathname==='/batches' && request.method==='GET')return reply(200,await repository.listBatches());
    if(url.pathname==='/cases' && request.method==='POST') {
      if(!['admin','recepcao'].includes(user.role))throw problem(403,'A abertura de guias é feita pelo setor de autorizações.');
      const input=await readJson(request);
      if(!input || !uuid.test(input.id))throw problem(400,'Protocolo inválido.');
      let fields=validateCaseFields({...input.fields,atendente:user.name || ROLES[user.role]},parseReferences(env.REFERENCE_DATA));
      const patient=await repository.patient(fields.prontuario);
      if(patient)fields={...fields,paciente:patient.paciente,convenio:patient.convenio};
      const duplicate=(await repository.patientCases(fields.prontuario)).find(record=>record.id!==input.id&&record.fields.articulacao===fields.articulacao&&record.fields.lado===fields.lado&&record.fields.numeroAplicacao===fields.numeroAplicacao);
      if(duplicate)throw problem(409,'Já existe um processo ativo para esta articulação, lado e aplicação. Abra a guia existente para atualizá-la.');
      const at=new Date().toISOString();
      return reply(201,await repository.create({id:input.id,fields,stage:'recebido',checks:emptyChecks(),version:1,createdAt:at,updatedAt:at},user));
    }
    if(match && request.method==='PATCH') {
      const input=await readJson(request),previous=await repository.get(match[1]);
      const updated=transition(previous,input,user.role,parseReferences(env.REFERENCE_DATA));
      updated.updatedAt=new Date().toISOString();updated.stageChangedAt=updated.stage===previous.stage?previous.stageChangedAt:updated.updatedAt;
      return reply(200,await repository.update(previous,updated,user));
    }
    if(url.pathname==='/batches' && request.method==='POST') {
      if(!['admin','recepcao'].includes(user.role))throw problem(403,'A entrega ao faturamento é feita pelo setor de autorizações.');
      const input=await readJson(request),ids=[...new Set(Array.isArray(input.caseIds)?input.caseIds:[])];
      const recebidoPor=String(input.recebidoPor || '').trim(),observacao=String(input.observacao || '').trim(),competencia=String(input.competencia || '').trim();
      if(!uuid.test(input.id || '') || !/^\d{4}-\d{2}$/.test(competencia) || ids.length<1 || ids.length>100 || ids.some(id=>!uuid.test(id)) || recebidoPor.length<2 || recebidoPor.length>120 || observacao.length>500)throw problem(400,'Confira as guias, a competência e quem recebeu o lote.');
      const previous=await Promise.all(ids.map(id=>repository.get(id)));
      if(previous.some(record=>record.stage!=='pronto_faturamento'))throw problem(409,'Uma das guias não está mais pronta para faturamento. Atualize a lista.');
      const convenio=previous[0].fields.convenio;if(previous.some(record=>record.fields.convenio!==convenio))throw problem(400,'Cada lote deve conter apenas um convênio.');
      const at=new Date().toISOString(),reference=`AMOT-${competencia.replace('-','')}-${input.id.slice(0,6).toUpperCase()}`;
      const updates=previous.map(record=>{const updated=transition(record,{version:record.version,stage:'faturamento',checks:record.checks,deliveryBatchId:input.id,deliveryReference:reference},user.role,parseReferences(env.REFERENCE_DATA));updated.updatedAt=at;updated.stageChangedAt=at;return {previous:record,updated};});
      return reply(201,await repository.createBatch({id:input.id,reference,competencia,convenio,recebidoPor,observacao,createdAt:at,dataEntrega:localDate(new Date(at))},updates,user));
    }
    throw problem(405,'Método não permitido nesta rota.');
  } catch(error) {
    // Never emit raw provider errors, SQL, credentials or patient data.
    const known=[400,401,403,404,405,409,413,415,503].includes(error.status);
    return reply(known?error.status:503,{error:known?error.message:'Não foi possível concluir a operação. Confira o atendimento antes de tentar novamente.'});
  }
}
export default {fetch:handle};
