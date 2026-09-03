import {problem,ROLES} from '../assets/domain.js';
export async function authenticate(token, env, request=fetch) {
  let claims;
  try { claims=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))); }
  catch {throw problem(401,'Sessão inválida. Entre novamente.');}
  if(claims.aud!==env.FIREBASE_PROJECT_ID || claims.iss!==`https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}` ||
    typeof claims.sub!=='string' || !claims.sub || !Number.isFinite(claims.exp) || claims.exp<=Date.now()/1000 ||
    !Number.isFinite(claims.auth_time)) throw problem(401,'Sessão inválida. Entre novamente.');
  // Decoding is only a precheck. Firebase validates the full ID token server-side.
  const response=await request(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(env.FIREBASE_WEB_API_KEY)}`,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token}),signal:AbortSignal.timeout(8000)
  });
  if(!response.ok) throw problem([400,401].includes(response.status)?401:503,'Não foi possível validar a sessão da equipe.');
  const user=(await response.json()).users?.[0];
  if(!user || user.localId!==claims.sub || user.disabled || (user.validSince && claims.auth_time<Number(user.validSince))) throw problem(401,'Sessão encerrada. Entre novamente.');
  let roles;
  try{roles=JSON.parse(env.STAFF_ROLES || '{}');}catch{throw problem(503,'A configuração de acesso da equipe precisa ser revisada.');}
  const role=Object.hasOwn(roles, user.localId)?roles[user.localId]:null;
  if(!Object.hasOwn(ROLES,role))throw problem(403,'Sua conta não está autorizada a acessar os atendimentos.');
  return {uid:user.localId,role};
}
