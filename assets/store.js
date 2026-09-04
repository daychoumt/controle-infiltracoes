import {validateCaseFields,emptyChecks,transition,eventLabel,problem,localDate} from './domain.js?v=4';
export class DemoStore {
  constructor() {
    this.role='recepcao'; this.offset=0;
    const entries=[
      ['10021','Ana Exemplo','Bradesco Saúde','Dr. Arthur','Joelho','Direito','2','realizado',-2,{autorizada:true,assinada:true}],
      ['10022','Bruno Exemplo','Omint','Dr. Diego','Ombro','Esquerdo','1','solicitado',3,{}],
      ['10023','Carla Exemplo','Bradesco Saúde','Dr. Ali','Quadril','Direito','3','faturamento',-4,{autorizada:true,assinada:true,execucao:true,documentos:true}],
      ['10024','Daniel Exemplo','CarePlus','Dr. Gustavo','Joelho','Esquerdo','1','agendado',2,{autorizada:true}],
      ['10025','Elisa Exemplo','Cassi','Dr. Lucas','Tornozelo','Direito','2','solicitado',-1,{}],
      ['10026','Felipe Exemplo','Seguros Unimed','Dr. Victor','Ombro','Direito','1','faturamento',-6,{autorizada:true,assinada:true,execucao:true,documentos:true}],
      ['10027','Gabriela Exemplo','GEAP','Dr. Renato','Cotovelo','Esquerdo','1','recebido',4,{}],
      ['10028','Hugo Exemplo','Vivest','Dr. Yuri','Joelho','Direito','3','conferencia',-3,{autorizada:true,assinada:true,execucao:true,documentos:true}],
      ['10021','Ana Exemplo','Bradesco Saúde','Dr. Arthur','Joelho','Direito','1','faturamento',-34,{autorizada:true,assinada:true,execucao:true,documentos:true}],
      ['10021','Ana Exemplo','Bradesco Saúde','Dr. Arthur','Ombro','Esquerdo','1','faturamento',-32,{autorizada:true,assinada:true,execucao:true,documentos:true}],
      ['10029','Iara Exemplo','Omint','Dr. Diego','Joelho','Esquerdo','1','faturamento',-33,{autorizada:true,assinada:true,execucao:true,documentos:true}]
    ];
    this.records=entries.map(([prontuario,paciente,convenio,executor,articulacao,lado,numeroAplicacao,stage,days,checks],i)=>{
      const date=new Date();date.setDate(date.getDate()+days);
      const at=new Date(Date.now()-(i+1)*3600000).toISOString();
      const numeroGuia=['agendado','realizado','conferencia','faturamento'].includes(stage)?`GUIA-${String(80500+i).padStart(6,'0')}`:'';
      const pendencia=i===6,observacao=pendencia?'Aguardando correção do pedido médico.':'';
      return {id:`demo-${String(i+1).padStart(3,'0')}`,fields:{prontuario,paciente,convenio,medicacao:'Osteonil',articulacao,lado,numeroAplicacao,pedidoRacimed:`RC-${202600+i}`,numeroGuia,pendencia,observacao,aplicacao:`${numeroAplicacao}ª aplicação · ${articulacao} ${lado.toLowerCase()}`,data:localDate(date),executor,atendente:'Equipe de demonstração'},
        stage,checks:{...emptyChecks(),...checks},version:1,createdAt:at,updatedAt:at,
        events:[{at,actor:'Demonstração',action:'Cenário fictício carregado para explorar esta etapa'}]};
    });
  }
  async list() { return {items:structuredClone(this.records),nextCursor:null}; }
  async detail(id) { const found=this.records.find(r=>r.id===id);if(!found) throw problem(404,'Atendimento não encontrado.');return structuredClone(found); }
  async create(input) {
    if(!['recepcao','admin'].includes(this.role)) throw problem(403,'A abertura de guias é feita pelo setor de autorizações.');
    const fields=validateCaseFields(input.fields),at=new Date().toISOString();
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
  list(cursor='') { return this.request('/cases'+(cursor ? '?cursor='+encodeURIComponent(cursor) : '')); }
  detail(id) { return this.request('/cases/'+encodeURIComponent(id)); }
  create(input) { return this.request('/cases',{method:'POST',body:JSON.stringify(input)}); }
  update(id,input) { return this.request('/cases/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify(input)}); }
  clear() {this.token='';}
}
