function imageRequest(input, key) {
  const base = new URL(input.baseUrl);
  const protocol = input.protocol || 'openai';
  if (protocol === 'gemini') {
    return {
      endpoint: new URL(`/v1beta/models/${encodeURIComponent(input.model)}:generateContent`, base),
      headers: {'Content-Type':'application/json','x-goog-api-key':key},
      body: {contents:[{parts:[{text:input.prompt}]}],generationConfig:{responseModalities:['TEXT','IMAGE']}}
    };
  }
  if (protocol !== 'openai') throw new Error('该协议暂不支持生图');
  const endpoint = base.pathname.endsWith('/images/generations') ? base : new URL(`${base.pathname.replace(/\/$/,'')}/images/generations`, base);
  const volcano = base.hostname.endsWith('volces.com');
  return {
    endpoint,
    headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},
    body:volcano ? {model:input.model,prompt:input.prompt,size:'2K',response_format:'url',watermark:false} : {model:input.model,prompt:input.prompt,size:'1024x1024'}
  };
}
function imageResult(payload, protocol) {
  if (protocol === 'gemini') {
    const parts=payload.candidates?.flatMap(c=>c.content?.parts??[])??[];
    const image=parts.find(p=>p.inlineData?.data||p.inline_data?.data);
    if (!image) return null;
    const data=image.inlineData??image.inline_data;
    const mime=data.mimeType??data.mime_type??'image/png';
    if (!['image/png','image/jpeg','image/webp'].includes(mime)) throw new Error('图片模型返回了不支持的格式');
    return `data:${mime};base64,${data.data}`;
  }
  const first=payload.data?.[0];
  if(typeof first?.b64_json==='string')return `data:image/png;base64,${first.b64_json}`;
  if(typeof first?.url==='string')return first.url;
  return null;
}
function imageModelIds(payload, protocol) {
  if(protocol==='gemini')return (payload.models??[]).filter(m=>typeof m.name==='string'&&m.name.includes('-image')&&(!m.supportedGenerationMethods||m.supportedGenerationMethods.includes('generateContent'))).map(m=>m.name.replace(/^models\//,''));
  return (payload.data??[]).map(m=>m.id).filter(id=>typeof id==='string'&&(/^(gpt-image|dall-e)/.test(id)||/seedream/i.test(id)));
}
module.exports={imageRequest,imageResult,imageModelIds};
