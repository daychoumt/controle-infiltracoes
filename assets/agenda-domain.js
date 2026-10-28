import {addDays,localDate,validDate,problem,ARTICULACOES,LADOS} from './domain.js';

export const courseId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const siteKey = (joint,side) => `${joint}:${side}`;
const text = (value,max=120) => {
  if(typeof value!=='string' || value.trim().length>max)throw problem(400,'Confira os campos do acompanhamento.');
  return value.trim();
};
const date = (value,today,actual=false) => {
  const out=text(value || '',10);
  if(out && (!validDate(out) || (actual && out>today)))throw problem(400,actual?'Uma data realizada ou enviada não pode estar no futuro.':'Informe uma data válida para o lembrete.');
  return out;
};

export function validateCourse(input,today=localDate()) {
  if(!input || !courseId.test(input.id || ''))throw problem(400,'Acompanhamento inválido.');
  const prontuario=text(input.prontuario).toUpperCase(),paciente=text(input.paciente),convenio=text(input.convenio,80);
  if(!/^[A-Z0-9./-]{2,30}$/.test(prontuario) || paciente.length<2 || convenio.length<2)throw problem(400,'Informe prontuário, nome e convênio.');
  if(!Number.isInteger(input.intervalDays) || input.intervalDays<1 || input.intervalDays>60)throw problem(400,'Confira o intervalo informado para este acompanhamento.');
  if(!Array.isArray(input.sites) || input.sites.length<1 || input.sites.length>12)throw problem(400,'Selecione ao menos uma articulação e lado.');
  const keys=new Set();
  const sites=input.sites.map(site=>{
    if(!site || typeof site!=='object')throw problem(400,'Confira as articulações selecionadas.');
    const joint=text(site.joint,60),side=text(site.side,20),key=siteKey(joint,side);
    if(!ARTICULACOES.includes(joint) || joint==='Outra articulação' || !LADOS.includes(side) || keys.has(key))throw problem(400,'Confira as articulações e lados, sem repetir o mesmo lado.');
    keys.add(key);
    if(!Array.isArray(site.applications) || site.applications.length!==3)throw problem(400,'Cada lado deve conter as três aplicações.');
    const applications=site.applications.map((app,index)=>{
      if(!app || app.number!==index+1)throw problem(400,'Confira a sequência das aplicações.');
      return {number:index+1,appliedOn:date(app.appliedOn,today,true),requestedOn:date(app.requestedOn,today,true),reminderOn:date(app.reminderOn,today),guide:text(app.guide || '',60),note:text(app.note || '',500)};
    });
    return {joint,side,applications};
  });
  return {id:input.id,prontuario,paciente,convenio,intervalDays:input.intervalDays,archived:input.archived===true,sites};
}

export function emptyApplications() {
  return [1,2,3].map(number=>({number,appliedOn:'',requestedOn:'',reminderOn:'',guide:'',note:''}));
}

export function applicationPlan(course,site,app) {
  const previous=site.applications[app.number-2];
  const earliest=previous?.appliedOn?addDays(previous.appliedOn,course.intervalDays):'';
  // A reminder is an organizational date, never an authorization or an execution.
  // A corrected actual date also moves an earlier reminder forward.
  const due=app.reminderOn && earliest ? (app.reminderOn>earliest?app.reminderOn:earliest) : app.reminderOn || earliest;
  const issues=[];
  if(app.number>1 && (app.appliedOn||app.requestedOn) && !previous?.appliedOn)issues.push('Conferir a data real da aplicação anterior');
  if(earliest && app.appliedOn && app.appliedOn<earliest)issues.push('Conferir o intervalo entre as aplicações registradas');
  if(earliest && app.requestedOn && app.requestedOn<earliest)issues.push('Conferir a solicitação anterior ao intervalo informado');
  return {earliest,due,provisional:app.number>1&&!previous?.appliedOn,issues};
}

export function agendaRows(courses,today=localDate(),{includeArchived=false}={}) {
  return courses.filter(course=>includeArchived||!course.archived).flatMap(course=>course.sites.flatMap(site=>site.applications.map(app=>{
    const plan=applicationPlan(course,site,app);
    const status=app.requestedOn?'sent':!plan.due?'waiting':plan.due<today?'overdue':plan.due===today?'today':'upcoming';
    return {course,site,app,...plan,status,key:`${course.id}|${siteKey(site.joint,site.side)}|${app.number}`};
  }))).sort((a,b)=>(a.due || '9999').localeCompare(b.due || '9999') || a.course.paciente.localeCompare(b.course.paciente,'pt-BR') || a.app.number-b.app.number);
}

export function closingSummary(courses,day=localDate()) {
  const all=courses.flatMap(course=>course.sites.flatMap(site=>site.applications.map(app=>({course,site,app,...applicationPlan(course,site,app)}))));
  return {
    day,
    requested:all.filter(row=>row.app.requestedOn===day).length,
    applied:all.filter(row=>row.app.appliedOn===day).length,
    pending:all.filter(row=>!row.course.archived&&!row.app.requestedOn&&row.due&&row.due<=day).length,
    tomorrow:all.filter(row=>!row.course.archived&&!row.app.requestedOn&&row.due===addDays(day,1)).length,
    issues:all.filter(row=>!row.course.archived&&row.issues.length).length
  };
}

export function mergeCourse(previous,input,today=localDate()) {
  if(!Number.isInteger(input.version) || input.version!==previous.version)throw problem(409,'Este acompanhamento mudou. Atualize a agenda antes de salvar.');
  const next=validateCourse({...input,id:previous.id},today);
  return {...previous,...next,version:previous.version+1};
}

export function versionsMatch(courses,versions) {
  return versions && typeof versions==='object' && !Array.isArray(versions) && Object.keys(versions).length===courses.length && courses.every(course=>Object.hasOwn(versions,course.id)&&versions[course.id]===course.version);
}

export function calendarFile(courses,today=localDate()) {
  const escape=value=>String(value).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//AMOT//Agenda de solicitações//PT-BR','CALSCALE:GREGORIAN'];
  const grouped=new Map();
  for(const row of agendaRows(courses,today))if(!row.app.requestedOn&&row.due&&row.due>=today)grouped.set(row.due,(grouped.get(row.due)||0)+1);
  for(const [day,count] of grouped) {
    lines.push('BEGIN:VEVENT',`UID:amot-agenda-${day}@amotinfiltracao.online`,`DTSTAMP:${today.replaceAll('-','')}T120000Z`,`DTSTART:${day.replaceAll('-','')}T110000Z`,`DTEND:${day.replaceAll('-','')}T111500Z`,`SUMMARY:${escape(`AMOT: ${count} solicitação(ões) para conferir`)}`,'DESCRIPTION:Consulte a agenda AMOT. Exporte novamente se as datas mudarem.','BEGIN:VALARM','TRIGGER:PT0M','ACTION:DISPLAY','DESCRIPTION:Conferir a agenda AMOT','END:VALARM','END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  const fold=line=>{let out='',size=0;for(const char of line){const bytes=new TextEncoder().encode(char).length;if(size+bytes>75){out+='\r\n ';size=1;}out+=char;size+=bytes;}return out;};
  return lines.map(fold).join('\r\n')+'\r\n';
}
