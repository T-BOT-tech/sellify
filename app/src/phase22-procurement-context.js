// Phase 22.3 — derived Procurement Context composition.
// Composes authoritative observations from Discovery, Supply Intelligence,
// Cross-Border, and Procurement. It owns no transaction or persistent state.
export const PHASE22_PROCUREMENT_CONTEXT_VERSION='1.0';
const STATES=Object.freeze(['READY','INCOMPLETE','UNKNOWN']);
function invalid(m){const e=new TypeError(`Invalid Phase 22 procurement context: ${m}`);e.code='PHASE22_PROCUREMENT_CONTEXT_INVALID';throw e;}
function obj(v,f){if(!v||typeof v!=='object'||Array.isArray(v))invalid(`${f} must be an object`);return v;}
function text(v,f){const s=String(v??'').trim();if(!s)invalid(`${f} must be a non-empty string`);return s;}
function optional(v){return v==null||v===''?null:String(v).trim()||null;}
function ref(v,f){if(v==null)return null;obj(v,f);const id=text(v.id,f+'.id');const authority=optional(v.authority);if(!authority)invalid(`${f}.authority is required`);return Object.freeze({authority,id});}
function freeze(v){if(v==null||typeof v!=='object')return v;if(Array.isArray(v))return Object.freeze(v.map(freeze));return Object.freeze(Object.fromEntries(Object.entries(v).map(([k,x])=>[k,freeze(x)])));}
export function defineProcurementContext(input={}){obj(input,'context');const intent=ref(input.intent,'intent');if(!intent||intent.authority!=='ai_intent_boundary')invalid('intent must reference ai_intent_boundary');
 const discovery=freeze(input.discovery||null), supply=freeze(input.supplyIntelligence||null), crossBorder=freeze(input.crossBorder||null), procurement=freeze(input.procurement||null), evidence=freeze(input.evidence||null);
 const provided=[discovery,supply,crossBorder,procurement,evidence].filter(Boolean).length;
 const state=provided===0?'UNKNOWN':(provided<5?'INCOMPLETE':'READY');
 if(!STATES.includes(state))invalid('invalid context state');
 return Object.freeze({version:PHASE22_PROCUREMENT_CONTEXT_VERSION,intent,discovery,supplyIntelligence:supply,crossBorder,procurement,evidence,state,derived:true,persistence:'none',mutation:false,authorization:false,transactionExecution:false,providerExecution:false,supplierAuthority:'existing supplier network authority',discoveryAuthority:'existing discovery authority',procurementAuthority:'existing procurement authority',principle:'derived procurement context only; referenced authorities retain source of truth'});}
export function assertProcurementContextBoundary(input){const c=defineProcurementContext(input);if(c.persistence!=='none'||c.mutation!==false||c.authorization!==false||c.transactionExecution!==false||c.providerExecution!==false)invalid('context boundary invariants violated');return true;}
export function phase22ProcurementContextContract(){return Object.freeze({version:PHASE22_PROCUREMENT_CONTEXT_VERSION,states:[...STATES],sourceAuthorities:['discovery','supplier_network','phase21_supply_intelligence','phase20_cross_border','existing procurement authority'],persistence:'none',mutation:false,authorization:false,transactionExecution:false,providerExecution:false});}
