import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import * as domain from '../assets/domain.js';
import {DemoStore,ApiStore} from '../assets/store.js';

// Exercise the real panel controller without a browser, network or patient data.
// This small view double implements only the controls used by these workflows.
class Control {
  constructor(tag='div',text='',className='') {
    Object.assign(this,{tag,textContent:text??'',className,children:[],value:'',checked:false,disabled:false,hidden:false,open:false,listeners:new Map(),formValues:{}});
    this.elements=new Proxy({}, {get:(target,key)=>target[key]??(target[key]=new Control('input'))});
  }
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=[...children];}
  before(){}
  setAttribute(key,value){this[key]=value;}
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(fn);}
  async emit(type){for(const fn of this.listeners.get(type)??[])await fn({target:this,currentTarget:this,preventDefault(){}});}
  descendants(){return this.children.flatMap(child=>child instanceof Control?[child,...child.descendants()]:[]);}
  querySelectorAll(selector){return this.descendants().filter(child=>child.tag===selector);}
  querySelector(selector){return this.querySelectorAll(selector)[0]??new Control();}
  showModal(){this.open=true;}
  close(){this.open=false;}
  focus(){}
  reset(){this.formValues={};}
}
async function panel(source) {
  const controls=new Map(),$=selector=>{
    if(!controls.has(selector))controls.set(selector,new Control());
    return controls.get(selector);
  };
  const context=createContext({
    ...domain,DemoStore,ApiStore,$,node:(...args)=>new Control(...args),
    fillOptions(){},closeDialogs(){},summary(){},displayDate:value=>value||'—',
    config:{apiUrl:'',firebaseApiKey:''},crypto,structuredClone,
    document:{querySelector:$,querySelectorAll:()=>[]},
    FormData:class {constructor(form){this.entries=Object.entries(form.formValues);}[Symbol.iterator](){return this.entries[Symbol.iterator]();}}
  });
  const code=readFileSync(new URL('../assets/painel.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
  runInContext(code+'\nglobalThis.panelTest={openCase,openNewCase,save,updateAdvanceState,setSource(value){store=value;},get selected(){return selected;},get records(){return records;}};',context);
  await new Promise(resolve=>setImmediate(resolve));
  context.panelTest.setSource(source);
  return {...context.panelTest,get current(){return context.panelTest.selected;},$,api:context.panelTest};
}
const fields={prontuario:'PILOTO-01',paciente:'Paciente fictício do piloto',convenio:'Particular',medicacao:'',executor:'Dr. Exemplo A',articulacao:'Joelho',lado:'Direito',numeroAplicacao:'1',dataPedido:'2026-01-01',dataAgendamento:'2026-01-10',dataAplicacao:'',numeroGuia:'GUIA-PILOTO',condicaoProcesso:'regular'};
async function readyForScheduling(source,overrides={}) {
  let record=await source.create({id:crypto.randomUUID(),fields:{...fields,...overrides}});
  for(const stage of ['solicitado','autorizado'])record=await source.update(record.id,{version:record.version,stage});
  return record;
}

test('reabrir guia libera a ação pronta sem precisar alterar um campo',async()=>{
  const source=new DemoStore(),record=await readyForScheduling(source),view=await panel(source);
  await view.api.openCase(record.id);
  assert.equal(view.$('#case-dialog').open,true);
  assert.equal(view.$('#advance').textContent,'Registrar agendamento');
  assert.equal(view.$('#advance').disabled,false);
});

test('cadastro abre a guia e libera o envio à operadora',async()=>{
  const source=new DemoStore(),view=await panel(source);
  view.api.openNewCase();view.$('#new-case').formValues=fields;
  await view.$('#new-case').emit('submit');
  assert.equal((await source.list()).items.length,1);
  assert.equal(view.current.stage,'recebido');
  assert.equal(view.$('#case-dialog').open,true);
  assert.equal(view.$('#advance').disabled,false);
});

test('outra articulação carrega seus detalhes completos quando a lista não contém eventos',async()=>{
  const data=new DemoStore(),knee=await readyForScheduling(data),shoulder=await readyForScheduling(data,{articulacao:'Ombro'}),lookups=[];
  const source={role:'recepcao',async list(){return {items:(await data.list()).items.map(({events,...summary})=>summary),nextCursor:null};},async detail(id){lookups.push(id);return data.detail(id);}};
  const view=await panel(source);await view.api.openCase(knee.id);
  const openOther=view.$('#patient-history').querySelectorAll('button').find(button=>button.textContent==='Abrir processo');
  assert.ok(openOther);await openOther.emit('click');
  assert.deepEqual(lookups,[knee.id,shoulder.id]);
  assert.equal(view.current.id,shoulder.id);
  assert.equal(view.$('#case-history').children.length,shoulder.events.length);
  assert.equal(view.$('#advance').disabled,false);
});

test('corrigir o perfil mantém o histórico e libera a próxima ação',async()=>{
  const data=new DemoStore(),record=await readyForScheduling(data);
  const source={role:'recepcao',async list(){return {items:(await data.list()).items.map(({events,...summary})=>summary),nextCursor:null};},detail:id=>data.detail(id),updatePatient:(chart,profile)=>data.updatePatient(chart,profile)};
  const view=await panel(source);await view.api.openCase(record.id);
  view.$('#profile-form').elements.paciente.value='Paciente fictício corrigido';view.$('#profile-form').elements.convenio.value='Particular';
  await view.$('#profile-form').emit('submit');
  assert.equal(view.current.fields.paciente,'Paciente fictício corrigido');
  assert.equal(view.$('#profile-error').textContent,'');
  assert.equal(view.$('#case-history').children.length,record.events.length);
  assert.equal(view.$('#advance').disabled,false);
});

test('piloto completa somente o ombro, preserva os joelhos e entrega um único processo',async()=>{
  const source=new DemoStore();
  const right=await readyForScheduling(source),left=await readyForScheduling(source,{lado:'Esquerdo'}),shoulder=await readyForScheduling(source,{articulacao:'Ombro'});
  const view=await panel(source);await view.api.openCase(shoulder.id);await view.api.save(true);
  assert.equal(view.current.stage,'agendado');assert.equal(view.$('#advance').disabled,true);
  assert.equal(view.current.fields.dataAplicacao,'');
  view.$('#case-scheduled-date').value='2026-01-12';await view.api.save(false);
  assert.equal(view.current.stage,'agendado');assert.equal(view.current.fields.dataAgendamento,'2026-01-12');
  view.$('#case-date').value='2026-01-12';await view.$('#case-form').emit('input');
  assert.equal(view.$('#advance').disabled,false);await view.api.save(true);
  assert.equal(view.current.stage,'realizado');await view.api.save(true);
  for(const input of view.$('#case-checks').querySelectorAll('input'))input.checked=true;
  await view.$('#case-form').emit('change');await view.api.save(true);
  const batch=await source.createBatch({id:crypto.randomUUID(),caseIds:[shoulder.id],competencia:'2026-01',recebidoPor:'Equipe fictícia'});
  assert.equal(batch.items.length,1);assert.equal(batch.items[0].stage,'faturamento');
  assert.equal((await source.detail(right.id)).stage,'autorizado');assert.equal((await source.detail(left.id)).stage,'autorizado');
});
