import {STAGES,CHECKS,ROLES,WORKFLOW_FIELD_LABELS,emptyChecks,pending,nextStage,canEdit,localDate,applicationLabel,jointLabel,processLabel} from './domain.js?v=7';
import {$,node,fillOptions,closeDialogs,summary,displayDate} from './ui.js?v=7';
import {DemoStore,ApiStore} from './store.js?v=7';
import {config} from './config.js?v=7';
fillOptions();closeDialogs();
let store=new DemoStore(),records=[],reportRecords=[],cursor=null,filter='all',selected=null,epoch=0,busy=false,createId=null,loading=false;
const configured=Boolean(config.apiUrl && config.firebaseApiKey);
const status=$('#status'),detail=$('#case-dialog'),newDialog=$('#new-dialog'),newForm=$('#new-case');
const profileDialog=$('#profile-dialog'),profileForm=$('#profile-form'),processDialog=$('#process-dialog'),processForm=$('#process-form'),cancelDialog=$('#cancel-dialog'),cancelForm=$('#cancel-form');
const editProfileButton=node('button','Editar perfil','text-button');editProfileButton.type='button';$('.patient-overview>div:first-child').append(editProfileButton);
const editCaseButton=node('button','Corrigir dados desta infiltração','button secondary');editCaseButton.type='button';$('#advance').before(editCaseButton);
const cancelCaseButton=node('button','Cancelar esta infiltração','button secondary danger-outline');cancelCaseButton.type='button';$('#advance').before(cancelCaseButton);
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
const applicationDate=fields=>fields.dataAplicacao || fields.data || '';
const requestDate=fields=>fields.dataPedido || '';
const billingDate=fields=>fields.dataFaturamento || '';
const STALE_DAYS=3;
const staleDays=record=>['faturamento','cancelado'].includes(record.stage)?0:Math.max(0,Math.floor((Date.now()-new Date(record.updatedAt).getTime())/86400000));
const isStale=record=>staleDays(record)>=STALE_DAYS;
const stageHints={all:'Visão geral',pendencia:'Corrigir antes de seguir',sem_atualizacao:'Precisam de acompanhamento',recebido:'Cadastrar e conferir',solicitado:'Aguardar operadora',agendado:'Guia liberada',realizado:'Recolher a guia',conferencia:'Tudo conferido',faturamento:'Entrega registrada',cancelado:'Processo encerrado'};
function render() {
  const filters=$('#stage-filters');filters.replaceChildren();
  const groups=[
    ['Visão rápida','O que exige atenção agora',[['all','Todas'],['pendencia','Com pendência'],['sem_atualizacao',`Paradas ${STALE_DAYS}+ dias`]]],
    ['Autorizações','Do recebimento até a liberação',STAGES.slice(0,3)],
    ['Pós-procedimento e faturamento','Da realização até a entrega final',STAGES.slice(3)]
  ];
  for(const [title,hint,items] of groups) {
    const group=node('section',null,'filter-group'),heading=node('div',null,'filter-group-heading'),grid=node('div',null,'filter-grid');
    heading.append(node('h3',title),node('p',hint));group.append(heading,grid);
    for(const [key,label] of items) {
      const count=key==='all' ? records.length : key==='pendencia' ? records.filter(r=>r.fields.pendencia).length : key==='sem_atualizacao' ? records.filter(isStale).length : records.filter(r=>r.stage===key).length;
      const button=node('button',null,`filter status-${key}`);button.type='button';button.setAttribute('aria-pressed',String(filter===key));button.append(node('span',label),node('strong',count),node('small',stageHints[key]));
      button.addEventListener('click',()=>{filter=key;render();filters.querySelector('[aria-pressed="true"]')?.focus();});grid.append(button);
    }
    filters.append(group);
  }
  const query=normalize($('#search').value.trim());
  const visible=records.filter(r=>(filter==='all'||(filter==='pendencia'?r.fields.pendencia:filter==='sem_atualizacao'?isStale(r):r.stage===filter)) && (!$('#only-pending').checked||['realizado','conferencia'].includes(r.stage)) && normalize([r.fields.paciente,r.fields.prontuario,r.fields.numeroGuia,r.fields.convenio,r.fields.articulacao,processLabel(r.fields),r.fields.observacao,r.id].filter(Boolean).join(' ')).includes(query));
  const tbody=$('#cases');tbody.replaceChildren();
  for(const record of visible) {
    const tr=node('tr'),patient=node('td');patient.append(node('strong',record.fields.paciente),node('small',record.fields.prontuario ? `Prontuário ${record.fields.prontuario}` : record.id.startsWith('demo-')?record.id.toUpperCase():'AM-'+record.id.slice(0,8).toUpperCase()));
    const joint=node('td',jointLabel(record.fields));joint.append(node('small',record.fields.pedidoRacimed ? `Pedido ${record.fields.pedidoRacimed}` : 'Uma guia para esta articulação'));
    const guide=node('td');guide.append(node('strong',record.fields.numeroGuia || 'Número ainda não informado'),node('small',`${applicationLabel(record.fields)} · Pedido ${requestDate(record.fields)?displayDate(requestDate(record.fields)):'sem data'}`),node('small',applicationDate(record.fields)?`Realizada em ${displayDate(applicationDate(record.fields))}`:'Realização ainda não informada'));
    const stage=node('td');stage.append(node('span',stageLabel(record.stage),'pill '+record.stage));if(record.fields.pendencia)stage.append(node('small',`⚠ ${processLabel(record.fields)}`,'pending-note'));if(isStale(record))stage.append(node('small',`Sem atualização há ${staleDays(record)} dias`,'stale-note'));
    const progress=node('td'),bars=node('div',null,'check-progress');bars.setAttribute('aria-hidden','true');
    for(const checked of Object.values(record.checks)) bars.append(node('i',null,checked?'done':''));
    progress.append(bars,node('small',`${4-pending(record).length}/4 itens conferidos`));
    const action=node('td'),button=node('button','Abrir guia →','text-button');button.type='button';button.setAttribute('aria-label',`Abrir guia de ${record.fields.paciente}`);button.addEventListener('click',()=>openCase(record.id));action.append(button);
    tr.className=`stage-row ${record.stage}${record.fields.pendencia?' has-pending':''}${isStale(record)?' is-stale':''}`;tr.append(patient,joint,guide,node('td',record.fields.convenio),stage,progress,action);tbody.append(tr);
  }
  $('#empty').hidden=visible.length>0;$('#result-count').textContent=`${visible.length} guia${visible.length===1?'':'s'}`;
  $('#load-more').hidden=!cursor;$('#abrir-novo').disabled=!['recepcao','admin'].includes(store.role);
  $('#list-note').textContent=store instanceof DemoStore ? 'Somente dados fictícios nesta demonstração.' : `${records.length} guias carregadas.${cursor?' Há mais registros disponíveis.':''}`;
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
  $('#case-protocol').textContent=`GUIA ${record.id.startsWith('demo-')?record.id.toUpperCase():record.id.slice(0,8).toUpperCase()} · VERSÃO ${record.version}`;
  $('#case-guide-number').textContent=record.fields.numeroGuia || 'Ainda não informado';
  $('#case-status').textContent=stageLabel(record.stage);$('#case-status').className=`pill ${record.stage}`;
  $('#case-guide').value=record.fields.numeroGuia || '';$('#case-date').value=applicationDate(record.fields);$('#case-condition').value=record.fields.condicaoProcesso || (record.fields.pendencia?'outro':'regular');$('#case-observation').value=record.fields.observacao || '';
  summary($('#case-summary'),record.fields,WORKFLOW_FIELD_LABELS);
  $('#case-steps').replaceChildren();
  const current=STAGES.findIndex(([key])=>key===record.stage);
  STAGES.forEach(([key,label],i)=>{const state=i===current?'current':record.stage!=='cancelado'&&i<current?'passed':'';const li=node('li',label,state);if(i===current)li.setAttribute('aria-current','step');$('#case-steps').append(li);});
  const patientRecords=records.filter(item=>record.fields.prontuario && item.fields.prontuario===record.fields.prontuario).sort((a,b)=>(applicationDate(a.fields)||'9999').localeCompare(applicationDate(b.fields)||'9999'));
  const received=patientRecords.filter(item=>item.stage==='faturamento').length,cancelled=patientRecords.filter(item=>item.stage==='cancelado').length;
  $('#patient-totals').textContent=`${patientRecords.length} processo${patientRecords.length===1?'':'s'} · ${received} entregue${received===1?'':'s'} ao faturamento${cancelled?` · ${cancelled} cancelado${cancelled===1?'':'s'}`:''}`;
  $('#patient-history').replaceChildren();
  for(const item of patientRecords) {
    const tr=node('tr'),statusCell=node('td'),open=node('button',item.id===record.id?'Processo aberto':'Abrir processo','text-button');
    open.type='button';open.disabled=item.id===record.id;open.addEventListener('click',()=>{selected=item;renderDetail();});
    statusCell.append(node('span',stageLabel(item.stage),'pill '+item.stage),open);
    tr.append(node('td',jointLabel(item.fields)),node('td',item.fields.numeroAplicacao?`${item.fields.numeroAplicacao}ª de 3`:'—'),node('td',item.fields.numeroGuia||'—'),node('td',applicationDate(item.fields)?displayDate(applicationDate(item.fields)):'—'),statusCell);$('#patient-history').append(tr);
  }
  const editable=canEdit(record,store.role),checks=$('#case-checks');checks.replaceChildren();
  for(const [key,label] of Object.entries(CHECKS)) {
    const item=node('label',null,'check-item'),input=node('input');input.type='checkbox';input.name=key;input.checked=record.checks[key];input.disabled=!editable;item.append(input,node('span',label));checks.append(item);
  }
  $('#save-checks').hidden=!editable;
  editProfileButton.hidden=!['recepcao','admin'].includes(store.role);
  editCaseButton.hidden=!editable;
  cancelCaseButton.hidden=!editable;
  $('#case-guide').disabled=$('#case-date').disabled=$('#case-condition').disabled=$('#case-observation').disabled=!editable;
  $('#check-help').textContent=record.stage==='faturamento'?'Entrega registrada. A guia permanece disponível para consulta e impressão.':'Marque somente o que já foi conferido pelo setor.';
  const next=nextStage(record.stage);
  $('#advance').hidden=!next || !editable;
  $('#advance').textContent=({solicitado:'Solicitação enviada',agendado:'Registrar autorização',realizado:'Marcar como realizado',conferencia:'Deixar pronto para faturamento',faturamento:'Registrar entrega ao faturamento'})[next] || 'Avançar etapa';
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
  const fields={numeroGuia:$('#case-guide').value,dataAplicacao:$('#case-date').value,condicaoProcesso:$('#case-condition').value,observacao:$('#case-observation').value};
  $('#save-checks').disabled=$('#advance').disabled=true;
  try {
    const updated=await current.update(previous.id,{version:previous.version,fields,checks,stage:advance?nextStage(previous.stage):previous.stage});
    if(run!==epoch) return;
    selected=updated;records=records.map(r=>r.id===updated.id?updated:r);render();renderDetail();$('#case-message').textContent=advance?'Situação atualizada automaticamente no histórico.':'Alterações salvas no histórico.';
  } catch(error) {
    if(run===epoch) {if(error.status===401)displayError(error);else $('#case-message').textContent=error.status===409?'Este atendimento mudou. Feche e reabra os detalhes para carregar a versão atual.':error.message || 'Não foi possível salvar. Reabra o atendimento para conferir antes de tentar novamente.';}
  } finally {busy=false;$('#save-checks').disabled=$('#advance').disabled=false;}
}
$('#case-form').addEventListener('submit',e=>{e.preventDefault();save();});$('#advance').addEventListener('click',()=>save(true));
editProfileButton.addEventListener('click',()=>{
  if(!selected)return;
  profileForm.elements.prontuario.value=selected.fields.prontuario;
  profileForm.elements.paciente.value=selected.fields.paciente;
  profileForm.elements.convenio.value=selected.fields.convenio;
  $('#profile-error').textContent='';profileDialog.showModal();
});
profileForm.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!selected)return;busy=true;$('#save-profile').disabled=true;$('#profile-error').textContent='';
  const chart=selected.fields.prontuario,current=store,run=epoch;
  try {
    const {patient}=await current.updatePatient(chart,{paciente:profileForm.elements.paciente.value,convenio:profileForm.elements.convenio.value});
    if(run!==epoch)return;
    records=records.map(record=>record.fields.prontuario===chart?{...record,fields:{...record.fields,paciente:patient.paciente,convenio:patient.convenio}}:record);
    selected=records.find(record=>record.id===selected.id) || selected;profileDialog.close();render();renderDetail();report('Perfil do paciente corrigido em todas as guias.');
  } catch(error){if(run===epoch)$('#profile-error').textContent=error.message || 'Não foi possível corrigir o perfil.';}
  finally{busy=false;$('#save-profile').disabled=false;}
});
function toggleProcessJoint() {
  const other=processForm.elements.articulacao.value==='Outra articulação';
  $('#process-other-joint').hidden=!other;processForm.elements.articulacaoOutra.required=other;if(!other)processForm.elements.articulacaoOutra.value='';
}
processForm.elements.articulacao.addEventListener('change',toggleProcessJoint);
editCaseButton.addEventListener('click',()=>{
  if(!selected)return;processForm.reset();
  const fields=selected.fields,isListed=[...processForm.elements.articulacao.options].some(option=>option.value===fields.articulacao);
  processForm.elements.pedidoRacimed.value=fields.pedidoRacimed || '';processForm.elements.dataPedido.value=requestDate(fields);
  processForm.elements.articulacao.value=isListed?fields.articulacao:'Outra articulação';processForm.elements.articulacaoOutra.value=isListed?'':fields.articulacao;
  processForm.elements.lado.value=fields.lado;processForm.elements.numeroAplicacao.value=fields.numeroAplicacao;processForm.elements.medicacao.value=fields.medicacao || '';processForm.elements.executor.value=fields.executor;
  toggleProcessJoint();if(!isListed)processForm.elements.articulacaoOutra.value=fields.articulacao;
  $('#process-error').textContent='';processDialog.showModal();
});
processForm.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!selected)return;busy=true;$('#save-process').disabled=true;$('#process-error').textContent='';
  const previous=selected,current=store,run=epoch,fields=Object.fromEntries(new FormData(processForm));
  try {
    const updated=await current.update(previous.id,{version:previous.version,stage:previous.stage,checks:previous.checks,fields});
    if(run!==epoch)return;
    selected=updated;records=records.map(record=>record.id===updated.id?updated:record);processDialog.close();render();renderDetail();report('Dados corrigidos somente nesta infiltração.');
  } catch(error){if(run===epoch)$('#process-error').textContent=error.message || 'Não foi possível corrigir este processo.';}
  finally{busy=false;$('#save-process').disabled=false;}
});
cancelCaseButton.addEventListener('click',()=>{
  if(!selected)return;
  cancelForm.reset();$('#cancel-error').textContent='';$('#cancel-process').textContent=`${jointLabel(selected.fields)} · ${applicationLabel(selected.fields)}. Somente este processo será cancelado.`;cancelDialog.showModal();
});
cancelForm.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!selected)return;busy=true;$('#confirm-cancel').disabled=true;$('#cancel-error').textContent='';
  const previous=selected,current=store,run=epoch;
  try {
    const updated=await current.update(previous.id,{version:previous.version,stage:'cancelado',checks:previous.checks,fields:{numeroGuia:$('#case-guide').value,dataAplicacao:$('#case-date').value,condicaoProcesso:'cancelado',observacao:cancelForm.elements.motivo.value}});
    if(run!==epoch)return;
    selected=updated;records=records.map(record=>record.id===updated.id?updated:record);cancelDialog.close();render();renderDetail();report('Somente a infiltração selecionada foi cancelada. As demais continuam ativas.');
  } catch(error){if(run===epoch)$('#cancel-error').textContent=error.message || 'Não foi possível cancelar este processo.';}
  finally{busy=false;$('#confirm-cancel').disabled=false;}
});
detail.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
detail.querySelector('[data-close]').addEventListener('click',()=>{selected=null;});
$('#search').addEventListener('input',render);$('#only-pending').addEventListener('change',render);
$('#clear-filters').addEventListener('click',()=>{filter='all';$('#search').value='';$('#only-pending').checked=false;render();});
$('#refresh').addEventListener('click',()=>{report('');refresh();});$('#load-more').addEventListener('click',()=>refresh(true));
function resetDemo() {
  epoch++;store.clear?.();store=new DemoStore();records=[];reportRecords=[];cursor=null;filter='all';selected=null;busy=false;
  fillOptions(document,null,true);
  $('#patient-history').replaceChildren();$('#patient-totals').textContent='';$('#report-preview').replaceChildren();$('#print-sheet').replaceChildren();
  $('#search').value='';$('#only-pending').checked=false;$('#demo-controls').hidden=false;
  $('#mode-banner').replaceChildren(node('span','Demonstração interativa · Dados fictícios. As alterações ficam só nesta aba.'));
  const login=node('button','Acesso do setor →','text-button');login.type='button';login.addEventListener('click',openLogin);$('#mode-banner').append(login);
  render(); loading=false;refresh();
}
function signOut() {document.querySelectorAll('dialog[open]').forEach(d=>d.close());newForm.reset();$('#login-form').reset();$('#case-summary').replaceChildren();$('#case-history').replaceChildren();$('#case-title').textContent='';$('#case-checks').replaceChildren();resetDemo();}
$('#reset-demo').addEventListener('click',()=>{resetDemo();report('Demonstração reiniciada com os exemplos originais.');});
newForm.elements.articulacao.addEventListener('change',()=>{
  const other=newForm.elements.articulacao.value==='Outra articulação';
  $('#outra-articulacao').hidden=!other;newForm.elements.articulacaoOutra.required=other;if(!other)newForm.elements.articulacaoOutra.value='';
});
function openNewCase() {
  newForm.reset();$('#patient-match').textContent='';
  newForm.elements.dataPedido.value=localDate();
  createId=crypto.randomUUID();$('#new-error').textContent='';$('#new-notice').textContent=store instanceof DemoStore?'Teste somente com dados fictícios. O cadastro aparecerá no painel, mas será apagado ao atualizar a página.':'Ao confirmar, a guia será salva na base protegida e o responsável será identificado automaticamente pelo login.';newDialog.showModal();
}
$('#abrir-novo').addEventListener('click',openNewCase);
$('#nav-new').addEventListener('click',event=>{event.preventDefault();openNewCase();});
newForm.addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;
  const current=store,run=epoch;busy=true;$('#create-case').disabled=true;$('#new-error').textContent='';
  try {
    const fields=Object.fromEntries(new FormData(newForm));
    const record=await current.create({id:createId,fields});if(run!==epoch)return;
    records=[record,...records.filter(r=>r.id!==record.id)];render();newDialog.close();selected=record;renderDetail();detail.showModal();report(current instanceof DemoStore?'Guia adicionada à demonstração. Ela será apagada ao atualizar a página.':'Guia salva na base do setor e adicionada ao controle.');
  } catch(error){if(run===epoch){if(error.status===401)displayError(error);else $('#new-error').textContent=error.message || 'Não foi possível confirmar o cadastro. Confira a fila antes de tentar novamente.';}}
  finally{busy=false;$('#create-case').disabled=false;}
});
let patientLookup=0;
async function reusePatient() {
  const prontuario=newForm.elements.prontuario.value.trim().toUpperCase(),message=$('#patient-match'),run=++patientLookup,current=store,currentEpoch=epoch;
  if(!/^[A-Z0-9./-]{2,30}$/.test(prontuario)){message.textContent='';return;}
  message.textContent='Buscando cadastro anterior…';
  try {
    const {patient}=await current.patient(prontuario);
    if(run!==patientLookup||currentEpoch!==epoch)return;
    if(!patient){message.textContent='Prontuário novo. Preencha os dados do paciente.';return;}
    if(!newForm.elements.paciente.value.trim())newForm.elements.paciente.value=patient.paciente;
    if(!newForm.elements.convenio.value)newForm.elements.convenio.value=patient.convenio;
    message.textContent=`Paciente encontrado: nome e convênio preenchidos automaticamente.`;
  } catch(error) {
    if(run===patientLookup&&currentEpoch===epoch)message.textContent=error.status===401?'Sua sessão expirou. Entre novamente.':'Não foi possível reaproveitar o cadastro agora. Continue preenchendo normalmente.';
  }
}
newForm.elements.prontuario.addEventListener('blur',reusePatient);
newForm.elements.prontuario.addEventListener('change',reusePatient);
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
  if(type==='delivery')return item.stage==='faturamento';
  if(type==='open')return !['faturamento','cancelado'].includes(item.stage);
  if(type==='pending')return Boolean(item.fields.pendencia);
  return true;
}
function reportReferenceDate(item,type) {return type==='delivery'?billingDate(item.fields):requestDate(item.fields);}
function reportTitle(type) {return {complete:'Movimento completo',delivery:'Relação de entrega ao faturamento',open:'Guias ainda não entregues',pending:'Processos com pendência'}[type];}
function buildReportGroup(insurer,items,month,type) {
  const section=node('section',null,'print-insurer');
  const header=node('header',null,'print-header'),brand=node('div');brand.append(node('strong','AMOT'),node('span','Gestão de infiltrações'));
  const title=node('div');title.append(node('h1',reportTitle(type)),node('p',`${monthName(month)} · ${insurer}`));header.append(brand,title);section.append(header);
  const meta=node('div',null,'print-meta');
  meta.append(node('span',`Convênio: ${insurer}`),node('span',`Referência: ${month.replace('-','')}-${normalize(insurer).replace(/[^a-z0-9]/g,'').slice(0,8).toUpperCase()}`),node('span',`Emitido em: ${new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date())}`));section.append(meta);
  const table=node('table',null,'print-table'),thead=node('thead'),head=node('tr');
  for(const label of ['Nº','Paciente','Prontuário','Nº da guia','Médico','Articulação','Lado','Aplicação','Pedido','Realização','Faturamento','Situação','Condição / observação'])head.append(node('th',label));thead.append(head);table.append(thead);
  const body=node('tbody');items.forEach((item,index)=>{const tr=node('tr');const process=item.fields.pendencia?[processLabel(item.fields),item.fields.observacao].filter(Boolean).join(' — '):'Sem pendência';for(const value of [String(index+1).padStart(2,'0'),item.fields.paciente,item.fields.prontuario||'—',item.fields.numeroGuia||'—',item.fields.executor,item.fields.articulacao||'—',item.fields.lado||'—',item.fields.numeroAplicacao?`${item.fields.numeroAplicacao}ª de 3`:'—',requestDate(item.fields)?displayDate(requestDate(item.fields)):'—',applicationDate(item.fields)?displayDate(applicationDate(item.fields)):'—',billingDate(item.fields)?displayDate(billingDate(item.fields)):'—',stageLabel(item.stage),process])tr.append(node('td',value));body.append(tr);});table.append(body);section.append(table);
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
  const selected=reportRecords.filter(item=>reportReferenceDate(item,type)?.startsWith(month) && reportFilter(item,type) && (chosen==='all'||item.fields.convenio===chosen));
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
    const months=[...new Set(reportRecords.flatMap(item=>[requestDate(item.fields),billingDate(item.fields)]).map(date=>date?.slice(0,7)).filter(Boolean))].sort().reverse();
    $('#report-month').replaceChildren(...months.map(month=>new Option(monthName(month),month)));
    const insurers=[...new Set(reportRecords.map(item=>item.fields.convenio).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    $('#report-insurer').replaceChildren(new Option('Todos, em folhas separadas','all'),...insurers.map(insurer=>new Option(insurer,insurer)));
    renderReport();$('#reports-dialog').showModal();
  } catch(error){displayError(error);}finally{busy=false;$('#abrir-relatorios').disabled=false;}
}
$('#abrir-relatorios').addEventListener('click',openReports);
$('#nav-reports').addEventListener('click',event=>{event.preventDefault();openReports();});
for(const id of ['#report-month','#report-type','#report-insurer'])$(id).addEventListener('change',renderReport);
$('#print-report').addEventListener('click',()=>{if(!$('#print-sheet').children.length)return;window.print();});
function openLogin() {
  $('#login-note').textContent=configured?'Entre com a conta autorizada do setor. A sessão permanece somente nesta aba.':'O painel público está em modo demonstração. O acesso do setor depende da configuração do banco e da liberação dos usuários.';
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
    const credentials=await response.json(),api=new ApiStore(config,credentials.idToken),user=await api.session(),references=await api.references();if(run!==epoch){api.clear();return;}
    fillOptions(document,references,true);
    store=api;records=[];cursor=null;selected=null;filter='all';$('#search').value='';$('#only-pending').checked=false;$('#demo-controls').hidden=true;
    $('#mode-banner').replaceChildren(node('span',`Painel da equipe · ${ROLES[user.role]}`));
    const logout=node('button','Sair da equipe','text-button');logout.type='button';logout.addEventListener('click',()=>{signOut();report('Sessão encerrada.');});$('#mode-banner').append(logout);
    $('#login-dialog').close();report('');render();loading=false;await refresh();
  }catch(error){if(run===epoch)$('#login-error').textContent=error.message || 'Não foi possível iniciar a sessão.';}
  finally{$('#login-button').disabled=false;form.elements.password.value='';}
});
refresh();
