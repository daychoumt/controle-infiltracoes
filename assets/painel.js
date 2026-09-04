import {STAGES,CHECKS,ROLES,CONVENIOS,WORKFLOW_FIELD_LABELS,emptyChecks,pending,nextStage,canEdit,localDate,validateCaseFields,applicationLabel,jointLabel} from './domain.js';
import {$,node,fillOptions,closeDialogs,summary,displayDate} from './ui.js';
import {DemoStore,ApiStore} from './store.js';
import {config} from './config.js';
fillOptions();closeDialogs();
let store=new DemoStore(),records=[],reportRecords=[],cursor=null,filter='all',selected=null,epoch=0,busy=false,createId=null,loading=false;
const configured=Boolean(config.apiUrl && config.firebaseApiKey);
const status=$('#status'),detail=$('#case-dialog'),newDialog=$('#new-dialog'),newForm=$('#new-case');
function report(message) {status.textContent=message;}
function displayError(error) {
  if(error.status===401) {signOut();report('Sua sessão expirou. Entre novamente para consultar a equipe.');}
  else report(error.message || 'Não foi possível carregar os atendimentos.');
}
async function refresh(append=false) {
  if(loading) return; loading=true;
  const current=store,run=epoch; $('#refresh').disabled=true;$('#load-more').disabled=true;
  try {
    const data=await current.list(append ? cursor : '');if(run!==epoch) return;
    records=append ? [...new Map([...records,...data.items].map(r=>[r.id,r])).values()] : data.items;
    cursor=data.nextCursor;render();
  } catch(error) {if(run===epoch) displayError(error);}
  finally {loading=false;$('#refresh').disabled=false;$('#load-more').disabled=false;}
}
const normalize=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const stageLabel=stage=>STAGES.find(([key])=>key===stage)?.[1] || 'Situação não informada';
function render() {
  $('#metric-active').textContent=records.filter(r=>r.stage!=='concluido').length;
  $('#metric-pending').textContent=records.filter(r=>r.stage==='realizado').length;
  $('#metric-billing').textContent=records.filter(r=>r.stage==='faturamento').length;
  $('#metric-done').textContent=records.filter(r=>r.stage==='concluido').length;
  const filters=$('#stage-filters');filters.replaceChildren();
  for(const [key,label] of [['all','Todos'],...STAGES]) {
    const count=key==='all' ? records.length : records.filter(r=>r.stage===key).length;
    const button=node('button',label,'filter');button.type='button';button.setAttribute('aria-pressed',String(filter===key));button.append(node('small',count));
    button.addEventListener('click',()=>{filter=key;render(); const buttons=[...filters.children];buttons.find(b=>b.getAttribute('aria-pressed')==='true')?.focus();});filters.append(button);
  }
  const query=normalize($('#search').value.trim());
  const visible=records.filter(r=>(filter==='all'||r.stage===filter) && (!$('#only-pending').checked||r.stage==='realizado') && normalize([r.fields.paciente,r.fields.prontuario,r.fields.convenio,r.fields.articulacao,r.id].filter(Boolean).join(' ')).includes(query));
  const tbody=$('#cases');tbody.replaceChildren();
  for(const record of visible) {
    const tr=node('tr'),patient=node('td');patient.append(node('strong',record.fields.paciente),node('small',record.fields.prontuario ? `Prontuário ${record.fields.prontuario}` : record.id.startsWith('demo-')?record.id.toUpperCase():'AM-'+record.id.slice(0,8).toUpperCase()));
    const joint=node('td',jointLabel(record.fields));joint.append(node('small',record.fields.pedidoRacimed ? `Pedido ${record.fields.pedidoRacimed}` : 'Uma guia para esta articulação'));
    const date=node('td',applicationLabel(record.fields));date.append(node('small',`${displayDate(record.fields.data)} · ${record.fields.executor}`));
    const stage=node('td');stage.append(node('span',STAGES.find(([key])=>key===record.stage)[1],'pill '+record.stage));
    const progress=node('td'),bars=node('div',null,'check-progress');bars.setAttribute('aria-hidden','true');
    for(const checked of Object.values(record.checks)) bars.append(node('i',null,checked?'done':''));
    progress.append(bars,node('small',`${4-pending(record).length}/4 itens conferidos`));
    const action=node('td'),button=node('button','Abrir →','text-button');button.type='button';button.setAttribute('aria-label',`Abrir atendimento de ${record.fields.paciente}`);button.addEventListener('click',()=>openCase(record.id));action.append(button);
    tr.append(patient,joint,date,node('td',record.fields.convenio),stage,progress,action);tbody.append(tr);
  }
  $('#empty').hidden=visible.length>0;$('#result-count').textContent=`${visible.length} atendimento${visible.length===1?'':'s'}`;
  $('#load-more').hidden=!cursor;$('#abrir-novo').disabled=!['recepcao','admin'].includes(store.role);
  $('#list-note').textContent=store instanceof DemoStore ? 'Somente dados fictícios nesta demonstração.' : `${records.length} atendimentos carregados. Resumo e filtros consideram esta lista.${cursor?' Há mais registros disponíveis.':''}`;
}
async function openCase(id) {
  if(busy) return;const current=store,run=epoch;busy=true;
  try {
    const [record,patientSource]=await Promise.all([current.detail(id),allCases(current)]);if(run!==epoch) return;
    records=[...new Map([...patientSource,...records].map(item=>[item.id,item])).values()];selected=record;renderDetail();detail.showModal();
  }
  catch(error){if(run===epoch) displayError(error);}finally{busy=false;}
}
function renderDetail() {
  const record=selected;
  $('#case-title').textContent=record.fields.paciente;
  $('#case-protocol').textContent=`ATENDIMENTO ${record.id.startsWith('demo-')?record.id.toUpperCase():record.id.slice(0,8).toUpperCase()} · VERSÃO ${record.version}`;
  summary($('#case-summary'),record.fields,WORKFLOW_FIELD_LABELS);
  $('#case-steps').replaceChildren();
  const current=STAGES.findIndex(([key])=>key===record.stage);
  STAGES.forEach(([key,label],i)=>{const li=node('li',label,i===current?'current':i<current?'passed':'');if(i===current)li.setAttribute('aria-current','step');$('#case-steps').append(li);});
  const patientRecords=records.filter(item=>record.fields.prontuario && item.fields.prontuario===record.fields.prontuario).sort((a,b)=>a.fields.data.localeCompare(b.fields.data));
  const received=patientRecords.filter(item=>item.stage==='concluido').length;
  $('#patient-totals').textContent=`${patientRecords.length} guia${patientRecords.length===1?'':'s'} registrada${patientRecords.length===1?'':'s'} · ${received} recebida${received===1?'':'s'} pelo faturamento`;
  $('#patient-history').replaceChildren();
  for(const item of patientRecords) {
    const tr=node('tr');tr.append(node('td',jointLabel(item.fields)),node('td',item.fields.numeroAplicacao?`${item.fields.numeroAplicacao}ª de 3`:'—'),node('td',displayDate(item.fields.data)),node('td',stageLabel(item.stage)));$('#patient-history').append(tr);
  }
  const editable=canEdit(record,store.role),checks=$('#case-checks');checks.replaceChildren();
  for(const [key,label] of Object.entries(CHECKS)) {
    const item=node('label',null,'check-item'),input=node('input');input.type='checkbox';input.name=key;input.checked=record.checks[key];input.disabled=!editable;item.append(input,node('span',label));checks.append(item);
  }
  $('#save-checks').hidden=!editable;
  $('#check-help').textContent=record.stage==='concluido'?'Recebimento confirmado. Histórico disponível para consulta.':record.stage==='faturamento'?'O faturamento confirma o recebimento da documentação já conferida.':'Os quatro itens devem estar conferidos para encaminhar a guia ao faturamento.';
  const next=nextStage(record.stage),canAdvance=record.stage==='faturamento'?['admin','faturamento'].includes(store.role):editable;
  $('#advance').hidden=!next || !canAdvance;
  $('#advance').textContent=({agendado:'Confirmar agendamento',realizado:'Marcar como realizado',faturamento:'Enviar ao faturamento',concluido:'Confirmar recebimento'})[next] || 'Concluído';
  $('#case-message').textContent='';$('#case-history').replaceChildren();
  for(const event of [...record.events].reverse()) {
    const item=node('li',event.action),date=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(event.at));
    item.append(node('small',`${date} · ${ROLES[event.actor] || event.actor}`));$('#case-history').append(item);
  }
}
async function save(advance=false) {
  if(busy || !selected) return;busy=true;
  const current=store,run=epoch,previous=selected;
  const checks=Object.fromEntries([...$('#case-checks').querySelectorAll('input')].map(i=>[i.name,i.checked]));
  $('#save-checks').disabled=$('#advance').disabled=true;
  try {
    const updated=await current.update(previous.id,{version:previous.version,checks,stage:advance?nextStage(previous.stage):previous.stage});
    if(run!==epoch) return;
    selected=updated;records=records.map(r=>r.id===updated.id?updated:r);render();renderDetail();$('#case-message').textContent=advance?'Etapa atualizada e registrada no histórico.':'Conferência salva no histórico.';
  } catch(error) {
    if(run===epoch) {if(error.status===401)displayError(error);else $('#case-message').textContent=error.status===409?'Este atendimento mudou. Feche e reabra os detalhes para carregar a versão atual.':error.message || 'Não foi possível salvar. Reabra o atendimento para conferir antes de tentar novamente.';}
  } finally {busy=false;$('#save-checks').disabled=$('#advance').disabled=false;}
}
$('#case-form').addEventListener('submit',e=>{e.preventDefault();save();});$('#advance').addEventListener('click',()=>save(true));
detail.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
detail.querySelector('[data-close]').addEventListener('click',()=>{selected=null;});
$('#search').addEventListener('input',render);$('#only-pending').addEventListener('change',render);
$('#clear-filters').addEventListener('click',()=>{filter='all';$('#search').value='';$('#only-pending').checked=false;render();});
$('#refresh').addEventListener('click',()=>{report('');refresh();});$('#load-more').addEventListener('click',()=>refresh(true));
$('#role').addEventListener('change',()=>{store.role=$('#role').value;render();});
function resetDemo() {
  epoch++;store.clear?.();store=new DemoStore();records=[];reportRecords=[];cursor=null;filter='all';selected=null;busy=false;
  $('#patient-history').replaceChildren();$('#patient-totals').textContent='';$('#report-preview').replaceChildren();$('#print-sheet').replaceChildren();
  $('#role').value='recepcao';$('#search').value='';$('#only-pending').checked=false;$('#demo-controls').hidden=false;
  $('#mode-banner').replaceChildren(node('span','Demonstração interativa · Dados fictícios. As alterações ficam só nesta aba.'));
  const login=node('button','Acesso da equipe →','text-button');login.type='button';login.addEventListener('click',openLogin);$('#mode-banner').append(login);
  render(); loading=false;refresh();
}
function signOut() {document.querySelectorAll('dialog[open]').forEach(d=>d.close());newForm.reset();$('#login-form').reset();$('#case-summary').replaceChildren();$('#case-history').replaceChildren();$('#case-title').textContent='';$('#case-checks').replaceChildren();resetDemo();}
$('#reset-demo').addEventListener('click',()=>{resetDemo();report('Demonstração reiniciada com os exemplos originais.');});
newForm.elements.articulacao.addEventListener('change',()=>{
  const other=newForm.elements.articulacao.value==='Outra articulação';
  $('#outra-articulacao').hidden=!other;newForm.elements.articulacaoOutra.required=other;if(!other)newForm.elements.articulacaoOutra.value='';
});
$('#abrir-novo').addEventListener('click',()=>{
  newForm.reset();newForm.elements.data.value=localDate();newForm.elements.atendente.value=store instanceof DemoStore?'Equipe de demonstração':'';
  createId=crypto.randomUUID();$('#new-error').textContent='';$('#new-notice').textContent=store instanceof DemoStore?'Use dados fictícios. Este cadastro não envia informações à planilha ou à clínica.':'Este cadastro abre o acompanhamento no painel. O envio do formulário à planilha é uma operação separada.';newDialog.showModal();
});
newForm.addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;
  const current=store,run=epoch;busy=true;$('#create-case').disabled=true;
  try {
    const fields=validateCaseFields(Object.fromEntries(new FormData(newForm)));
    const record=await current.create({id:createId,fields});if(run!==epoch)return;
    records=[record,...records.filter(r=>r.id!==record.id)];render();newDialog.close();selected=record;renderDetail();detail.showModal();report('Atendimento aberto para acompanhamento.');
  } catch(error){if(run===epoch){if(error.status===401)displayError(error);else $('#new-error').textContent=error.message || 'Não foi possível confirmar o cadastro. Confira a fila antes de tentar novamente.';}}
  finally{busy=false;$('#create-case').disabled=false;}
});
async function allCases(source=store) {
  const items=[];let next='';let pages=0;
  do {
    const page=await source.list(next);items.push(...page.items);next=page.nextCursor || '';pages++;
    if(pages>100)throw new Error('O relatório ultrapassou o limite de segurança.');
  } while(next);
  return [...new Map(items.map(item=>[item.id,item])).values()];
}
function monthName(value) {
  const [year,month]=value.split('-');
  return new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date(Number(year),Number(month)-1,1));
}
function reportFilter(item,type) {
  if(type==='delivery')return ['faturamento','concluido'].includes(item.stage);
  if(type==='pending')return !['faturamento','concluido'].includes(item.stage);
  return true;
}
function reportTitle(type) {return {complete:'Movimento completo',delivery:'Relação de entrega ao faturamento',pending:'Pendências do mês'}[type];}
function buildReportGroup(insurer,items,month,type) {
  const section=node('section',null,'print-insurer');
  const header=node('header',null,'print-header'),brand=node('div');brand.append(node('strong','AMOT'),node('span','Gestão de infiltrações'));
  const title=node('div');title.append(node('h1',reportTitle(type)),node('p',`${monthName(month)} · ${insurer}`));header.append(brand,title);section.append(header);
  const meta=node('div',null,'print-meta');
  meta.append(node('span',`Convênio: ${insurer}`),node('span',`Referência: ${month.replace('-','')}-${normalize(insurer).replace(/[^a-z0-9]/g,'').slice(0,8).toUpperCase()}`),node('span',`Emitido em: ${new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date())}`));section.append(meta);
  const table=node('table',null,'print-table'),thead=node('thead'),head=node('tr');
  for(const label of ['Nº','Paciente','Prontuário','Médico','Articulação','Lado','Aplicação','Data','Situação'])head.append(node('th',label));thead.append(head);table.append(thead);
  const body=node('tbody');items.forEach((item,index)=>{const tr=node('tr');for(const value of [String(index+1).padStart(2,'0'),item.fields.paciente,item.fields.prontuario||'—',item.fields.executor,item.fields.articulacao||'—',item.fields.lado||'—',item.fields.numeroAplicacao?`${item.fields.numeroAplicacao}ª de 3`:'—',displayDate(item.fields.data),stageLabel(item.stage)])tr.append(node('td',value));body.append(tr);});table.append(body);section.append(table);
  const totals=node('div',null,'print-totals'),joints=new Map();for(const item of items)joints.set(item.fields.articulacao||'Não informada',(joints.get(item.fields.articulacao||'Não informada')||0)+1);
  totals.append(node('strong',`Total: ${items.length} guia${items.length===1?'':'s'}`),node('span',[...joints].map(([joint,count])=>`${joint}: ${count}`).join(' · ')));section.append(totals);
  if(type==='delivery') {
    const signatures=node('div',null,'print-signatures');for(const label of ['Entregue por','Recebido por / Faturamento','Data e horário','Assinatura']){const field=node('div');field.append(node('span',label));signatures.append(field);}section.append(signatures);
  }
  const footer=node('footer',`Documento de controle administrativo · Cada articulação corresponde a uma guia.`);section.append(footer);
  return section;
}
function renderReport() {
  const month=$('#report-month').value,type=$('#report-type').value,chosen=$('#report-insurer').value;
  const selected=reportRecords.filter(item=>item.fields.data?.startsWith(month) && reportFilter(item,type) && (chosen==='all'||item.fields.convenio===chosen));
  const groups=new Map();for(const item of selected){if(!groups.has(item.fields.convenio))groups.set(item.fields.convenio,[]);groups.get(item.fields.convenio).push(item);}
  const sheet=$('#print-sheet');sheet.replaceChildren();
  for(const [insurer,items] of [...groups].sort(([a],[b])=>a.localeCompare(b,'pt-BR')))sheet.append(buildReportGroup(insurer,items.sort((a,b)=>a.fields.paciente.localeCompare(b.fields.paciente,'pt-BR')),month,type));
  const preview=$('#report-preview');preview.replaceChildren();
  const description=node('div',null,'report-summary');description.append(node('strong',`${selected.length} guia${selected.length===1?'':'s'}`),node('span',`${groups.size} convênio${groups.size===1?'':'s'} · ${reportTitle(type)}`));preview.append(description);
  if(!selected.length)preview.append(node('p','Não há registros para esta combinação de mês, folha e convênio.','report-empty'));
  else for(const [insurer,items] of [...groups].sort(([a],[b])=>a.localeCompare(b,'pt-BR'))){const row=node('div',null,'report-group-row');row.append(node('strong',insurer),node('span',`${items.length} guia${items.length===1?'':'s'} · ${items.map(item=>jointLabel(item.fields)).join(', ')}`));preview.append(row);}
  $('#print-report').disabled=!selected.length;$('#report-message').textContent='';
}
async function openReports() {
  if(busy)return;busy=true;$('#abrir-relatorios').disabled=true;
  try {
    reportRecords=await allCases();
    const months=[...new Set(reportRecords.map(item=>item.fields.data?.slice(0,7)).filter(Boolean))].sort().reverse();
    $('#report-month').replaceChildren(...months.map(month=>new Option(monthName(month),month)));
    $('#report-insurer').replaceChildren(new Option('Todos, em folhas separadas','all'),...CONVENIOS.filter(insurer=>reportRecords.some(item=>item.fields.convenio===insurer)).map(insurer=>new Option(insurer,insurer)));
    renderReport();$('#reports-dialog').showModal();
  } catch(error){displayError(error);}finally{busy=false;$('#abrir-relatorios').disabled=false;}
}
$('#abrir-relatorios').addEventListener('click',openReports);
for(const id of ['#report-month','#report-type','#report-insurer'])$(id).addEventListener('change',renderReport);
$('#print-report').addEventListener('click',()=>{if(!$('#print-sheet').children.length)return;window.print();});
function openLogin() {
  $('#login-note').textContent=configured?'Entre com a conta autorizada da equipe. A sessão permanece somente nesta aba.':'O painel público está em modo demonstração. O acesso da equipe depende da configuração do backend e da liberação dos usuários.';
  $('#login-form').hidden=!configured;$('#login-error').textContent='';$('#login-dialog').showModal();
}
$('#entrar-equipe').addEventListener('click',openLogin);
$('#login-form').addEventListener('submit',async e=>{
  e.preventDefault();const run=++epoch;$('#login-button').disabled=true;
  const form=e.currentTarget;
  try {
    const response=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(config.firebaseApiKey)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:form.elements.email.value.trim(),password:form.elements.password.value,returnSecureToken:true}),signal:AbortSignal.timeout(12000)});
    form.elements.password.value='';
    if(!response.ok)throw new Error('Não foi possível entrar. Confira o e-mail e a senha da equipe.');
    const credentials=await response.json(),api=new ApiStore(config,credentials.idToken),user=await api.session();if(run!==epoch){api.clear();return;}
    store=api;records=[];cursor=null;selected=null;filter='all';$('#search').value='';$('#only-pending').checked=false;$('#demo-controls').hidden=true;
    $('#mode-banner').replaceChildren(node('span',`Painel da equipe · ${ROLES[user.role]}`));
    const logout=node('button','Sair da equipe','text-button');logout.type='button';logout.addEventListener('click',()=>{signOut();report('Sessão encerrada.');});$('#mode-banner').append(logout);
    $('#login-dialog').close();report('');render();loading=false;await refresh();
  }catch(error){if(run===epoch)$('#login-error').textContent=error.message || 'Não foi possível iniciar a sessão.';}
  finally{$('#login-button').disabled=false;form.elements.password.value='';}
});
refresh();
