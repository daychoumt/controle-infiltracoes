import {validateCaseFields,emptyChecks,transition,eventLabel,problem,localDate} from './domain.js?v=10';
export class DemoStore {
  constructor() {
    this.role='recepcao'; this.offset=0;
    this.records=[];this.batches=[];
  }
  async list() { return {items:structuredClone(this.records),nextCursor:null}; }
  async detail(id) { const found=this.records.find(r=>r.id===id);if(!found) throw problem(404,'Atendimento não encontrado.');return structuredClone(found); }
  async patient(prontuario) {
    const found=this.records.filter(r=>r.fields.prontuario===String(prontuario).trim().toUpperCase()).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
    return {patient:found?structuredClone({prontuario:found.fields.prontuario,paciente:found.fields.paciente,convenio:found.fields.convenio}):null};
  }
  async updatePatient(prontuario,profile) {
    const chart=String(prontuario).trim().toUpperCase();
    if(!profile.paciente?.trim() || !profile.convenio)throw problem(400,'Confira o nome e o convênio.');
    let found=false;
    this.records=this.records.map(record=>record.fields.prontuario===chart?(found=true,{...record,fields:{...record.fields,paciente:profile.paciente.trim(),convenio:profile.convenio}}):record);
    if(!found)throw problem(404,'Paciente não encontrado.');
    return {patient:{prontuario:chart,paciente:profile.paciente.trim(),convenio:profile.convenio}};
  }
  async create(input) {
    if(!['recepcao','admin'].includes(this.role)) throw problem(403,'A abertura de guias é feita pelo setor de autorizações.');
    const profile=(await this.patient(input.fields?.prontuario)).patient;
    const fields=validateCaseFields({...input.fields,...(profile?{paciente:profile.paciente,convenio:profile.convenio}:{}),atendente:'Equipe de demonstração'}),at=new Date().toISOString();
    const duplicate=this.records.find(record=>record.fields.prontuario===fields.prontuario&&record.fields.articulacao===fields.articulacao&&record.fields.lado===fields.lado&&record.fields.numeroAplicacao===fields.numeroAplicacao&&!['faturamento','cancelado'].includes(record.stage));
    if(duplicate)throw problem(409,'Já existe um processo ativo para esta articulação, lado e aplicação. Abra a guia existente para atualizá-la.');
    const record={id:input.id,fields,stage:'recebido',checks:emptyChecks(),version:1,createdAt:at,updatedAt:at,stageChangedAt:at,events:[{at,actor:this.role,action:'Guia cadastrada no controle'}]};
    this.records.unshift(record);return structuredClone(record);
  }
  async update(id,input) {
    const previous=await this.detail(id),updated=transition(previous,input,this.role);
    updated.updatedAt=new Date().toISOString();updated.stageChangedAt=updated.stage===previous.stage?previous.stageChangedAt:updated.updatedAt;updated.events.push({at:updated.updatedAt,actor:this.role,action:eventLabel(previous,updated)});
    this.records[this.records.findIndex(r=>r.id===id)]=updated;return structuredClone(updated);
  }
  async listBatches() {return {items:structuredClone(this.batches)};}
  async createBatch(input) {
    if(!/^[0-9a-f-]{36}$/i.test(input.id || '') || !/^\d{4}-\d{2}$/.test(input.competencia || '') || !String(input.recebidoPor || '').trim())throw problem(400,'Confira a competência e quem recebeu o lote.');
    const ids=[...new Set(input.caseIds || [])];if(!ids.length)throw problem(400,'Selecione ao menos uma guia pronta.');
    const previous=ids.map(id=>this.records.find(record=>record.id===id));
    if(previous.some(record=>!record || record.stage!=='pronto_faturamento'))throw problem(409,'Uma das guias não está mais pronta. Atualize a lista.');
    const insurer=previous[0].fields.convenio;if(previous.some(record=>record.fields.convenio!==insurer))throw problem(400,'Cada lote deve conter apenas um convênio.');
    const at=new Date().toISOString(),reference=`AMOT-${input.competencia.replace('-','')}-${input.id.slice(0,6).toUpperCase()}`;
    const updated=previous.map(record=>{const next=transition(record,{version:record.version,stage:'faturamento',checks:record.checks,deliveryBatchId:input.id,deliveryReference:reference},this.role);next.updatedAt=at;next.stageChangedAt=at;next.events.push({at,actor:this.role,action:`Guia entregue ao faturamento no lote ${reference}`});return next;});
    this.records=this.records.map(record=>updated.find(item=>item.id===record.id)||record);
    const batch={id:input.id,reference,competencia:input.competencia,convenio:insurer,recebidoPor:String(input.recebidoPor).trim(),observacao:String(input.observacao || '').trim(),createdAt:at,createdBy:'Equipe de demonstração',total:updated.length,items:updated};
    this.batches.unshift(batch);return structuredClone(batch);
  }
}
export class ApiStore {
  constructor(config,token) { this.base=config.apiUrl.replace(/\/$/,'');this.token=token;this.role=null; }
  async request(path,options={}) {
    const response=await fetch(this.base+path,{...options,cache:'no-store',headers:{'Authorization':`Bearer ${this.token}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(15000)});
    const body=await response.json().catch(()=>({}));
    if(!response.ok) throw problem(response.status,body.error || 'Não foi possível acessar o painel.');
    return body;
  }
  async session() { const user=await this.request('/session');this.role=user.role;return user; }
  references() { return this.request('/references'); }
  patient(prontuario) { return this.request('/patient?prontuario='+encodeURIComponent(prontuario)); }
  updatePatient(prontuario,profile) { return this.request('/patient',{method:'PATCH',body:JSON.stringify({prontuario,...profile})}); }
  list(cursor='') { return this.request('/cases'+(cursor ? '?cursor='+encodeURIComponent(cursor) : '')); }
  detail(id) { return this.request('/cases/'+encodeURIComponent(id)); }
  create(input) { return this.request('/cases',{method:'POST',body:JSON.stringify(input)}); }
  update(id,input) { return this.request('/cases/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify(input)}); }
  listBatches() {return this.request('/batches');}
  createBatch(input) {return this.request('/batches',{method:'POST',body:JSON.stringify(input)});}
  clear() {this.token='';}
}
