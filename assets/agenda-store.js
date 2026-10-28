import {ApiStore} from './store.js?v=14';
import {validateCourse,mergeCourse,closingSummary,versionsMatch} from './agenda-domain.js';
import {localDate,problem,validDate} from './domain.js';

export class DemoAgendaStore {
  constructor(){this.items=[];this.closings=new Map();}
  async listAll(){return structuredClone(this.items);}
  async save(input,create=false) {
    const previous=this.items.find(course=>course.id===input.id);
    const data=create?validateCourse(input):mergeCourse(previous || {},input);
    if(create&&previous)throw problem(409,'Este acompanhamento já existe.');
    if(this.items.some(course=>course.id!==input.id&&!course.archived&&!data.archived&&course.prontuario===data.prontuario))throw problem(409,'Este prontuário já tem um acompanhamento ativo. Abra o paciente para registrar o dia.');
    const now=new Date().toISOString(),record={...data,version:create?1:data.version,createdAt:previous?.createdAt || now,updatedAt:now};
    this.items=this.items.filter(course=>course.id!==input.id);this.items.push(record);return structuredClone(record);
  }
  async closing(day){return structuredClone(this.closings.get(day) || null);}
  async close(input) {
    if(!validDate(input.day)||input.day>localDate()||input.confirmed!==true)throw problem(400,'Confira a data e confirme a revisão do dia.');
    const previous=this.closings.get(input.day);
    if(!versionsMatch(this.items,input.courseVersions))throw problem(409,'A agenda mudou durante a conferência. Reabra o fechamento.');
    if((input.version || 0)!==(previous?.version || 0))throw problem(409,'O fechamento mudou. Reabra a conferência.');
    const closing={day:input.day,version:(previous?.version || 0)+1,summary:closingSummary(this.items,input.day),courseVersions:Object.fromEntries(this.items.map(course=>[course.id,course.version])),closedAt:new Date().toISOString()};
    this.closings.set(input.day,closing);return structuredClone(closing);
  }
}

export class ApiAgendaStore {
  constructor(config,credentials){this.api=new ApiStore(config,credentials);}
  session(){return this.api.session();}
  async listAll() {
    const items=[];let cursor='';const seen=new Set();
    do {
      const result=await this.api.request('/agenda/courses'+(cursor?'?cursor='+encodeURIComponent(cursor):''));
      items.push(...result.items);cursor=result.nextCursor || '';
      if(cursor&&seen.has(cursor))throw problem(503,'Não foi possível carregar a agenda completa. Atualize antes de conferir o dia.');
      seen.add(cursor);
    }while(cursor);
    return items;
  }
  save(input,create=false){return this.api.request('/agenda/courses'+(create?'':'/'+encodeURIComponent(input.id)),{method:create?'POST':'PATCH',body:JSON.stringify(input)});}
  async closing(day){return (await this.api.request('/agenda/closing?day='+encodeURIComponent(day))).closing;}
  async close(input){return (await this.api.request('/agenda/closing',{method:'POST',body:JSON.stringify(input)})).closing;}
  clear(){this.api.clear();}
}
