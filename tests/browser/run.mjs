import {spawn} from 'node:child_process';
import {setTimeout} from 'node:timers/promises';
import {startMock} from './mock-supabase.mjs';

// Run all services in one process tree. Fixtures never contact a production project.
const fixture=await startMock();
const origin='http://127.0.0.1:3001';
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3001'],{
 env:{...process.env,SUPABASE_URL:'http://127.0.0.1:4545',SUPABASE_PUBLISHABLE_KEY:'test-public-key',SUPABASE_SECRET_KEY:'test-service-key',NEXT_PUBLIC_SITE_URL:origin,
 SERP_API_ENABLED:'false',OPENAI_API_ENABLED:'false',HIGGSFIELD_API_ENABLED:'false',R2_ACCOUNT_ID:'',R2_ACCESS_KEY_ID:'',R2_SECRET_ACCESS_KEY:''},
 stdio:['ignore','pipe','pipe'],
});
let output='';server.stdout.on('data',chunk=>output+=chunk);server.stderr.on('data',chunk=>output+=chunk);
try{
 let ready=false;
 for(let i=0;i<100;i++){
  if(server.exitCode!==null)throw new Error('Next server exited: '+output);
  try{const response=await fetch(origin+'/brand');if(response.ok){ready=true;break;}}catch{}
  await setTimeout(100);
 }
 if(!ready)throw new Error('Next server did not start: '+output);
 process.env.BRAND_TEST_ORIGIN=origin;
 await import('./smoke.mjs');
}finally{server.kill('SIGTERM');fixture.close();}
