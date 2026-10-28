import {localDate,addDays,ARTICULACOES,LADOS} from './domain.js';
import {agendaRows,applicationPlan,closingSummary,emptyApplications,siteKey,calendarFile} from './agenda-domain.js';
import {DemoAgendaStore,ApiAgendaStore} from './agenda-store.js';
import {SessionGuard} from './session.js?v=14';
import {config} from './config.js?v=14';

const $=selector=>document.querySelector(selector);
const element=(tag,content='',className='')=>{const item=document.createElement(tag);if(content)item.textContent=content;if(className)item.className=className;return item;};
const format=day=>day?new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',timeZone:'UTC'}).format(new Date(day+'T12:00:00Z')):'Ainda não informada';
const normal=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
// getRandomValues also supports browsers that do not expose randomUUID.
const newId=()=>{
  if(crypto.randomUUID)return crypto.randomUUID();
  const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=[...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
};
const configured=Boolean(config.apiUrl&&config.firebaseApiKey);
const publicDemo=!configured||new URLSearchParams(location.search).get('demo')==='1';
let store=new DemoAgendaStore(),courses=[],filter='today',selectedDay=localDate(),selectedCourse=null,selectedTask=null,registerId=null,registerSnapshot=null,closing=null,closingToday=null,view='agenda',epoch=0,busy=false,loading=false,closingRun=0;
const entryDrafts=new Map();
const guard=new SessionGuard(()=>signOut('Sua sessão foi bloqueada após 15 minutos sem uso. Entre novamente.'));
const isTeam=()=>store instanceof ApiAgendaStore;
const report=message=>{$('#message').textContent=message;};
const button=(label,action,className='button secondary')=>{const item=element('button',label,className);item.type='button';item.addEventListener('click',action);return item;};
const closeDialogs=()=>document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
for(const item of document.querySelectorAll('[data-close]'))item.addEventListener('click',()=>item.closest('dialog').close());

function errorMessage(error,target='#message') {
  if(error.status===401){signOut('Sua sessão expirou. Entre novamente.');return;}
  $(target).textContent=error.message || 'Não foi possível concluir. Confira a agenda antes de tentar novamente.';
}
async function reload() {
  if(loading)return;loading=true;const run=epoch,current=store;
  $('#refresh').disabled=true;
  try {
    const items=await current.listAll(),lastClosing=await current.closing(localDate());
    if(run!==epoch)return;
    courses=items;closingToday=lastClosing;render();
  }catch(error){if(run===epoch)errorMessage(error);}
  finally{if(run===epoch){loading=false;$('#refresh').disabled=false;}}
}
function matching(row,query){return normal(`${row.course.paciente} ${row.course.prontuario}`).includes(normal(query));}
function rowLabel(row){return `${row.site.joint} ${row.site.side.toLowerCase()} · ${row.app.number}ª de 3`;}
function hasChangedSinceClosing(value) {
  return value && (Object.keys(value.courseVersions).length!==courses.length || courses.some(course=>value.courseVersions[course.id]!==course.version));
}
function render() {
  const today=localDate(),allRows=agendaRows(courses,today,{includeArchived:true}),rows=allRows.filter(row=>!row.course.archived),weekEnd=addDays(today,7);
  $('#count-today').textContent=rows.filter(row=>row.status==='today').length;
  $('#count-overdue').textContent=rows.filter(row=>row.status==='overdue').length;
  $('#count-upcoming').textContent=rows.filter(row=>row.status==='upcoming'&&row.due<=weekEnd).length;
  $('#count-sent').textContent=allRows.filter(row=>row.app.requestedOn===today).length;
  $('#today-label').textContent=new Intl.DateTimeFormat('pt-BR',{dateStyle:'full',timeZone:'America/Sao_Paulo'}).format(new Date());
  for(const item of document.querySelectorAll('[data-filter]')){const active=item.dataset.filter===filter;item.classList.toggle('selected',active);item.setAttribute('aria-pressed',String(active));}
  const week=$('#week-days');week.replaceChildren();
  for(let i=0;i<7;i++) {
    const day=addDays(today,i),count=rows.filter(row=>!row.app.requestedOn&&row.due===day).length;
    const item=button('',()=>{selectedDay=day;filter='day';render();},'day'+(filter==='day'&&selectedDay===day||filter==='today'&&i===0?' active':''));
    item.setAttribute('aria-label',`${format(day)}, ${count} solicitações`);
    const weekDay=new Intl.DateTimeFormat('pt-BR',{weekday:'short',timeZone:'UTC'}).format(new Date(day+'T12:00:00Z')).replace('.','');
    item.append(element('span',i===0?'Hoje':weekDay),element('strong',day.slice(8)),element('small',`${count} ${count===1?'pedido':'pedidos'}`));week.append(item);
  }
  const title={today:'Solicitar hoje',overdue:'Pendências atrasadas',upcoming:'Próximos 7 dias',sent:'Solicitações enviadas hoje',day:`Solicitar em ${format(selectedDay)}`};
  $('#queue-title').textContent=title[filter];
  $('#include-overdue').closest('label').hidden=filter!=='today';
  const visible=(filter==='sent'?allRows:rows).filter(row=>{
    if(!matching(row,$('#search').value))return false;
    if(filter==='today')return row.status==='today'||($('#include-overdue').checked&&row.status==='overdue');
    if(filter==='upcoming')return row.status==='upcoming'&&row.due<=weekEnd;
    if(filter==='sent')return row.app.requestedOn===today;
    if(filter==='day')return !row.app.requestedOn&&row.due===selectedDay;
    return row.status==='overdue';
  });
  const list=$('#task-list');list.replaceChildren();
  for(const row of visible) {
    const task=element('article','','task'),patient=element('div'),joint=element('div'),dates=element('div','','task-date');
    const name=button(row.course.paciente,()=>openPatient(row.course.id),'patient-button');
    patient.append(name,element('small',`Prontuário ${row.course.prontuario} · ${row.course.convenio}`));
    joint.append(element('div',`${row.site.joint} ${row.site.side.toLowerCase()}`,'joint'),element('small',`${row.app.number}ª aplicação de 3`));
    const label=row.app.requestedOn?'Enviada':row.provisional?'Previsão':row.status==='overdue'?'Atrasada':'A solicitar';
    dates.append(element('span',`${label} · ${format(row.app.requestedOn || row.due)}`,'tag '+(row.provisional?'provisional':row.status)));
    dates.append(element('small',row.app.appliedOn?`Aplicada em ${format(row.app.appliedOn)}`:row.provisional?'Confirmar a aplicação anterior':'Aplicação ainda não registrada'));
    if(row.issues.length)dates.append(element('small',row.issues.join(' · '),'tag issue'));
    const action=button(row.app.requestedOn?'Ver registro':'Atualizar',()=>openTask(row));
    action.setAttribute('aria-label',`Atualizar ${row.course.paciente}, ${rowLabel(row)}`);
    task.append(patient,joint,dates,action);list.append(task);
  }
  $('#empty').hidden=visible.length>0;$('#empty-register').hidden=courses.length>0;
  $('#empty p').textContent=courses.length?'Você pode conferir as próximas datas ou abrir o histórico do paciente.':'Registre um atendimento ou experimente o exemplo para conhecer a agenda.';
  $('#list-count').textContent=`${visible.length} ${visible.length===1?'solicitação':'solicitações'}`;
  $('#closing-status').textContent=!closingToday?'Confira o que enviou, o que ficou pendente e o que precisa fazer amanhã.':hasChangedSinceClosing(closingToday)?'A agenda mudou depois da conferência. Reabra o fechamento para revisar.':`Dia conferido${closingToday.summary.pending?` com ${closingToday.summary.pending} pendência(s)`:' sem solicitações em atraso'}. Os registros continuam disponíveis.`;
  renderPatients();
}
function changeView(next) {
  view=next;$('#agenda-view').hidden=view!=='agenda';$('#patients-view').hidden=view!=='patients';
  $('#page-title').textContent=view==='agenda'?'Sua agenda, em dia.':'Cada paciente, por completo.';
  $('#page-description').textContent=view==='agenda'?'Veja o que solicitar e organize o restante no fim do expediente.':'Consulte os lados, as aplicações e o que já foi solicitado.';
  for(const [id,name] of [['#nav-agenda','agenda'],['#nav-patients','patients']])if(name===view)$(id).setAttribute('aria-current','page');else $(id).removeAttribute('aria-current');
}
function renderPatients() {
  const list=$('#patient-list');list.replaceChildren();const query=normal($('#patient-search').value);
  const visible=courses.filter(course=>(!course.archived||$('#show-archived').checked)&&normal(`${course.paciente} ${course.prontuario}`).includes(query)).sort((a,b)=>a.paciente.localeCompare(b.paciente,'pt-BR'));
  for(const course of visible) {
    const row=element('article','','patient-row'),description=element('div');
    const sent=course.sites.flatMap(site=>site.applications).filter(app=>app.requestedOn).length,total=course.sites.length*3;
    description.append(element('strong',course.paciente),element('small',`${course.prontuario} · ${course.convenio} · ${sent}/${total} solicitações enviadas${course.archived?' · Encerrado':''}`));
    row.append(description,button('Abrir paciente',()=>openPatient(course.id)));list.append(row);
  }
  if(!visible.length)list.append(element('p','Nenhum paciente nesta lista. Use “Registrar o dia” para começar.','empty'));
}
function openPatient(id) {
  const course=courses.find(item=>item.id===id);if(!course)return;selectedCourse=id;
  $('#patient-title').textContent=course.paciente;$('#patient-chart').textContent=`PRONTUÁRIO ${course.prontuario}`;
  $('#patient-subtitle').textContent=`${course.convenio} · Intervalo informado: ${course.intervalDays} dias entre aplicações do mesmo lado${course.archived?' · Acompanhamento encerrado':''}.`;
  const history=$('#patient-history');history.replaceChildren();
  for(const site of course.sites) {
    const section=element('section','','history-block');section.append(element('h3',`${site.joint} ${site.side.toLowerCase()}`));
    for(const app of site.applications) {
      const plan=applicationPlan(course,site,app),row=element('div','','history-app');
      const applied=element('span',`Aplicação: ${app.appliedOn?format(app.appliedOn):'não registrada'}`);
      const requested=element('span',app.requestedOn?`Enviada em ${format(app.requestedOn)}`:plan.due?`Solicitar em ${format(plan.due)}`:'Aguardando data da aplicação anterior');
      if(plan.provisional&&plan.due)requested.append(element('small','Previsão: confirmar a aplicação anterior'));
      if(app.guide)requested.append(element('small',`Guia ${app.guide}`));
      if(app.note)requested.append(element('small',app.note));
      if(plan.issues.length)requested.append(element('small',plan.issues.join(' · '),'tag issue'));
      row.append(element('strong',`${app.number}ª`),applied,requested,button('Editar',()=>{$('#patient-dialog').close();openTask({course,site,app,...plan});},'quiet'));
      section.append(row);
    }
    history.append(section);
  }
  $('#archive-patient').textContent=course.archived?'Reabrir acompanhamento':'Encerrar acompanhamento';
  $('#register-existing').hidden=course.archived;
  if(!$('#patient-dialog').open)$('#patient-dialog').showModal();
}

function openRegister(id='') {
  if(!publicDemo&&!isTeam()){openLogin();return;}
  if(busy)return;const form=$('#register-form');form.reset();entryDrafts.clear();registerSnapshot=null;registerId=newId();
  $('#register-error').textContent='';form.elements.visitDay.value=localDate();form.elements.visitDay.max=localDate();
  $('#register-notice').textContent=isTeam()?'Registre o atendimento e o que já enviou. Os dados serão salvos na agenda da equipe.':'Demonstração: use somente dados fictícios. Atualizar a página apaga estes testes.';
  const select=$('#register-patient');select.replaceChildren(new Option('＋ Novo paciente',''));
  for(const course of courses.filter(item=>!item.archived).sort((a,b)=>a.paciente.localeCompare(b.paciente,'pt-BR')))select.add(new Option(`${course.paciente} · ${course.prontuario}`,course.id));
  select.value=typeof id==='string'?id:'';selectRegisterPatient();$('#register-dialog').showModal();
}
function selectRegisterPatient() {
  const form=$('#register-form'),course=courses.find(item=>item.id===$('#register-patient').value);
  registerSnapshot=course?structuredClone(course):null;entryDrafts.clear();
  for(const key of ['prontuario','paciente','convenio']){form.elements[key].value=course?.[key] || (key==='convenio'?'Porto':'');form.elements[key].readOnly=Boolean(course);}
  form.elements.intervalDays.value=course?.intervalDays || 7;
  $('#patient-fields').hidden=Boolean(course);
  const next=course?Math.min(...course.sites.map(site=>site.applications.find(app=>!app.appliedOn)?.number || 3)):1;
  form.elements.application.value=String(next);
  const choices=$('#site-choices');choices.replaceChildren();
  const more=element('details','','other-sites'),moreSummary=element('summary','Outras articulações'),moreChoices=element('div','','site-choices');more.append(moreSummary,moreChoices);
  const joints=course?[...new Set(course.sites.map(site=>site.joint))]:ARTICULACOES.filter(joint=>joint!=='Outra articulação');
  for(const joint of joints)for(const side of LADOS) {
    if(course&&!course.sites.some(site=>site.joint===joint&&site.side===side))continue;
    const label=element('label'),input=element('input');input.type='checkbox';input.value=siteKey(joint,side);input.dataset.joint=joint;input.dataset.side=side;input.addEventListener('change',()=>renderEntries());
    label.append(input,document.createTextNode(`${joint} ${joint==='Mão'?side==='Direito'?'direita':'esquerda':side.toLowerCase()}`));
    (course||['Joelho','Ombro'].includes(joint)?choices:moreChoices).append(label);
  }
  if(moreChoices.children.length)choices.append(more);
  $('#site-entries').replaceChildren();
}
function captureEntries() {
  for(const row of $('#site-entries').children)entryDrafts.set(row.dataset.key,Object.fromEntries([...row.querySelectorAll('input,select')].map(input=>[input.dataset.field,input.value])));
}
function field(labelText,key,type='date',value='') {
  const label=element('label',labelText),input=element('input');input.type=type;input.dataset.field=key;input.value=value;if(type==='date')input.min='2000-01-01';if(type==='text'){input.maxLength=60;input.autocomplete='off';}label.append(input);return {label,input};
}
function renderEntries(reset=false) {
  if(!reset)captureEntries();else entryDrafts.clear();
  const form=$('#register-form'),number=Number(form.elements.application.value),day=form.elements.visitDay.value || localDate();
  const choices=[...$('#site-choices').querySelectorAll('input:checked')],entries=$('#site-entries');entries.replaceChildren();
  choices.forEach((choice,index)=>{
    const existing=registerSnapshot?.sites.find(site=>siteKey(site.joint,site.side)===choice.value)?.applications[number-1];
    const data=entryDrafts.get(choice.value) || {mode:existing?.requestedOn?'sent':'pending',requestedOn:existing?.requestedOn || day,reminderOn:existing?.reminderOn || (number===1?addDays(day,index===0?0:3):day),guide:existing?.guide || ''};
    const row=element('section','','site-entry');row.dataset.key=choice.value;row.append(element('h3',`${choice.dataset.joint} ${choice.dataset.side.toLowerCase()} · ${number}ª aplicação`));
    const grid=element('div','','grid'),statusLabel=element('label','Solicitação desta aplicação'),status=element('select');status.dataset.field='mode';status.add(new Option('Ainda preciso solicitar','pending'));status.add(new Option('Já enviei a solicitação','sent'));status.value=data.mode;statusLabel.append(status);
    const reminder=field('Quando precisa solicitar?','reminderOn','date',data.reminderOn),requested=field('Em qual dia enviou?','requestedOn','date',data.requestedOn),guide=field('Número da guia (opcional)','guide','text',data.guide);
    requested.input.max=localDate();
    const toggle=()=>{requested.label.hidden=status.value!=='sent';requested.input.required=status.value==='sent';reminder.label.hidden=status.value==='sent';reminder.input.required=status.value!=='sent';};
    status.addEventListener('change',toggle);toggle();grid.append(statusLabel,reminder.label,requested.label,guide.label);row.append(grid);
    if(index>0&&!existing)row.append(element('p','A data sugerida do lembrete pode ser ajustada. A aplicação real fica na data do atendimento.','helper'));
    entries.append(row);
  });
}

$('#register-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  const form=event.currentTarget,choices=[...$('#site-choices').querySelectorAll('input:checked')];
  if(!choices.length){$('#register-error').textContent='Marque as articulações e lados atendidos.';return;}
  captureEntries();const day=form.elements.visitDay.value,number=Number(form.elements.application.value);
  const input=registerSnapshot?structuredClone(registerSnapshot):{id:registerId,prontuario:form.elements.prontuario.value,paciente:form.elements.paciente.value,convenio:form.elements.convenio.value,archived:false,sites:[]};
  input.intervalDays=Number(form.elements.intervalDays.value);
  for(const choice of choices) {
    let site=input.sites.find(item=>siteKey(item.joint,item.side)===choice.value);
    if(!site){site={joint:choice.dataset.joint,side:choice.dataset.side,applications:emptyApplications()};input.sites.push(site);}
    const data=entryDrafts.get(choice.value),app=site.applications[number-1];
    app.appliedOn=day;app.requestedOn=data.mode==='sent'?data.requestedOn:'';app.reminderOn=data.reminderOn || day;app.guide=data.guide;
  }
  await saveCourse(input,!registerSnapshot,'#register-error',()=>{$('#register-dialog').close();report('Atendimento registrado. Confira as próximas solicitações na agenda.');});
});
async function saveCourse(input,create,target,onSuccess) {
  if(busy)return;busy=true;const current=store,run=epoch;
  for(const item of document.querySelectorAll('dialog[open] button'))item.disabled=true;
  try {
    const result=await current.save(input,create);if(run!==epoch)return;
    courses=courses.filter(course=>course.id!==result.id);courses.push(result);render();onSuccess?.();
  }catch(error){if(run===epoch)errorMessage(error,target);}
  finally{busy=false;for(const item of document.querySelectorAll('dialog button'))item.disabled=false;}
}

function openTask(row) {
  selectedTask={course:structuredClone(row.course),joint:row.site.joint,side:row.site.side,number:row.app.number};
  const form=$('#task-form'),plan=applicationPlan(row.course,row.site,row.app);form.reset();
  $('#task-patient').textContent=row.course.paciente;$('#task-title').textContent=rowLabel(row);
  $('#task-rule').textContent=plan.earliest?`Pela aplicação anterior registrada, o intervalo informado chega a ${format(plan.earliest)}. A data do lembrete pode ser posterior. Registre as datas reais de aplicação e envio em seus próprios campos.`:row.app.number>1?'A próxima data depende da realização anterior. Um lembrete preenchido agora será uma previsão até essa data ser registrada.':'A aplicação pode ser bilateral. A solicitação de cada lado tem seu próprio registro.';
  for(const key of ['appliedOn','requestedOn','guide','note'])form.elements[key].value=row.app[key] || '';
  form.elements.reminderOn.value=plan.due || '';form.elements.reminderOn.min=plan.earliest || '2000-01-01';
  form.elements.appliedOn.max=localDate();form.elements.requestedOn.max=localDate();$('#task-error').textContent='';$('#task-dialog').showModal();
}
$('#task-form').addEventListener('submit',async event=>{
  event.preventDefault();if(!selectedTask)return;const input=structuredClone(selectedTask.course),form=event.currentTarget;
  const app=input.sites.find(site=>site.joint===selectedTask.joint&&site.side===selectedTask.side).applications[selectedTask.number-1];
  for(const key of ['appliedOn','requestedOn','reminderOn','guide','note'])app[key]=form.elements[key].value;
  await saveCourse(input,false,'#task-error',()=>{$('#task-dialog').close();report('Atualização salva. As datas seguintes foram recalculadas conforme as aplicações registradas.');});
});

async function openClosing() {
  if(!publicDemo&&!isTeam()){openLogin();return;}
  const form=$('#closing-form');form.reset();form.elements.day.value=localDate();form.elements.day.max=localDate();$('#closing-error').textContent='';
  $('#closing-dialog').showModal();await renderClosing();
}
async function renderClosing() {
  const day=$('#closing-day').value;if(!day)return;const run=++closingRun,current=store,session=epoch;
  const submit=$('#closing-form button[type=submit]');submit.disabled=true;$('#closing-summary').replaceChildren();$('#closing-details').replaceChildren();closing=null;
  try {
    const all=await current.listAll(),existing=await current.closing(day);
    if(run!==closingRun||session!==epoch)return;
    courses=all;closing=existing;const summary=closingSummary(courses,day),items=agendaRows(courses,day,{includeArchived:true});
    const counts=$('#closing-summary');
    for(const [key,label] of [['applied','Aplicações registradas'],['requested','Solicitações enviadas'],['pending','Solicitações pendentes']]) {
      const block=element('div','','summary-item');block.append(element('strong',String(summary[key])),element('span',label));counts.append(block);
    }
    const details=$('#closing-details');
    if(existing)details.append(element('p',hasChangedSinceClosing(existing)?'A agenda foi alterada após o último fechamento. Confira novamente.':'Este dia já foi conferido. Você pode registrar uma nova conferência.','notice'));
    const groups=[['Enviadas neste dia',items.filter(row=>row.app.requestedOn===day)],['Ficaram pendentes',items.filter(row=>!row.course.archived&&!row.app.requestedOn&&row.due&&row.due<=day)],['Próximo dia',items.filter(row=>!row.course.archived&&!row.app.requestedOn&&row.due===addDays(day,1))],['Datas para conferir',items.filter(row=>!row.course.archived&&row.issues.length)]];
    for(const [title,rows] of groups) {
      const section=element('section','','closing-group');section.append(element('h3',`${title} · ${rows.length}`));
      if(!rows.length)section.append(element('p','Nenhum registro nesta lista.','helper'));
      for(const row of rows) {
        const line=element('div','','review-line'),copy=element('div',row.course.paciente);copy.append(element('small',rowLabel(row)+(row.issues.length?' · '+row.issues.join('; '):'')));
        line.append(copy,button('Conferir',()=>{$('#closing-dialog').close();openTask(row);},'quiet'));section.append(line);
      }
      details.append(section);
    }
    render();submit.disabled=false;
  }catch(error){if(run===closingRun&&session===epoch)errorMessage(error,'#closing-error');}
}
$('#closing-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;busy=true;const current=store,run=epoch,form=event.currentTarget,submit=form.querySelector('[type=submit]');submit.disabled=true;
  try {
    const result=await current.close({day:form.elements.day.value,confirmed:form.elements.confirmed.checked,version:closing?.version || 0,courseVersions:Object.fromEntries(courses.map(course=>[course.id,course.version]))});
    if(run!==epoch)return;
    if(result.day===localDate())closingToday=result;
    $('#closing-dialog').close();render();report(`Dia ${format(result.day)} conferido. ${result.summary.requested} solicitação(ões) enviada(s), ${result.summary.pending} pendente(s). As pendências continuam na agenda.`);
  }catch(error){if(run===epoch)errorMessage(error,'#closing-error');}
  finally{busy=false;submit.disabled=false;}
});

function openLogin() {
  $('#login-note').textContent=configured?'Entre com sua conta individual da equipe. A sessão é bloqueada após 15 minutos sem uso.':'A agenda está disponível para testar. Para guardar os dados reais, falta conectar o banco e configurar o acesso da equipe no projeto.';
  $('#login-form').hidden=!configured;$('#login-error').textContent='';$('#login-dialog [data-close]').hidden=configured&&!publicDemo&&!isTeam();if(!$('#login-dialog').open)$('#login-dialog').showModal();
}
function signOut(message='') {
  epoch++;loading=false;guard.stop();store.clear?.();store=new DemoAgendaStore();courses=[];closingToday=null;closing=null;selectedTask=null;selectedCourse=null;registerSnapshot=null;entryDrafts.clear();closeDialogs();
  for(const form of document.querySelectorAll('form'))form.reset();
  for(const id of ['#task-list','#patient-list','#patient-history','#site-entries','#closing-details','#closing-summary'])$(id).replaceChildren();
  for(const id of ['#patient-title','#patient-chart','#patient-subtitle','#task-patient','#task-rule'])$(id).textContent='';
  $('#register-patient').replaceChildren(new Option('＋ Novo paciente',''));
  $('#mode').classList.remove('live');$('#mode span').textContent=publicDemo?'Demonstração · Use dados fictícios. Os testes são apagados ao atualizar.':'Acesso protegido · Entre com sua conta da equipe.';
  $('#example').hidden=!publicDemo;$('#access').textContent='Acesso da equipe';$('#search').value='';$('#patient-search').value='';filter='today';changeView('agenda');render();
  if(!publicDemo)openLogin();if(message)report(message);
}
$('#login-form').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget,run=++epoch,submit=form.querySelector('[type=submit]');submit.disabled=true;let api;
  try {
    const response=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(config.firebaseApiKey)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:form.elements.email.value.trim(),password:form.elements.password.value,returnSecureToken:true}),signal:AbortSignal.timeout(12000)});
    form.elements.password.value='';if(!response.ok)throw new Error('Confira o e-mail e a senha da equipe.');
    const credentials=await response.json();api=new ApiAgendaStore(config,credentials);await api.session();if(run!==epoch){api.clear();return;}
    const all=await api.listAll();if(run!==epoch){api.clear();return;}
    store.clear?.();store=api;courses=all;closingToday=null;$('#mode').classList.add('live');$('#mode span').textContent='Agenda da equipe · Dados salvos na base protegida.';
    $('#example').hidden=true;$('#access').textContent='Sair da equipe';$('#login-dialog').close();guard.start();report('');render();await reload();
  }catch(error){api?.clear();if(run===epoch)errorMessage(error,'#login-error');}
  finally{submit.disabled=false;form.elements.password.value='';}
});

let notifiedMorning='',notifiedClosing='';
function notificationPreference(value) {try{if(value!==undefined)localStorage.setItem('amot-agenda-notifications',value);return localStorage.getItem('amot-agenda-notifications')==='enabled';}catch{return false;}}
function notificationStatus() {
  $('#notification-status').textContent=!('Notification' in window)?'Este navegador não oferece notificações. Você pode usar os lembretes do calendário.':Notification.permission==='denied'?'Os avisos estão bloqueados nas configurações deste navegador.':Notification.permission==='granted'&&notificationPreference()?'Avisos ativos: solicitações a partir das 08h e fechamento a partir das 16h45, com a agenda aberta e a equipe conectada.':'Você pode permitir os avisos neste navegador.';
}
function tick() {
  if(!isTeam()||!notificationPreference()||!('Notification' in window)||Notification.permission!=='granted')return;
  const today=localDate(),time=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'America/Sao_Paulo'}).format(new Date());
  const rows=agendaRows(courses,today),count=rows.filter(row=>['overdue','today'].includes(row.status)).length;
  if(time>='08:00'&&time<'16:45'&&count&&notifiedMorning!==today){new Notification('Agenda AMOT',{body:`Há ${count} solicitação(ões) para conferir na agenda.`,tag:'amot-agenda-morning'});notifiedMorning=today;}
  if(time>='16:45'&&(!closingToday||hasChangedSinceClosing(closingToday))&&notifiedClosing!==today){new Notification('Fechamento AMOT',{body:'Confira os envios e as pendências antes de encerrar o expediente.',tag:'amot-agenda-closing'});notifiedClosing=today;}
}
$('#enable-notifications').addEventListener('click',async()=>{
  if('Notification' in window){const permission=await Notification.requestPermission();notificationPreference(permission==='granted'?'enabled':'disabled');}
  notificationStatus();tick();
});
$('#export-calendar').addEventListener('click',()=>{
  const available=agendaRows(courses).some(row=>!row.app.requestedOn&&row.due&&row.due>=localDate());
  if(!available){$('#notification-status').textContent='Ainda não há próximas solicitações com uma data definida para exportar.';return;}
  const url=URL.createObjectURL(new Blob([calendarFile(courses)],{type:'text/calendar;charset=utf-8'})),link=element('a');link.href=url;link.download=`amot-lembretes-${localDate()}.ics`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});

$('#example').addEventListener('click',async()=>{
  if(isTeam())return;const today=localDate(),days=[0,3],sites=LADOS.map((side,index)=>({joint:'Joelho',side,applications:emptyApplications().map((app,i)=>i===0?{...app,appliedOn:today,reminderOn:addDays(today,days[index]),requestedOn:index===0?today:''}:app)}));
  const existing=courses.find(course=>course.prontuario==='EXEMPLO-001');
  if(existing){openPatient(existing.id);return;}
  await saveCourse({id:newId(),prontuario:'EXEMPLO-001',paciente:'Ronaldo (exemplo fictício)',convenio:'Porto · exemplo',intervalDays:7,archived:false,sites},true,'#message',()=>{filter='upcoming';changeView('agenda');render();report('Exemplo carregado: os dois joelhos foram aplicados hoje. O direito já foi solicitado e o lembrete do esquerdo ficou para três dias depois.');});
});

for(const id of ['#open-register','#empty-register'])$(id).addEventListener('click',()=>openRegister());
for(const id of ['#open-closing','#bottom-closing'])$(id).addEventListener('click',openClosing);
$('#register-patient').addEventListener('change',selectRegisterPatient);
$('#register-form').elements.application.addEventListener('change',()=>renderEntries(true));
$('#closing-day').addEventListener('change',()=>{$('#closing-form').elements.confirmed.checked=false;renderClosing();});
$('#mark-sent').addEventListener('click',()=>{$('#task-form').elements.requestedOn.value=localDate();});
$('#register-existing').addEventListener('click',()=>{$('#patient-dialog').close();openRegister(selectedCourse);});
$('#archive-patient').addEventListener('click',async()=>{
  const course=courses.find(item=>item.id===selectedCourse);if(!course)return;
  await saveCourse({...course,archived:!course.archived},false,'#message',()=>{$('#patient-dialog').close();report(course.archived?'Acompanhamento reaberto.':'Acompanhamento encerrado. O histórico continua em Pacientes → Mostrar encerrados.');});
});
$('#nav-agenda').addEventListener('click',()=>changeView('agenda'));$('#nav-patients').addEventListener('click',()=>changeView('patients'));
for(const item of document.querySelectorAll('[data-filter]'))item.addEventListener('click',()=>{filter=item.dataset.filter;render();});
for(const id of ['#search','#patient-search'])$(id).addEventListener('input',render);
for(const id of ['#include-overdue','#show-archived'])$(id).addEventListener('change',render);
$('#refresh').addEventListener('click',reload);$('#access').addEventListener('click',()=>isTeam()?signOut():openLogin());
$('#open-reminders').addEventListener('click',()=>{notificationStatus();$('#reminders-dialog').showModal();});
for(const name of ['pointerdown','keydown','touchstart'])document.addEventListener(name,()=>{if(isTeam())guard.touch();},{passive:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&isTeam()){guard.check();tick();}});
$('#login-dialog').addEventListener('cancel',event=>{if(configured&&!publicDemo&&!isTeam())event.preventDefault();});
setInterval(()=>{tick();if(!document.hidden&&!document.querySelector('dialog[open]')){render();if(isTeam())reload();}},60000);
if(configured&&!publicDemo){$('#example').hidden=true;$('#mode span').textContent='Acesso protegido · Entre com sua conta da equipe.';openLogin();}
render();
