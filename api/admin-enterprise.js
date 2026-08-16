'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const {
  ObjectId,
  ADMIN_ROLES,
  authenticateCookieHeader,
  authorizeTicket,
  requestIp,
  hashSensitive,
  enforceRateLimit,
  audit
} = require('./_portal-security');

function send(res,status,payload){res.status(status);res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');return res.json(payload);}
function ok(res,data={},status=200){return send(res,status,{ok:true,...data});}
function fail(res,status,code,message){return send(res,status,{ok:false,error:{code,message}});}
function clean(v,max=500){return typeof v==='string'?v.replace(/\u0000/g,'').trim().slice(0,max):'';}
function email(v){return clean(v,180).toLowerCase();}
function validEmail(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);}
function sameOrigin(req){const origin=req.headers.origin;if(!origin)return true;try{const host=req.headers['x-forwarded-host']||req.headers.host;return !host||new URL(origin).host===host;}catch{return false;}}
async function parseBody(req){if(req.body&&typeof req.body==='object')return req.body;if(typeof req.body==='string'){try{return JSON.parse(req.body||'{}');}catch{return {};}}let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>128*1024)throw new Error('PAYLOAD_TOO_LARGE');}try{return raw?JSON.parse(raw):{};}catch{return {};}}
function generatedPassword(){return `${crypto.randomBytes(16).toString('base64url')}Aa1!`;}
function strongPassword(value){return typeof value==='string'&&value.length>=8&&/[a-z]/.test(value)&&/[A-Z]/.test(value)&&/\d/.test(value)&&/[^A-Za-z0-9]/.test(value);}
function publicTeamUser(u){return{id:String(u._id),name:u.name,email:u.email,role:u.role,active:u.active!==false,forcePasswordChange:u.forcePasswordChange===true,lastLoginAt:u.lastLoginAt||null,createdAt:u.createdAt||null};}
async function limit(session,req,scope,max,windowMs){return enforceRateLimit(session.db,{scope,subject:`${String(session.user._id)}:${requestIp(req)}`,limit:max,windowMs});}
async function requireSession(req,res){const session=await authenticateCookieHeader(req.headers.cookie||'');if(!session||session.kind!=='admin'){fail(res,401,'UNAUTHENTICATED','Sessão administrativa expirada ou inválida.');return null;}if(session.user.forcePasswordChange===true){fail(res,428,'PASSWORD_CHANGE_REQUIRED','Redefina sua senha antes de continuar.');return null;}return session;}
async function ensureLastAdminSafety(db,target,nextRole,nextActive){if(target.role!=='admin')return true;const removingAdmin=nextRole&&nextRole!=='admin';const deactivating=nextActive===false;if(!removingAdmin&&!deactivating)return true;const count=await db.collection('users').countDocuments({_id:{$ne:target._id},role:'admin',active:true});return count>0;}

async function team(req,res,session){
  if(req.method==='GET'){
    const users=await session.db.collection('users').find({role:{$in:ADMIN_ROLES}}).project({passwordHash:0}).sort({name:1}).toArray();
    return ok(res,{team:users.map(publicTeamUser),canManage:session.user.role==='admin'});
  }
  if(!sameOrigin(req))return fail(res,403,'INVALID_ORIGIN','Origem não permitida.');
  if(session.user.role!=='admin')return fail(res,403,'ADMIN_REQUIRED','Somente administradores podem gerenciar acessos da equipe.');
  const rate=await limit(session,req,'admin-team-write',20,60*60*1000);if(!rate.allowed){res.setHeader('Retry-After',String(rate.retryAfter));return fail(res,429,'RATE_LIMITED','Limite de alterações de equipe atingido. Aguarde antes de tentar novamente.');}
  const input=await parseBody(req);
  if(req.method==='POST'){
    const name=clean(input.name,120),userEmail=email(input.email),role=ADMIN_ROLES.includes(input.role)?input.role:'support';
    if(name.length<3)return fail(res,422,'INVALID_NAME','Informe o nome completo do integrante.');
    if(!validEmail(userEmail))return fail(res,422,'INVALID_EMAIL','Informe um e-mail válido.');
    const existing=await session.db.collection('users').findOne({organizationId:session.user.organizationId,email:userEmail,role:{$in:ADMIN_ROLES}});
    if(existing)return fail(res,409,'TEAM_USER_EXISTS','Já existe um acesso da equipe com este e-mail.');
    const temporaryPassword=clean(input.temporaryPassword,200)||generatedPassword();
    if(!strongPassword(temporaryPassword))return fail(res,422,'WEAK_PASSWORD','A senha temporária deve ter no mínimo 8 caracteres, com maiúscula, minúscula, número e símbolo.');
    const now=new Date();
    const doc={organizationId:session.user.organizationId,name,email:userEmail,emailHash:hashSensitive(userEmail,'email-lookup'),role,passwordHash:await bcrypt.hash(temporaryPassword,12),phone:'',active:true,forcePasswordChange:true,sessionVersion:1,passwordUpdatedAt:now,createdBy:session.user._id,createdAt:now,updatedAt:now};
    const inserted=await session.db.collection('users').insertOne(doc);doc._id=inserted.insertedId;
    await audit(session.db,{organizationId:session.user.organizationId,userId:session.user._id,action:'admin.team.created',entityType:'user',entityId:doc._id,metadata:{role,emailHash:doc.emailHash}});
    return ok(res,{user:publicTeamUser(doc),temporaryPassword},201);
  }
  if(req.method==='PATCH'){
    const id=ObjectId.isValid(req.query.id)?new ObjectId(req.query.id):null;if(!id)return fail(res,400,'INVALID_USER','Usuário inválido.');
    const target=await session.db.collection('users').findOne({_id:id,role:{$in:ADMIN_ROLES}});if(!target)return fail(res,404,'TEAM_USER_NOT_FOUND','Acesso da equipe não encontrado.');
    const operation=clean(input.operation,40).toLowerCase();
    if(String(target._id)===String(session.user._id)&&['set_active','change_role'].includes(operation))return fail(res,409,'SELF_PROTECTION','Você não pode desativar ou reduzir o próprio acesso por esta tela.');
    const now=new Date();let update={updatedAt:now};let temporaryPassword=null;
    if(operation==='set_active'){
      const active=input.active===true;
      if(!(await ensureLastAdminSafety(session.db,target,null,active)))return fail(res,409,'LAST_ADMIN','É necessário manter pelo menos um administrador ativo.');
      update.active=active;update.sessionVersion=Number(target.sessionVersion||1)+1;
    }else if(operation==='change_role'){
      const role=ADMIN_ROLES.includes(input.role)?input.role:null;if(!role)return fail(res,422,'INVALID_ROLE','Perfil inválido.');
      if(!(await ensureLastAdminSafety(session.db,target,role,null)))return fail(res,409,'LAST_ADMIN','É necessário manter pelo menos um administrador ativo.');
      update.role=role;update.sessionVersion=Number(target.sessionVersion||1)+1;
    }else if(operation==='reset_password'){
      temporaryPassword=clean(input.temporaryPassword,200)||generatedPassword();
      if(!strongPassword(temporaryPassword))return fail(res,422,'WEAK_PASSWORD','A senha temporária deve ter no mínimo 8 caracteres, com maiúscula, minúscula, número e símbolo.');
      update.passwordHash=await bcrypt.hash(temporaryPassword,12);update.forcePasswordChange=true;update.passwordUpdatedAt=now;update.sessionVersion=Number(target.sessionVersion||1)+1;
    }else{return fail(res,422,'INVALID_OPERATION','Operação de equipe inválida.');}
    await session.db.collection('users').updateOne({_id:id},{$set:update});
    const changed=await session.db.collection('users').findOne({_id:id});
    await audit(session.db,{organizationId:target.organizationId,userId:session.user._id,action:`admin.team.${operation}`,entityType:'user',entityId:id,metadata:{targetEmailHash:hashSensitive(target.email,'email-lookup'),role:changed.role,active:changed.active!==false}});
    return ok(res,{user:publicTeamUser(changed),...(temporaryPassword?{temporaryPassword}:{})});
  }
  return fail(res,405,'METHOD_NOT_ALLOWED','Método não permitido.');
}

async function transfer(req,res,session){
  const id=ObjectId.isValid(req.query.id)?String(req.query.id):null;if(!id)return fail(res,400,'INVALID_TICKET','Chamado inválido.');
  const ticket=await authorizeTicket(session,id);if(!ticket)return fail(res,404,'TICKET_NOT_FOUND','Chamado não encontrado.');
  if(req.method==='GET'){
    const history=await session.db.collection('ticket_transfers').find({ticketId:ticket._id}).sort({createdAt:-1}).limit(30).toArray();
    return ok(res,{transfers:history.map(item=>({id:String(item._id),fromId:item.fromId?String(item.fromId):null,fromName:item.fromName||'',toId:item.toId?String(item.toId):null,toName:item.toName||'',byId:String(item.byId),byName:item.byName,reason:item.reason,eventType:item.eventType||'transfer',eventLabel:item.eventLabel||'Transferência',createdAt:item.createdAt}))});
  }
  if(req.method!=='POST')return fail(res,405,'METHOD_NOT_ALLOWED','Método não permitido.');
  if(!sameOrigin(req))return fail(res,403,'INVALID_ORIGIN','Origem não permitida.');
  const rate=await limit(session,req,'ticket-transfer',40,10*60*1000);if(!rate.allowed){res.setHeader('Retry-After',String(rate.retryAfter));return fail(res,429,'RATE_LIMITED','Muitas alterações de responsável em pouco tempo.');}
  const input=await parseBody(req);const reason=clean(input.reason,500);const wantsUnassign=input.unassign===true;let assignee=null;
  if(!wantsUnassign){const assignedId=ObjectId.isValid(input.assignedTo)?new ObjectId(input.assignedTo):null;if(!assignedId)return fail(res,422,'INVALID_ASSIGNEE','Selecione o novo responsável.');if(ticket.assignedTo&&String(ticket.assignedTo)===String(assignedId))return fail(res,409,'ALREADY_ASSIGNED','Este integrante já é o responsável pelo chamado.');assignee=await session.db.collection('users').findOne({_id:assignedId,role:{$in:ADMIN_ROLES},active:true});if(!assignee)return fail(res,422,'INVALID_ASSIGNEE','O novo responsável não está ativo na equipe.');}
  else if(!ticket.assignedTo)return fail(res,409,'ALREADY_UNASSIGNED','Este chamado já está sem responsável.');
  const isInitialAssignment=!ticket.assignedTo&&!wantsUnassign;
  if(!isInitialAssignment&&reason.length<3)return fail(res,422,'TRANSFER_REASON_REQUIRED',wantsUnassign?'Informe o motivo para deixar o chamado sem responsável.':'Informe o motivo da transferência.');
  const effectiveReason=reason||(isInitialAssignment?'Atribuição inicial pelo painel administrativo.':'Alteração de responsável.');
  const previous=ticket.assignedTo?await session.db.collection('users').findOne({_id:ticket.assignedTo}):null;const now=new Date();
  const eventType=wantsUnassign?'unassign':(isInitialAssignment?'assign':'transfer');const eventLabel=wantsUnassign?'Desatribuição':(isInitialAssignment?'Atribuição inicial':'Transferência');
  const set={assignedTo:assignee?assignee._id:null,assignedAt:assignee?now:null,assignedBy:session.user._id,updatedAt:now};if(assignee&&ticket.status==='aberto')set.status='em_atendimento';
  await session.db.collection('tickets').updateOne({_id:ticket._id},{$set:set});
  const log={ticketId:ticket._id,organizationId:ticket.organizationId,fromId:previous?previous._id:null,fromName:previous?.name||'',toId:assignee?assignee._id:null,toName:assignee?.name||'Não atribuído',byId:session.user._id,byName:session.user.name,reason:effectiveReason,eventType,eventLabel,createdAt:now};
  const inserted=await session.db.collection('ticket_transfers').insertOne(log);log._id=inserted.insertedId;
  await audit(session.db,{organizationId:ticket.organizationId,userId:session.user._id,action:`ticket.${eventType}`,entityType:'ticket',entityId:ticket._id,metadata:{ticketNumber:ticket.ticketNumber,from:previous?hashSensitive(String(previous._id),'user-id'):null,to:assignee?hashSensitive(String(assignee._id),'user-id'):null,reason:effectiveReason}});
  return ok(res,{transfer:{id:String(log._id),fromName:log.fromName,toName:log.toName,byName:log.byName,reason:effectiveReason,eventType,eventLabel,createdAt:now},assignment:{assignedTo:assignee?String(assignee._id):null,assignedName:assignee?.name||''}});
}

module.exports=async function handler(req,res){
  try{
    const session=await requireSession(req,res);if(!session)return;
    const general=await limit(session,req,'admin-enterprise',180,60*1000);if(!general.allowed){res.setHeader('Retry-After',String(general.retryAfter));return fail(res,429,'RATE_LIMITED','Muitas requisições. Aguarde alguns instantes.');}
    const action=clean(req.query.action,40).toLowerCase();
    if(action==='team')return team(req,res,session);
    if(action==='transfer')return transfer(req,res,session);
    return fail(res,404,'NOT_FOUND','Rota administrativa não encontrada.');
  }catch(error){console.error('ADMIN_ENTERPRISE_ERROR',error);if(error.message==='PAYLOAD_TOO_LARGE')return fail(res,413,'PAYLOAD_TOO_LARGE','Requisição muito grande.');if(error.code==='MONGODB_URI_NOT_CONFIGURED'||error.code==='PORTAL_SECRETS_NOT_CONFIGURED')return fail(res,503,'PORTAL_NOT_CONFIGURED','O portal ainda não foi configurado no ambiente de hospedagem.');return fail(res,500,'INTERNAL_ERROR','Não foi possível concluir a operação administrativa.');}
};
