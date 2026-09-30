import { describe,it,expect } from 'vitest';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {imageRequest,imageResult,imageModelIds}=require('../electron/image.cjs');
describe('image providers',()=>{
  it('routes Gemini image requests to generateContent',()=>{
    const request=imageRequest({baseUrl:'https://generativelanguage.googleapis.com',model:'gemini-2.5-flash-image',protocol:'gemini',prompt:'画一张图'},'secret');
    expect(request.endpoint.href).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent');
    expect(request.headers['x-goog-api-key']).toBe('secret');
    expect(request.body.generationConfig.responseModalities).toContain('IMAGE');
  });
  it('extracts Gemini inline images',()=>{
    expect(imageResult({candidates:[{content:{parts:[{text:'完成'},{inlineData:{mimeType:'image/png',data:'YWJj'}}]}}]},'gemini')).toBe('data:image/png;base64,YWJj');
  });
  it('routes OpenAI images to its images endpoint',()=>{
    const request=imageRequest({baseUrl:'https://api.openai.com/v1',model:'gpt-image-2',protocol:'openai',prompt:'dog'},'secret');
    expect(request.endpoint.href).toBe('https://api.openai.com/v1/images/generations');
    expect(request.body).not.toHaveProperty('response_format');
  });
  it('filters image models from provider lists',()=>{
    expect(imageModelIds({models:[{name:'models/gemini-2.5-flash-image',supportedGenerationMethods:['generateContent']},{name:'models/gemini-2.5-flash',supportedGenerationMethods:['generateContent']}]},'gemini')).toEqual(['gemini-2.5-flash-image']);
  });
});
