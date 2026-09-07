import test from 'node:test';
import assert from 'node:assert/strict';
import {ApiStore} from '../assets/store.js';
import {SessionGuard,SESSION_IDLE_MS} from '../assets/session.js';

test('sessão é bloqueada após quinze minutos sem atividade',()=>{
  let now=0,scheduled,expired=0,nextId=0;
  const guard=new SessionGuard(()=>expired++,{
    now:()=>now,
    setTimer:callback=>{scheduled=callback;return ++nextId;},
    clearTimer:()=>{}
  });
  guard.start();now=SESSION_IDLE_MS-1000;assert.equal(guard.touch(),true);assert.equal(expired,0);
  now+=SESSION_IDLE_MS;scheduled();assert.equal(expired,1);assert.equal(guard.active,false);
  scheduled();assert.equal(expired,1);
});

test('token vencido é renovado somente em memória e a requisição é repetida uma vez',async()=>{
  const originalFetch=globalThis.fetch,calls=[];
  globalThis.fetch=async(url,options={})=>{
    calls.push({url:String(url),authorization:options.headers?.Authorization,body:String(options.body || '')});
    if(String(url).startsWith('https://securetoken.googleapis.com/'))return Response.json({id_token:'token-novo',refresh_token:'refresh-novo'});
    if(calls.filter(call=>call.url==='https://api.example/session').length===1)return Response.json({error:'expirado'},{status:401});
    return Response.json({role:'recepcao',name:'Equipe'});
  };
  try {
    const store=new ApiStore({apiUrl:'https://api.example',firebaseApiKey:'config-publica'},{idToken:'token-antigo',refreshToken:'refresh-antigo'});
    assert.deepEqual(await store.session(),{role:'recepcao',name:'Equipe'});
    assert.equal(calls.length,3);assert.equal(calls[2].authorization,'Bearer token-novo');assert.match(calls[1].body,/refresh-antigo/);
    store.clear();assert.equal(store.token,'');assert.equal(store.refreshToken,'');
  } finally {globalThis.fetch=originalFetch;}
});

test('consulta de prontuário usa corpo protegido e não expõe identificador na URL',async()=>{
  const originalFetch=globalThis.fetch;let captured;
  globalThis.fetch=async(url,options={})=>{captured={url:String(url),options};return Response.json({patient:null});};
  try {
    const store=new ApiStore({apiUrl:'https://api.example',firebaseApiKey:'config-publica'},'token');
    await store.patient('ABC-123');
    assert.equal(captured.url,'https://api.example/patient/lookup');assert.equal(captured.options.method,'POST');
    assert.deepEqual(JSON.parse(captured.options.body),{prontuario:'ABC-123'});assert.doesNotMatch(captured.url,/ABC-123/);
  } finally {globalThis.fetch=originalFetch;}
});
