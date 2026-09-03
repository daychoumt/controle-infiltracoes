import {STAGES,CHECKS,ROLES,emptyChecks,pending,nextStage,canEdit,localDate,validateFields} from './domain.js';
import {$,node,fillOptions,closeDialogs,summary,displayDate} from './ui.js';
import {DemoStore,ApiStore} from './store.js';
import {config} from './config.js';
fillOptions();closeDialogs();
let store=new DemoStore(),records=[],cursor=null,filter='all',selected=null,epoch=0,busy=false,createId=null,loading=false;
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
  const visible=records.filter(r=>(filter==='all'||r.stage===filter) && (!$('#only-pending').checked||r.stage==='realizado') && normalize([r.fields.paciente,r.fields.convenio,r.id].join(' ')).includes(query));
  const tbody=$('#cases');tbody.replaceChildren();
  for(const record of visible) {
    const tr=node('tr'),patient=node('td');patient.append(node('strong',record.fields.paciente),node('small',record.id.startsWith('demo-')?record.id.toUpperCase():'AM-'+record.id.slice(0,8).toUpperCase()));
    const date=node('td',displayDate(record.fields.data));date.append(node('small',record.fields.executor));
    const stage=node('td');stage.append(node('span',STAGES.find(([key])=>key===record.stage)[1],'pill '+record.stage));
    const progress=node('td'),bars=node('div',null,'check-progress');bars.setAttribute('aria-hidden','true');
    for(const checked of Object.values(record.checks)) bars.append(node('i',null,checked?'done':''));
    progress.append(bars,node('small',`${4-pending(record).length}/4 itens conferidos`));
    const action=node('td'),button=node('button','Abrir →','text-button');button.type='button';button.setAttribute('aria-label',`Abrir atendimento de ${record.fields.paciente}`);button.addEventListener('click',()=>openCase(record.id));action.append(button);
    tr.append(patient,date,node('td',record.fields.convenio),stage,progress,action);tbody.append(tr);
  }
  $('#empty').hidden=visible.length>0;$('#result-count').textContent=`${visible.length} atendimento${visible.length===1?'':'s'}`;
  $('#load-more').hidden=!cursor;$('#abrir-novo').disabled=!['recepcao','admin'].includes(store.role);
  $('#list-note').textContent=store instanceof DemoStore ? 'Somente dados fictícios nesta demonstração.' : `${records.length} atendimentos carregados. Resumo e filtros consideram esta lista.${cursor?' Há mais registros disponíveis.':''}`;
}
async function openCase(id) {
  if(busy) return;const current=store,run=epoch;busy=true;
  try {const record=await current.detail(id);if(run!==epoch) return;selected=record;renderDetail();detail.showModal();}
  catch(error){if(run===epoch) displayError(error);}finally{busy=false;}
}
function renderDetail() {
  const record=selected;
  $('#case-title').textContent=record.fields.paciente;
  $('#case-protocol').textContent=`ATENDIMENTO ${record.id.startsWith('demo-')?record.id.toUpperCase():record.id.slice(0,8).toUpperCase()} · VERSÃO ${record.version}`;
  summary($('#case-summary'),record.fields);
  $('#case-steps').replaceChildren();
  const current=STAGES.findIndex(([key])=>key===record.stage);
  STAGES.forEach(([key,label],i)=>{const li=node('li',label,i===current?'current':i<current?'passed':'');if(i===current)li.setAttribute('aria-current','step');$('#case-steps').append(li);});
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
  epoch++;store.clear?.();store=new DemoStore();records=[];cursor=null;filter='all';selected=null;busy=false;
  $('#role').value='recepcao';$('#search').value='';$('#only-pending').checked=false;$('#demo-controls').hidden=false;
  $('#mode-banner').replaceChildren(node('span','Demonstração interativa · Dados fictícios. As alterações ficam só nesta aba.'));
  const login=node('button','Acesso da equipe →','text-button');login.type='button';login.addEventListener('click',openLogin);$('#mode-banner').append(login);
  render(); loading=false;refresh();
}
function signOut() {document.querySelectorAll('dialog[open]').forEach(d=>d.close());newForm.reset();$('#login-form').reset();$('#case-summary').replaceChildren();$('#case-history').replaceChildren();$('#case-title').textContent='';$('#case-checks').replaceChildren();resetDemo();}
$('#reset-demo').addEventListener('click',()=>{resetDemo();report('Demonstração reiniciada com os exemplos originais.');});
$('#abrir-novo').addEventListener('click',()=>{
  newForm.reset();newForm.elements.data.value=localDate();newForm.elements.atendente.value=store instanceof DemoStore?'Equipe de demonstração':'';
  createId=crypto.randomUUID();$('#new-error').textContent='';$('#new-notice').textContent=store instanceof DemoStore?'Use dados fictícios. Este cadastro não envia informações à planilha ou à clínica.':'Este cadastro abre o acompanhamento no painel. O envio do formulário à planilha é uma operação separada.';newDialog.showModal();
});
newForm.addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;
  const current=store,run=epoch;busy=true;$('#create-case').disabled=true;
  try {
    const fields=validateFields(Object.fromEntries(new FormData(newForm)));
    const record=await current.create({id:createId,fields});if(run!==epoch)return;
    records=[record,...records.filter(r=>r.id!==record.id)];render();newDialog.close();selected=record;renderDetail();detail.showModal();report('Atendimento aberto para acompanhamento.');
  } catch(error){if(run===epoch){if(error.status===401)displayError(error);else $('#new-error').textContent=error.message || 'Não foi possível confirmar o cadastro. Confira a fila antes de tentar novamente.';}}
  finally{busy=false;$('#create-case').disabled=false;}
});
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
