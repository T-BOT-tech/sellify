// Provider observation metadata. Descriptive configuration only; it never grants financial authority.
const MANIFEST = Object.freeze({
  telebirr: Object.freeze({ id:'telebirr', name:'Telebirr', type:'mobile', responseType:'html', requiresAccount:false, requiresPhone:false, parser:'telebirr' }),
  cbe: Object.freeze({ id:'cbe', name:'Commercial Bank of Ethiopia', type:'bank', responseType:'pdf', requiresAccount:true, requiresPhone:false, parser:'cbe' }),
  mpesa: Object.freeze({ id:'mpesa', name:'M-Pesa Ethiopia', type:'mobile', responseType:'json', requiresAccount:false, requiresPhone:false, parser:'mpesa' }),
  boa: Object.freeze({ id:'boa', name:'Bank of Abyssinia', type:'bank', responseType:'json', requiresAccount:true, requiresPhone:false, parser:'boa' }),
});
export function getProviderManifest(providerId) { return MANIFEST[String(providerId || '').toLowerCase()] || null; }
export function listProviderManifests() { return Object.values(MANIFEST); }
