// Local browser QA only: redirect the real provider boundary to a synthetic fixture.
const originalFetch=globalThis.fetch;
globalThis.fetch=(input,init)=>{
  const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
  if(url.origin==='https://www.searchapi.io'&&url.pathname==='/api/v1/search'){
    return originalFetch(`http://127.0.0.1:4547${url.pathname}${url.search}`,init);
  }
  if(!['127.0.0.1','localhost'].includes(url.hostname))throw new Error('SearchAPI browser test blocked an external request');
  return originalFetch(input,init);
};
