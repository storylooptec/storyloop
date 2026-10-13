// Preloaded by the isolated research browser runner: fail any accidental external server request.
const originalFetch=globalThis.fetch;
globalThis.fetch=(input,init)=>{
 const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
 if(!['127.0.0.1','localhost'].includes(url.hostname))throw new Error('Research browser fixture blocked an external request');
 return originalFetch(input,init);
};
