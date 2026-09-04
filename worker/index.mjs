import {problem,validateCaseFields,emptyChecks,transition} from '../assets/domain.js';
import {authenticate} from './auth.mjs';
import {Repository} from './repository.mjs';
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
    const url=new URL(request.url),match=/^\/cases\/([\da-f-]+)$/i.exec(url.pathname);
    if(!['/session','/cases'].includes(url.pathname) && !match)throw problem(404,'Rota não encontrada.');
    if(!env.FIREBASE_PROJECT_ID || !env.FIREBASE_WEB_API_KEY || !env.DB)throw problem(503,'O painel da equipe ainda precisa ser configurado.');
    const token=/^Bearer (\S+)$/.exec(request.headers.get('Authorization') || '')?.[1];
    if(!token || token.length>8192)throw problem(401,'Entre com sua conta da equipe.');
    const user=await (dependencies.authenticate || authenticate)(token,env);
    const repository=dependencies.repository || new Repository(env.DB);
    if(url.pathname==='/session' && request.method==='GET')return reply(200,{role:user.role});
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
    if(url.pathname==='/cases' && request.method==='POST') {
      if(!['admin','recepcao'].includes(user.role))throw problem(403,'A abertura de guias é feita pelo setor de autorizações.');
      const input=await readJson(request);
      if(!input || !uuid.test(input.id))throw problem(400,'Protocolo inválido.');
      const fields=validateCaseFields(input.fields),at=new Date().toISOString();
      return reply(201,await repository.create({id:input.id,fields,stage:'recebido',checks:emptyChecks(),version:1,createdAt:at,updatedAt:at},user));
    }
    if(match && request.method==='PATCH') {
      const input=await readJson(request),previous=await repository.get(match[1]);
      const updated=transition(previous,input,user.role);
      updated.updatedAt=new Date().toISOString();
      return reply(200,await repository.update(previous,updated,user));
    }
    throw problem(405,'Método não permitido nesta rota.');
  } catch(error) {
    // Never emit raw provider errors, SQL, credentials or patient data.
    const known=[400,401,403,404,405,409,413,415,503].includes(error.status);
    return reply(known?error.status:503,{error:known?error.message:'Não foi possível concluir a operação. Confira o atendimento antes de tentar novamente.'});
  }
}
export default {fetch:handle};
