import {CONVENIOS, MEDICACOES, MEDICOS, FIELD_LABELS} from './domain.js';
export const $ = (selector,root=document) => root.querySelector(selector);
export function node(tag,text,className) { const el=document.createElement(tag); if(text != null) el.textContent=text; if(className) el.className=className; return el; }
export function fillOptions(root=document) {
  for(const [name,values] of Object.entries({convenio:CONVENIOS,medicacao:MEDICACOES,executor:MEDICOS})) {
    for(const select of root.querySelectorAll(`select[name="${name}"]`)) for(const value of values) select.add(new Option(value,value));
  }
}
export function displayDate(value) { return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(value+'T12:00:00')); }
export function summary(container,fields) {
  container.replaceChildren();
  for(const [key,label] of Object.entries(FIELD_LABELS)) {
    container.append(node('dt',label),node('dd',key==='data' && fields[key] ? displayDate(fields[key]) : fields[key] || 'Não informado'));
  }
}
export function closeDialogs() {
  document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
}
