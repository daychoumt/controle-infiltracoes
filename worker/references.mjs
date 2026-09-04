import {problem} from '../assets/domain.js';

export function parseReferences(value) {
  let input;
  try { input=JSON.parse(value || ''); } catch { throw problem(503,'As listas da clínica ainda precisam ser configuradas.'); }
  const output={};
  for(const key of ['convenios','medicacoes','medicos']) {
    const list=input?.[key];
    if(!Array.isArray(list) || !list.length || list.length>100)throw problem(503,'As listas da clínica ainda precisam ser configuradas.');
    output[key]=[...new Set(list.map(item=>String(item).trim()).filter(item=>item && item.length<=120))];
    if(!output[key].length)throw problem(503,'As listas da clínica ainda precisam ser configuradas.');
  }
  return output;
}
