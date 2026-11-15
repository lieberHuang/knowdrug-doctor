const DoctorKnowledgeAPI=(()=>{
 const endpoint='https://101.132.38.176/api/knowledge/stream';
 function valid(data){
  if(typeof data.answer?.title!=='string'||typeof data.answer?.body!=='string'||!Array.isArray(data.followUps)||data.followUps.length!==3||new Set(data.followUps).size!==3||!data.followUps.every(item=>typeof item==='string'&&item.trim()))throw new Error('回答格式不完整，请重新提问');
  return data;
 }
 function historyFor(messages){
  return messages.slice(0,-1).slice(-6).filter(message=>message.role==='user'?message.transport==='deepseek':message.provider==='deepseek'&&message.answer).map(message=>({role:message.role,content:message.role==='user'?message.text:(message.answer.title+'\n'+message.answer.body).slice(0,1000)}));
 }
 async function readEvents(response,onDelta){
  if(!response.body?.getReader)throw new Error('无法读取流式回答，请重试');
  const reader=response.body.getReader(),decoder=new TextDecoder();let pending='',result=null;
  try{
   while(true){
    const part=await reader.read();if(part.done)break;
    pending=(pending+decoder.decode(part.value,{stream:true})).replace(/\r\n/g,'\n');
    let boundary;
    while((boundary=pending.indexOf('\n\n'))!==-1){
     const frame=pending.slice(0,boundary);pending=pending.slice(boundary+2);
     let event='',data='';
     for(const line of frame.split('\n')){if(line.startsWith('event:'))event=line.slice(6).trim();if(line.startsWith('data:'))data+=line.slice(5).trimStart();}
     if(!data)continue;
     const value=JSON.parse(data);
     if(event==='delta'&&typeof value.text==='string')onDelta?.(value.text);
     else if(event==='done')result=valid(value);
     else if(event==='error')throw new Error(value.error||'回答中断，请重试');
    }
   }
   if(!result)throw new Error('回答中断，请重试');
   return result;
  }finally{reader.releaseLock();}
 }
 async function ask(expert,question,messages,signal,onDelta){
  const controller=new AbortController(),onAbort=()=>controller.abort();
  signal?.addEventListener('abort',onAbort,{once:true});if(signal?.aborted)controller.abort();
  const timeout=setTimeout(()=>controller.abort(),115000);
  try{
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expert,question,history:historyFor(messages),audience:'doctor'}),signal:controller.signal});
   if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||'暂时无法获取回答，请稍后重试');}
   if(!response.headers?.get('Content-Type')?.includes('text/event-stream')){const data=valid(await response.json());onDelta?.(data.answer.body);return data;}
   return await readEvents(response,onDelta);
  }catch(error){
   if(error.name==='TypeError')throw new Error('暂时无法连接问答服务，请检查网络后重试');
   if(error.name==='AbortError'&&!signal?.aborted)throw new Error('回答超时，请稍后重试');
   throw error;
  }finally{clearTimeout(timeout);signal?.removeEventListener('abort',onAbort);}
 }
 return {ask};
})();
