import {validateCaseFields,emptyChecks,transition,eventLabel,problem,localDate} from './domain.js?v=7';
export class DemoStore {
  constructor() {
    this.role='recepcao'; this.offset=0;
    const entries=[
      ['10021','Ana Exemplo','Convênio Exemplo A','Dr. Exemplo A','Joelho','Direito','2','realizado',-2,{autorizada:true,assinada:true}],
      ['10022','Bruno Exemplo','Convênio Exemplo B','Dra. Exemplo B','Ombro','Esquerdo','1','solicitado',3,{}],
      ['10023','Carla Exemplo','Convênio Exemplo A','Dr. Exemplo A','Quadril','Direito','3','faturamento',-4,{autorizada:true,assinada:true,execucao:true,documentos:true}],
      ['10024','Daniel Exemplo','Particular','Dra. Exemplo B','Joelho','Esquerdo','1','agendado',2,{autorizada:true}],
      ['10025','Elisa Exemplo','Convênio Exemplo B','Dr. Exemplo A','Tornozelo','Direito','2','solicitado',-1,{}],
      ['10026','Felipe Exemplo','Convênio Exemplo A','Dra. Exemplo B','Ombro','Direito','1','faturamento',-6,{autorizada:true,assinada:true,execucao:true,documentos:true}],
      ['10027','Gabriela Exemplo','Convênio Exemplo B','Dr. Exemplo A','Cotovelo','Esquerdo','1','recebido',4,{}],
      ['10028','Hugo Exemplo','Particular','Dra. Exemplo B','Joelho','Direito','3','conferencia',-3,{autorizada:true,assinada:true,execucao:true,documentos:true}],
      ['10021','Ana Exemplo','Convênio Exemplo A','Dr. Exemplo A','Joelho','Direito','1','faturamento',-34,{autorizada:true,assinada:true,execucao:true,documentos:true}],
      ['10021','Ana Exemplo','Convênio Exemplo A','Dr. Exemplo A','Ombro','Esquerdo','1','faturamento',-32,{autorizada:true,assinada:true,execucao:true,documentos:true}],
      ['10029','Iara Exemplo','Convênio Exemplo B','Dra. Exemplo B','Joelho','Esquerdo','1','faturamento',-33,{autorizada:true,assinada:true,execucao:true,documentos:true}]
    ];
    this.records=entries.map(([prontuario,paciente,convenio,executor,articulacao,lado,numeroAplicacao,stage,days,checks],i)=>{
      const date=new Date();date.setDate(date.getDate()+days);
      const updateDays=[0,4,0,0,7,0,3,0,0,0,0][i];
      const at=new Date(Date.now()-updateDays*86400000-(i+1)*3600000).toISOString();
      const numeroGuia=['agendado','realizado','conferencia','faturamento'].includes(stage)?`GUIA-${String(80500+i).padStart(6,'0')}`:'';
      const pendencia=i===6,condicaoProcesso=pendencia?'pedido_correcao':'regular',observacao=pendencia?'Pedido sem carimbo do médico. Aguardando correção.':'';
      const requestDate=new Date();requestDate.setDate(requestDate.getDate()-12-i);
      const dataAplicacao=localDate(date);
      const billing=new Date(date);billing.setDate(billing.getDate()+1);
      const dataFaturamento=stage==='faturamento'?localDate(billing):'';
      return {id:`demo-${String(i+1).padStart(3,'0')}`,fields:{prontuario,paciente,convenio,medicacao:'Medicação Exemplo A',articulacao,lado,numeroAplicacao,pedidoRacimed:`RC-${202600+i}`,numeroGuia,pendencia,condicaoProcesso,observacao,aplicacao:`${numeroAplicacao}ª aplicação · ${articulacao} ${lado.toLowerCase()}`,dataPedido:localDate(requestDate),dataAplicacao,dataFaturamento,data:dataAplicacao,executor,atendente:'Equipe de demonstração'},
        stage,checks:{...emptyChecks(),...checks},version:1,createdAt:at,updatedAt:at,
        events:[{at,actor:'Demonstração',action:'Cenário fictício carregado para explorar esta etapa'}]};
    });
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
    const record={id:input.id,fields,stage:'recebido',checks:emptyChecks(),version:1,createdAt:at,updatedAt:at,events:[{at,actor:this.role,action:'Guia cadastrada no controle'}]};
    this.records.unshift(record);return structuredClone(record);
  }
  async update(id,input) {
    const previous=await this.detail(id),updated=transition(previous,input,this.role);
    updated.updatedAt=new Date().toISOString();updated.events.push({at:updated.updatedAt,actor:this.role,action:eventLabel(previous,updated)});
    this.records[this.records.findIndex(r=>r.id===id)]=updated;return structuredClone(updated);
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
  clear() {this.token='';}
}
