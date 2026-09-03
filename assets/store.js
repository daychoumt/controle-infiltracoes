import {validateFields,emptyChecks,transition,eventLabel,problem,localDate} from './domain.js';
export class DemoStore {
  constructor() {
    this.role='recepcao'; this.offset=0;
    const entries=[
      ['Ana Exemplo','Bradesco Saúde','realizado',-2,{autorizada:true,assinada:true}],
      ['Bruno Exemplo','Omint','autorizacao',3,{}],
      ['Carla Exemplo','Particular','faturamento',-4,{autorizada:true,assinada:true,execucao:true,documentos:true}],
      ['Daniel Exemplo','CarePlus','agendado',2,{autorizada:true}],
      ['Elisa Exemplo','Cassi','realizado',-1,{autorizada:true}],
      ['Felipe Exemplo','Seguros Unimed','concluido',-6,{autorizada:true,assinada:true,execucao:true,documentos:true}],
      ['Gabriela Exemplo','GEAP','autorizacao',4,{}],
      ['Hugo Exemplo','Vivest','realizado',-3,{autorizada:true,assinada:true,execucao:true,documentos:true}]
    ];
    this.records=entries.map(([paciente,convenio,stage,days,checks],i)=>{
      const date=new Date();date.setDate(date.getDate()+days);
      const at=new Date(Date.now()-(i+1)*3600000).toISOString();
      return {id:`demo-${String(i+1).padStart(3,'0')}`,fields:{paciente,convenio,medicacao:'Osteonil',aplicacao:'Exemplo fictício para demonstração do fluxo',data:localDate(date),executor:'Dr. Arthur',atendente:'Equipe de demonstração'},
        stage,checks:{...emptyChecks(),...checks},version:1,createdAt:at,updatedAt:at,
        events:[{at,actor:'Demonstração',action:'Cenário fictício carregado para explorar esta etapa'}]};
    });
  }
  async list() { return {items:structuredClone(this.records),nextCursor:null}; }
  async detail(id) { const found=this.records.find(r=>r.id===id);if(!found) throw problem(404,'Atendimento não encontrado.');return structuredClone(found); }
  async create(input) {
    if(!['recepcao','admin'].includes(this.role)) throw problem(403,'A abertura de atendimentos é feita pela recepção.');
    const fields=validateFields(input.fields),at=new Date().toISOString();
    const record={id:input.id,fields,stage:'autorizacao',checks:emptyChecks(),version:1,createdAt:at,updatedAt:at,events:[{at,actor:this.role,action:'Atendimento aberto'}]};
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
  list(cursor='') { return this.request('/cases'+(cursor ? '?cursor='+encodeURIComponent(cursor) : '')); }
  detail(id) { return this.request('/cases/'+encodeURIComponent(id)); }
  create(input) { return this.request('/cases',{method:'POST',body:JSON.stringify(input)}); }
  update(id,input) { return this.request('/cases/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify(input)}); }
  clear() {this.token='';}
}
