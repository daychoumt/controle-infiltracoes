import {STAGES,CHECKS,ROLES,WORKFLOW_FIELD_LABELS,emptyChecks,pending,nextStage,canEdit,canReviewCheck,localDate,applicationLabel,jointLabel,processLabel,attentionState,nextActionLabel} from './domain.js?v=13';
import {$,node,fillOptions,closeDialogs,summary,displayDate} from './ui.js?v=13';
import {DemoStore,ApiStore} from './store.js?v=13';
import {SessionGuard} from './session.js?v=13';
import {config} from './config.js?v=13';
fillOptions();closeDialogs();
let store=new DemoStore(),records=[],reportRecords=[],batches=[],cursor=null,filter='all',selected=null,epoch=0,busy=false,createId=null,loading=false,lastBatch=null;
const configured=Boolean(config.apiUrl && config.firebaseApiKey);
const publicDemo=!configured || (typeof location!=='undefined' && new URLSearchParams(location.search).get('demo')==='1');
const sessionGuard=new SessionGuard(()=>signOut('A sessão foi bloqueada após 15 minutos sem uso. Entre novamente para continuar.'));
const status=$('#status'),detail=$('#case-dialog'),newDialog=$('#new-dialog'),newForm=$('#new-case');
const profileDialog=$('#profile-dialog'),profileForm=$('#profile-form'),processDialog=$('#process-dialog'),processForm=$('#process-form'),cancelDialog=$('#cancel-dialog'),cancelForm=$('#cancel-form');
const batchDialog=$('#batch-dialog'),batchForm=$('#batch-form');
const patientActions=node('div',null,'patient-actions');
const addPatientCaseButton=node('button','＋ Novo pedido deste paciente','button compact');addPatientCaseButton.type='button';
const editProfileButton=node('button','Editar perfil','text-button');editProfileButton.type='button';
patientActions.append(addPatientCaseButton,editProfileButton);$('.patient-overview>div:first-child').append(patientActions);
const editCaseButton=node('button','Corrigir dados desta infiltração','button secondary');editCaseButton.type='button';$('#advance').before(editCaseButton);
const cancelCaseButton=node('button','Cancelar esta infiltração','button secondary danger-outline');cancelCaseButton.type='button';$('#advance').before(cancelCaseButton);
function report(message) {status.textContent=message;}
function displayError(error) {
  if(error.status===401) {signOut('Sua sessão expirou. Entre novamente para consultar a equipe.');}
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
const stageHints={all:'Visão geral',pendencia:'Corrigir antes de seguir',atrasada:'Prioridade do setor',hoje:'Retorno ou procedimento',recebido:'Conferir e solicitar',solicitado:'Acompanhar operadora',autorizado:'Providenciar agendamento',agendado:'Aguardar realização',realizado:'Recolher a guia',conferencia:'Conferir documentos',pronto_faturamento:'Incluir em um lote',faturamento:'Entrega registrada',cancelado:'Processo encerrado'};
const actionInstructions={
  recebido:['Enviar pedido à operadora','Depois de conferir o pedido, registre o envio para iniciar o acompanhamento da autorização.'],
  solicitado:['Registrar autorização','Informe o número da guia quando a operadora autorizar o procedimento.'],
  autorizado:['Registrar agendamento','Informe a data agendada e confirme. Essa data não registra a realização.'],
  agendado:['Aguardar o procedimento','O agendamento já está salvo. Registre a realização somente depois que a infiltração acontecer.'],
  realizado:['Receber a guia assinada','Quando a guia assinada voltar ao setor, registre o recebimento para iniciar a conferência.'],
  conferencia:['Concluir a conferência','Marque os itens realmente conferidos. A guia só ficará pronta quando os quatro estiverem completos.'],
  pronto_faturamento:['Entregar em lote','Adicione a guia a um lote do mesmo convênio e imprima o protocolo de entrega.']
};
function caseFormState() {
  return {
    fields:{numeroGuia:$('#case-guide').value.trim(),dataAgendamento:$('#case-scheduled-date').value,dataAplicacao:$('#case-date').value,retornoEm:$('#case-followup').value,condicaoProcesso:$('#case-condition').value,observacao:$('#case-observation').value},
    checks:Object.fromEntries([...$('#case-checks').querySelectorAll('input')].map(input=>[input.name,input.checked]))
  };
}
function advanceReadiness(record=selected) {
  if(!record)return {ready:false,message:'Abra uma guia para continuar.'};
  const next=nextStage(record.stage),{fields,checks}=caseFormState(),today=localDate();
  if(!next)return {ready:false,message:'Este processo já chegou à última etapa.'};
  if(fields.condicaoProcesso!=='regular')return {ready:false,message:'Resolva a pendência e altere a situação da documentação para “Sem pendência” antes de avançar.',focus:'#case-condition'};
  if(record.stage==='solicitado'&&!fields.numeroGuia)return {ready:false,message:'Informe o número da guia autorizada para registrar a autorização.',focus:'#case-guide'};
  if(record.stage==='autorizado'&&!fields.dataAgendamento)return {ready:false,message:'Informe a data agendada. Depois clique em “Registrar agendamento”.',focus:'#case-scheduled-date'};
  if(record.stage==='autorizado'&&fields.dataAgendamento<requestDate(record.fields))return {ready:false,message:'A data agendada não pode ser anterior à data do pedido.',focus:'#case-scheduled-date'};
  if(record.stage==='agendado'&&!fields.dataAplicacao)return {ready:false,message:'Agendamento já registrado. Depois que a infiltração acontecer, informe a data da realização.',focus:'#case-date'};
  if(record.stage==='agendado'&&fields.dataAplicacao>today)return {ready:false,message:'A realização não pode ser registrada com uma data futura. Mantenha a guia como agendada.',focus:'#case-date'};
  if(record.stage==='agendado'&&fields.dataAplicacao<requestDate(record.fields))return {ready:false,message:'A data da realização não pode ser anterior à data do pedido.',focus:'#case-date'};
  if(record.stage==='conferencia') {
    const missing=Object.entries(CHECKS).filter(([key])=>!checks[key]).map(([,label])=>label);
    if(missing.length)return {ready:false,message:`Ainda falta conferir: ${missing.join(', ')}.`,focus:'#case-checks input:not(:checked):not(:disabled)'};
  }
  return {ready:true,message:actionInstructions[record.stage]?.[1] || 'Os dados necessários estão preenchidos.'};
}
function updateAdvanceState() {
  const guidance=$('#action-guidance'),button=$('#advance');
  if(!selected || button.hidden){guidance.hidden=true;return;}
  const readiness=advanceReadiness(selected),copy=actionInstructions[selected.stage] || ['Próxima etapa','Confira os dados antes de continuar.'];
  guidance.hidden=false;guidance.className=`action-guidance ${readiness.ready?'ready':'blocked'}`;
  guidance.replaceChildren(node('strong',copy[0]),node('span',readiness.message));
  button.disabled=busy || !readiness.ready;
}
function advanceSuccess(previousStage,record) {
  return ({
    recebido:'Pedido registrado como enviado à operadora. O processo agora está em análise.',
    solicitado:'Autorização registrada. Agora informe quando a infiltração será agendada.',
    autorizado:`Agendamento registrado para ${displayDate(record.fields.dataAgendamento)}. A próxima etapa será registrar a realização depois do procedimento.`,
    agendado:`Realização registrada em ${displayDate(applicationDate(record.fields))}. Agora aguarde a guia assinada voltar ao setor.`,
    realizado:'Recebimento da guia assinada registrado. Faça a conferência da documentação.',
    conferencia:'Conferência concluída. A guia está pronta para entrar no lote de faturamento.'
  })[previousStage] || 'Etapa atualizada e registrada no histórico.';
}
function render() {
  const hasRecords=records.length>0;
  $('.status-section').hidden=!hasRecords;$('.toolbar').hidden=!hasRecords;$('.queue-card>.table-scroll').hidden=!hasRecords;$('.workflow-note').hidden=!hasRecords;
  const filters=$('#stage-filters');filters.replaceChildren();
  const groups=[
    ['Prioridades de hoje','Comece por estas filas',[['all','Todas'],['pendencia','Com pendência'],['atrasada','Atrasadas'],['hoje','Para hoje']]],
    ['Autorizações','Do recebimento ao agendamento',STAGES.slice(0,4)],
    ['Pós-procedimento','Da realização à entrega',STAGES.slice(4)]
  ];
  for(const [title,hint,items] of groups) {
    const group=node('section',null,'filter-group'),heading=node('div',null,'filter-group-heading'),grid=node('div',null,'filter-grid');
    heading.append(node('h3',title),node('p',hint));group.append(heading,grid);
    for(const [key,label] of items) {
      const count=key==='all' ? records.length : ['pendencia','atrasada','hoje'].includes(key) ? records.filter(r=>attentionState(r).key===key).length : records.filter(r=>r.stage===key).length;
      const button=node('button',null,`filter status-${key}`);button.type='button';button.setAttribute('aria-pressed',String(filter===key));button.append(node('span',label),node('strong',count),node('small',stageHints[key]));
      button.addEventListener('click',()=>{filter=key;render();filters.querySelector('[aria-pressed="true"]')?.focus();});grid.append(button);
    }
    filters.append(group);
  }
  const query=normalize($('#search').value.trim());
  const visible=records.filter(r=>(filter==='all'||(['pendencia','atrasada','hoje'].includes(filter)?attentionState(r).key===filter:r.stage===filter)) && (!$('#only-pending').checked||r.fields.pendencia) && normalize([r.fields.paciente,r.fields.prontuario,r.fields.numeroGuia,r.fields.pedidoRacimed,r.fields.executor,r.fields.convenio,r.fields.articulacao,r.fields.loteReferencia,processLabel(r.fields),r.fields.observacao,r.id].filter(Boolean).join(' ')).includes(query));
  const tbody=$('#cases');tbody.replaceChildren();
  for(const record of visible) {
    const tr=node('tr'),patient=node('td');patient.append(node('strong',record.fields.paciente),node('small',record.fields.prontuario ? `Prontuário ${record.fields.prontuario}` : record.id.startsWith('demo-')?record.id.toUpperCase():'AM-'+record.id.slice(0,8).toUpperCase()));
    const joint=node('td',jointLabel(record.fields));joint.append(node('small',record.fields.pedidoRacimed ? `Pedido ${record.fields.pedidoRacimed}` : 'Uma guia para esta articulação'));
    const guide=node('td');guide.append(node('strong',record.fields.numeroGuia || 'Número ainda não informado'),node('small',`${applicationLabel(record.fields)} · Pedido ${requestDate(record.fields)?displayDate(requestDate(record.fields)):'sem data'}`),node('small',applicationDate(record.fields)?`Realizada em ${displayDate(applicationDate(record.fields))}`:'Realização ainda não informada'));
    const attention=attentionState(record),stage=node('td');stage.append(node('span',stageLabel(record.stage),'pill '+record.stage));if(record.fields.pendencia)stage.append(node('small',`⚠ ${processLabel(record.fields)}`,'pending-note'));
    const nextAction=node('td');nextAction.append(node('strong',nextActionLabel(record.stage)),node('small',attention.label,`attention-note ${attention.key}`));
    const progress=node('td'),bars=node('div',null,'check-progress');bars.setAttribute('aria-hidden','true');
    for(const checked of Object.values(record.checks)) bars.append(node('i',null,checked?'done':''));
    progress.append(bars,node('small',`${4-pending(record).length}/4 itens conferidos`));
    const action=node('td'),button=node('button','Abrir guia →','text-button');button.type='button';button.setAttribute('aria-label',`Abrir guia de ${record.fields.paciente}`);button.addEventListener('click',()=>openCase(record.id));action.append(button);
    tr.className=`stage-row ${record.stage}${record.fields.pendencia?' has-pending':''}${attention.key==='atrasada'?' is-stale':''}`;tr.append(patient,joint,guide,node('td',record.fields.convenio),stage,nextAction,progress,action);tbody.append(tr);
  }
  $('#empty').hidden=visible.length>0;
  $('#empty h3').textContent=hasRecords?'Nenhuma guia encontrada':'Nenhum paciente cadastrado';
  $('#empty p').textContent=hasRecords?'Escolha outra etapa ou limpe a busca.':'Cadastre a primeira guia para começar seus testes.';
  $('#clear-filters').textContent=hasRecords?'Limpar filtros':'＋ Cadastrar primeiro paciente';
  $('#result-count').textContent=`${visible.length} guia${visible.length===1?'':'s'}`;
  $('#load-more').hidden=!cursor;$('#abrir-novo').disabled=!['recepcao','admin'].includes(store.role);$('#abrir-lotes').disabled=!records.some(record=>record.stage==='pronto_faturamento')||!['recepcao','admin'].includes(store.role);
  $('#list-note').textContent=store instanceof DemoStore ? 'Ambiente de testes: use somente dados fictícios.' : `${records.length} guias carregadas.${cursor?' Há mais registros disponíveis.':''}`;
}
async function openCase(id) {
  if(busy) return;const current=store,run=epoch;busy=true;
  try {
    const [record,patientSource]=await Promise.all([current.detail(id),allCases(current)]);if(run!==epoch) return;
    records=[...new Map([...records,...patientSource,record].map(item=>[item.id,item])).values()];selected=record;renderDetail();if(!detail.open)detail.showModal();
  }
  catch(error){if(run===epoch) displayError(error);}finally{busy=false;updateAdvanceState();}
}
function renderDetail() {
  const record=selected;
  $('#case-title').textContent=record.fields.paciente;
  $('#case-protocol').textContent=`GUIA ${record.id.startsWith('demo-')?record.id.toUpperCase():record.id.slice(0,8).toUpperCase()} · VERSÃO ${record.version}`;
  $('#case-guide-number').textContent=record.fields.numeroGuia || 'Ainda não informado';
  $('#case-status').textContent=stageLabel(record.stage);$('#case-status').className=`pill ${record.stage}`;
  $('#case-guide').value=record.fields.numeroGuia || '';$('#case-scheduled-date').value=record.fields.dataAgendamento || '';$('#case-date').value=applicationDate(record.fields);$('#case-followup').value=record.fields.retornoEm || '';$('#case-condition').value=record.fields.condicaoProcesso || (record.fields.pendencia?'outro':'regular');$('#case-observation').value=record.fields.observacao || '';
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
    open.type='button';open.disabled=item.id===record.id;open.addEventListener('click',()=>openCase(item.id));
    statusCell.append(node('span',stageLabel(item.stage),'pill '+item.stage),open);
    tr.append(node('td',jointLabel(item.fields)),node('td',item.fields.numeroAplicacao?`${item.fields.numeroAplicacao}ª de 3`:'—'),node('td',item.fields.numeroGuia||'—'),node('td',applicationDate(item.fields)?displayDate(applicationDate(item.fields)):'—'),statusCell);$('#patient-history').append(tr);
  }
  const editable=canEdit(record,store.role),checks=$('#case-checks');checks.replaceChildren();
  for(const [key,label] of Object.entries(CHECKS)) {
    const available=canReviewCheck(key,record.stage),item=node('label',null,`check-item${available?'':' locked'}`),input=node('input');input.type='checkbox';input.name=key;input.checked=Boolean(record.checks[key]&&available);input.disabled=!editable||!available;item.append(input,node('span',label));
    if(!available)item.append(node('small','Será liberado na etapa correta.'));checks.append(item);
  }
  $('#save-checks').hidden=!editable;
  addPatientCaseButton.hidden=!['recepcao','admin'].includes(store.role);
  editProfileButton.hidden=!['recepcao','admin'].includes(store.role);
  editCaseButton.hidden=!editable;
  cancelCaseButton.hidden=!editable;
  $('#case-guide').disabled=$('#case-scheduled-date').disabled=$('#case-date').disabled=$('#case-followup').disabled=$('#case-condition').disabled=$('#case-observation').disabled=!editable;
  $('#check-help').textContent=record.stage==='faturamento'?'Entrega registrada. A guia permanece disponível para consulta e impressão.':record.stage==='conferencia'?'Marque somente o que já foi conferido pelo setor.':'Os itens serão liberados automaticamente conforme a guia avançar.';
  const next=nextStage(record.stage);
  $('#advance').hidden=!next || !editable;
  $('#advance').textContent=nextActionLabel(record.stage);
  $('#case-message').textContent='';$('#case-message').className='message';updateAdvanceState();$('#case-history').replaceChildren();
  for(const event of [...record.events].reverse()) {
    const item=node('li',event.action),date=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(event.at));
    item.append(node('small',`${date} · ${ROLES[event.actor] || event.actor}`));$('#case-history').append(item);
  }
}
async function save(advance=false) {
  if(busy || !selected) return;busy=true;
  const current=store,run=epoch,previous=selected;
  const {checks,fields}=caseFormState();
  $('#save-checks').disabled=$('#advance').disabled=true;
  try {
    const updated=await current.update(previous.id,{version:previous.version,fields,checks,stage:advance?nextStage(previous.stage):previous.stage});
    if(run!==epoch) return;
    selected=updated;records=records.map(r=>r.id===updated.id?updated:r);render();renderDetail();const message=advance?advanceSuccess(previous.stage,updated):'Alterações salvas no histórico.';$('#case-message').textContent=message;$('#case-message').className='message success';report(message);
  } catch(error) {
    if(run===epoch) {if(error.status===401)displayError(error);else {$('#case-message').textContent=error.status===409?'Este atendimento mudou. Feche e reabra os detalhes para carregar a versão atual.':error.message || 'Não foi possível salvar. Reabra o atendimento para conferir antes de tentar novamente.';$('#case-message').className='message error';}}
  } finally {busy=false;$('#save-checks').disabled=false;updateAdvanceState();}
}
$('#case-form').addEventListener('submit',e=>{e.preventDefault();save();});
$('#case-form').addEventListener('input',updateAdvanceState);$('#case-form').addEventListener('change',updateAdvanceState);
$('#advance').addEventListener('click',()=>{if(busy||!selected)return;const readiness=advanceReadiness(selected);if(!readiness.ready){$('#case-message').textContent=readiness.message;$('#case-message').className='message error';if(readiness.focus)$(readiness.focus)?.focus();return;}if(selected.stage==='pronto_faturamento'){detail.close();openBatches(selected.id);return;}save(true);});
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
    selected={...selected,fields:{...selected.fields,paciente:patient.paciente,convenio:patient.convenio}};profileDialog.close();render();renderDetail();report('Perfil do paciente corrigido em todas as guias.');
  } catch(error){if(run===epoch)$('#profile-error').textContent=error.message || 'Não foi possível corrigir o perfil.';}
  finally{busy=false;$('#save-profile').disabled=false;updateAdvanceState();}
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
  finally{busy=false;$('#save-process').disabled=false;updateAdvanceState();}
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
  finally{busy=false;$('#confirm-cancel').disabled=false;updateAdvanceState();}
});
detail.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
detail.querySelector('[data-close]').addEventListener('click',()=>{selected=null;});
$('#search').addEventListener('input',render);$('#only-pending').addEventListener('change',render);
$('#clear-filters').addEventListener('click',()=>{if(records.length===0){openNewCase();return;}filter='all';$('#search').value='';$('#only-pending').checked=false;render();});
$('#refresh').addEventListener('click',()=>{report('');refresh();});$('#load-more').addEventListener('click',()=>refresh(true));
function resetDemo() {
  epoch++;store.clear?.();store=new DemoStore();records=[];reportRecords=[];batches=[];cursor=null;filter='all';selected=null;busy=false;lastBatch=null;
  fillOptions(document,null,true);
  $('#patient-history').replaceChildren();$('#patient-totals').textContent='';$('#report-preview').replaceChildren();$('#print-sheet').replaceChildren();
  $('#search').value='';$('#only-pending').checked=false;$('#demo-controls').hidden=false;
  $('#mode-banner').replaceChildren(node('span','Ambiente de testes · A base começa vazia e as alterações ficam somente nesta aba.'));
  const login=node('button','Acesso do setor →','text-button');login.type='button';login.addEventListener('click',openLogin);$('#mode-banner').append(login);
  render(); loading=false;refresh();
}
function signOut(message='') {
  sessionGuard.stop();document.querySelectorAll('dialog[open]').forEach(d=>d.close());newForm.reset();$('#login-form').reset();
  $('#case-summary').replaceChildren();$('#case-history').replaceChildren();$('#case-title').textContent='';$('#case-checks').replaceChildren();resetDemo();
  if(configured&&!publicDemo){
    $('#demo-controls').hidden=true;$('#mode-banner').replaceChildren(node('span','Acesso protegido · Entre com uma conta individual autorizada.'));
    openLogin();$('#login-error').textContent=message;
  }
}
$('#reset-demo').addEventListener('click',()=>{resetDemo();report('Todos os testes foram apagados. A demonstração está vazia novamente.');});
newForm.elements.articulacao.addEventListener('change',()=>{
  const other=newForm.elements.articulacao.value==='Outra articulação';
  $('#outra-articulacao').hidden=!other;newForm.elements.articulacaoOutra.required=other;if(!other)newForm.elements.articulacaoOutra.value='';
});
function openNewCase(patient=null) {
  newForm.reset();$('#patient-match').textContent='';
  newForm.elements.dataPedido.value=localDate();
  if(patient) {
    newForm.elements.prontuario.value=patient.prontuario || '';
    newForm.elements.paciente.value=patient.paciente || '';
    newForm.elements.convenio.value=patient.convenio || '';
    $('#patient-match').textContent='Paciente já identificado. Preencha apenas os dados do novo pedido e da articulação.';
  }
  createId=crypto.randomUUID();$('#new-error').textContent='';$('#new-notice').textContent=store instanceof DemoStore?'Use somente dados fictícios. O cadastro aparecerá no painel e será apagado quando a página for atualizada.':'Ao confirmar, a guia será salva na base protegida e o responsável será identificado automaticamente pelo login.';newDialog.showModal();
}
$('#abrir-novo').addEventListener('click',openNewCase);
$('#nav-new').addEventListener('click',event=>{event.preventDefault();openNewCase();});
addPatientCaseButton.addEventListener('click',()=>{
  if(!selected)return;
  const patient={prontuario:selected.fields.prontuario,paciente:selected.fields.paciente,convenio:selected.fields.convenio};
  detail.close();openNewCase(patient);
});
newForm.addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;
  const current=store,run=epoch;busy=true;$('#create-case').disabled=true;$('#new-error').textContent='';
  try {
    const fields=Object.fromEntries(new FormData(newForm));
    const record=await current.create({id:createId,fields});if(run!==epoch)return;
    records=[record,...records.filter(r=>r.id!==record.id)];render();newDialog.close();selected=record;renderDetail();detail.showModal();report(current instanceof DemoStore?'Guia adicionada à demonstração. Ela será apagada ao atualizar a página.':'Guia salva na base do setor e adicionada ao controle.');
  } catch(error){if(run===epoch){if(error.status===401)displayError(error);else $('#new-error').textContent=error.message || 'Não foi possível confirmar o cadastro. Confira a fila antes de tentar novamente.';}}
  finally{busy=false;$('#create-case').disabled=false;updateAdvanceState();}
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
function reportColumns(type) {
  if(type==='delivery')return [
    ['Paciente',item=>item.fields.paciente],['Prontuário',item=>item.fields.prontuario||'—'],['Nº da guia',item=>item.fields.numeroGuia||'—'],['Médico',item=>item.fields.executor],['Articulação',item=>jointLabel(item.fields)],['Aplicação',item=>applicationLabel(item.fields)],['Realização',item=>applicationDate(item.fields)?displayDate(applicationDate(item.fields)):'—'],['Lote',item=>item.fields.loteReferencia||'—']
  ];
  if(['open','pending'].includes(type))return [
    ['Paciente',item=>item.fields.paciente],['Prontuário',item=>item.fields.prontuario||'—'],['Guia',item=>item.fields.numeroGuia||'—'],['Médico',item=>item.fields.executor],['Articulação',item=>jointLabel(item.fields)],['Aplicação',item=>applicationLabel(item.fields)],['Pedido',item=>displayDate(requestDate(item.fields))],['Situação',item=>stageLabel(item.stage)],['Próxima ação',item=>nextActionLabel(item.stage)],['Retorno',item=>item.fields.retornoEm?displayDate(item.fields.retornoEm):'—'],['Pendência / observação',item=>item.fields.pendencia?[processLabel(item.fields),item.fields.observacao].filter(Boolean).join(' — '):'Sem pendência']
  ];
  return [
    ['Paciente',item=>item.fields.paciente],['Prontuário',item=>item.fields.prontuario||'—'],['Guia',item=>item.fields.numeroGuia||'—'],['Médico',item=>item.fields.executor],['Articulação',item=>jointLabel(item.fields)],['Aplicação',item=>applicationLabel(item.fields)],['Pedido',item=>displayDate(requestDate(item.fields))],['Solicitação',item=>item.fields.dataSolicitacao?displayDate(item.fields.dataSolicitacao):'—'],['Autorização',item=>item.fields.dataAutorizacao?displayDate(item.fields.dataAutorizacao):'—'],['Agendada',item=>item.fields.dataAgendamento?displayDate(item.fields.dataAgendamento):'—'],['Realização',item=>applicationDate(item.fields)?displayDate(applicationDate(item.fields)):'—'],['Faturamento',item=>billingDate(item.fields)?displayDate(billingDate(item.fields)):'—'],['Situação',item=>stageLabel(item.stage)]
  ];
}
function buildReportGroup(insurer,items,month,type,batch=null) {
  const section=node('section',null,'print-insurer');
  const header=node('header',null,'print-header'),brand=node('div');brand.append(node('strong','AMOT'),node('span','Gestão de infiltrações'));
  const title=node('div');title.append(node('h1',batch?`Protocolo ${batch.reference}`:reportTitle(type)),node('p',`${monthName(month)} · ${insurer}`));header.append(brand,title);section.append(header);
  const meta=node('div',null,'print-meta');
  meta.append(node('span',`Convênio: ${insurer}`),node('span',`Referência: ${batch?.reference || `${month.replace('-','')}-${normalize(insurer).replace(/[^a-z0-9]/g,'').slice(0,8).toUpperCase()}`}`),node('span',`Emitido em: ${new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date())}`));section.append(meta);
  const table=node('table',null,'print-table'),thead=node('thead'),head=node('tr');
  const columns=reportColumns(type);for(const label of ['Nº',...columns.map(([label])=>label)])head.append(node('th',label));thead.append(head);table.append(thead);
  const body=node('tbody');items.forEach((item,index)=>{const tr=node('tr');tr.append(node('td',String(index+1).padStart(2,'0')));for(const [,value] of columns)tr.append(node('td',value(item)));body.append(tr);});table.append(body);section.append(table);
  const totals=node('div',null,'print-totals'),joints=new Map();for(const item of items)joints.set(item.fields.articulacao||'Não informada',(joints.get(item.fields.articulacao||'Não informada')||0)+1);
  totals.append(node('strong',`Total: ${items.length} guia${items.length===1?'':'s'}`),node('span',[...joints].map(([joint,count])=>`${joint}: ${count}`).join(' · ')));section.append(totals);
  if(type==='delivery') {
    const signatures=node('div',null,'print-signatures');for(const label of ['Entregue por',batch?`Recebido por: ${batch.recebidoPor}`:'Recebido por / Faturamento','Data e horário','Assinatura']){const field=node('div');field.append(node('span',label));signatures.append(field);}section.append(signatures);
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
let batchPreselect='';
function renderBatchHistory() {
  const container=$('#batch-history');container.replaceChildren();
  if(!batches.length){container.append(node('p','Nenhum lote foi entregue ainda.','report-empty'));return;}
  for(const batch of batches.slice(0,8)){
    const row=node('div',null,'batch-history-row'),main=node('div');main.append(node('strong',batch.reference),node('span',`${batch.convenio} · ${batch.total} guia${batch.total===1?'':'s'} · ${monthName(batch.competencia)}`));
    row.append(main,node('span',`Recebido por ${batch.recebidoPor}`));container.append(row);
  }
}
function readyCases() {return records.filter(record=>record.stage==='pronto_faturamento');}
function renderBatchItems() {
  const insurer=$('#batch-insurer').value,items=readyCases().filter(record=>record.fields.convenio===insurer),container=$('#batch-items');container.replaceChildren();
  if(!items.length){container.append(node('p','Não há guias prontas para este convênio.','report-empty'));$('#create-batch').disabled=true;return;}
  const heading=node('div',null,'batch-items-heading');heading.append(node('strong',`${items.length} guia${items.length===1?'':'s'} pronta${items.length===1?'':'s'}`),node('span','Marque somente o que está sendo entregue agora.'));container.append(heading);
  for(const record of items){const label=node('label',null,'batch-item'),checkbox=node('input');checkbox.type='checkbox';checkbox.name='caseId';checkbox.value=record.id;checkbox.checked=!batchPreselect||record.id===batchPreselect;const text=node('span');text.append(node('strong',record.fields.paciente),node('small',`${record.fields.prontuario} · ${jointLabel(record.fields)} · ${applicationLabel(record.fields)} · Guia ${record.fields.numeroGuia}`));label.append(checkbox,text);container.append(label);}
  $('#create-batch').disabled=false;
}
async function openBatches(preselect='') {
  if(busy)return;busy=true;batchPreselect=preselect;$('#abrir-lotes').disabled=true;$('#batch-message').textContent='';$('#print-batch').hidden=true;
  try {
    const [all,batchData]=await Promise.all([allCases(),store.listBatches()]);records=[...new Map(all.map(item=>[item.id,item])).values()];batches=batchData.items || [];
    const ready=readyCases(),insurers=[...new Set(ready.map(record=>record.fields.convenio))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    $('#batch-insurer').replaceChildren(...insurers.map(insurer=>new Option(insurer,insurer)));
    if(preselect){const target=ready.find(record=>record.id===preselect);if(target)$('#batch-insurer').value=target.fields.convenio;}
    $('#batch-month').value=localDate().slice(0,7);batchForm.elements.recebidoPor.value='';batchForm.elements.observacao.value='';renderBatchItems();renderBatchHistory();
    if(!ready.length)$('#batch-message').textContent='Nenhuma guia está pronta para entrega. Conclua a conferência primeiro.';
    batchDialog.showModal();
  }catch(error){displayError(error);}finally{busy=false;$('#abrir-lotes').disabled=false;}
}
$('#abrir-lotes').addEventListener('click',()=>openBatches());
$('#nav-batches').addEventListener('click',event=>{event.preventDefault();openBatches();});
$('#batch-insurer').addEventListener('change',()=>{batchPreselect='';renderBatchItems();});
batchForm.addEventListener('change',event=>{if(event.target.name==='caseId')$('#create-batch').disabled=!batchForm.querySelector('input[name="caseId"]:checked');});
batchForm.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;const ids=[...batchForm.querySelectorAll('input[name="caseId"]:checked')].map(input=>input.value);if(!ids.length){$('#batch-message').textContent='Selecione ao menos uma guia.';return;}
  busy=true;$('#create-batch').disabled=true;$('#batch-message').textContent='';const current=store,run=epoch;
  try {
    const batch=await current.createBatch({id:crypto.randomUUID(),caseIds:ids,competencia:$('#batch-month').value,recebidoPor:batchForm.elements.recebidoPor.value,observacao:batchForm.elements.observacao.value});if(run!==epoch)return;
    lastBatch=batch;batches=[batch,...batches.filter(item=>item.id!==batch.id)];records=records.map(record=>batch.items.find(item=>item.id===record.id)||record);reportRecords=records;render();renderBatchHistory();batchPreselect='';
    const sheet=$('#print-sheet');sheet.replaceChildren(buildReportGroup(batch.convenio,batch.items,batch.competencia,'delivery',batch));$('#print-batch').hidden=false;$('#batch-message').textContent=`Lote ${batch.reference} entregue com ${batch.total} guia${batch.total===1?'':'s'}. O protocolo está pronto para impressão.`;renderBatchItems();
  }catch(error){if(run===epoch)$('#batch-message').textContent=error.message || 'Não foi possível criar o lote. Atualize as guias e tente novamente.';}
  finally{busy=false;$('#create-batch').disabled=!batchForm.querySelector('input[name="caseId"]:checked');}
});
$('#print-batch').addEventListener('click',()=>{if(lastBatch&&$('#print-sheet').children.length)window.print();});
function openLogin() {
  $('#login-note').textContent=configured?'Entre com sua conta individual. A sessão fica somente nesta aba e é bloqueada após 15 minutos sem uso.':'O painel público está em modo demonstração. O acesso do setor depende da configuração do banco e da liberação dos usuários.';
  const locked=configured&&!publicDemo&&!(store instanceof ApiStore);
  $('#login-form').hidden=!configured;$('#login-error').textContent='';$('#login-dialog [data-close]').hidden=locked;
  if(!$('#login-dialog').open)$('#login-dialog').showModal();
}
$('#entrar-equipe').addEventListener('click',openLogin);
$('#login-dialog').addEventListener('cancel',event=>{if(configured&&!publicDemo&&!(store instanceof ApiStore))event.preventDefault();});
$('#login-form').addEventListener('submit',async e=>{
  e.preventDefault();const run=++epoch;$('#login-button').disabled=true;
  const form=e.currentTarget;let api;
  try {
    const response=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(config.firebaseApiKey)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:form.elements.email.value.trim(),password:form.elements.password.value,returnSecureToken:true}),signal:AbortSignal.timeout(12000)});
    form.elements.password.value='';
    if(!response.ok)throw new Error('Não foi possível entrar. Confira o e-mail e a senha da equipe.');
    const credentials=await response.json();api=new ApiStore(config,credentials);const user=await api.session(),references=await api.references();if(run!==epoch){api.clear();return;}
    fillOptions(document,references,true);
    store=api;records=[];cursor=null;selected=null;filter='all';$('#search').value='';$('#only-pending').checked=false;$('#demo-controls').hidden=true;
    $('#mode-banner').replaceChildren(node('span',`Painel da equipe · ${ROLES[user.role]}`));
    const logout=node('button','Sair da equipe','text-button');logout.type='button';logout.addEventListener('click',()=>{signOut();report('Sessão encerrada.');});$('#mode-banner').append(logout);
    $('#login-dialog').close();sessionGuard.start();report('');render();loading=false;await refresh();
  }catch(error){api?.clear();if(run===epoch)$('#login-error').textContent=error.message || 'Não foi possível iniciar a sessão.';}
  finally{$('#login-button').disabled=false;form.elements.password.value='';}
});
for(const eventName of ['pointerdown','keydown','touchstart'])document.addEventListener?.(eventName,()=>{if(store instanceof ApiStore)sessionGuard.touch();},{passive:true});
document.addEventListener?.('visibilitychange',()=>{if(!document.hidden&&store instanceof ApiStore)sessionGuard.check();});
refresh();
if(configured&&!publicDemo){
  $('#demo-controls').hidden=true;$('#mode-banner').replaceChildren(node('span','Acesso protegido · Entre com uma conta individual autorizada.'));openLogin();
}
