import { createEntity, type AppState } from './store';

function chunks(text:string){return text.split(/\n+/).map(x=>x.trim()).filter(Boolean);}
export function migrateSettingCards(state:AppState):AppState{
 let next=state;
 for(const source of state.entities){
  if(source.deletedAt||source.kind!=='setting'||!source.workId)continue;
  if(source.category==='characters'&&source.title==='人物档案'){
   const relation=state.entities.find(e=>e.kind==='setting'&&e.category==='characters'&&e.title==='人物关系'&&e.workId===source.workId&&!e.deletedAt);
   const names=[...new Set((relation?.content??'').split('\n').flatMap(line=>{
    const match=line.match(/^(?:CP\s*[一二三四五六七八九十\d]+|父女|同门|旧情)[：:]\s*(.+)$/);
    return match?match[1].replace(/（.*?[）]/g,'').split(/\s*[×—/／]\s*/).map(s=>s.trim()).filter(s=>/^[\p{Script=Han}]{2,12}$/u.test(s)):[];
   }))].filter(name=>!['人皇大羿'].includes(name));
   const lines=chunks(source.content);
   for(const name of names){const id=`derived:character:${source.id}:${name}`;if(next.entities.some(e=>e.id===id))continue;
    const index=lines.indexOf(name);const description=index>=0?lines[index+1]??'':'';
    next=createEntity(next,{id,kind:'setting',title:name,content:description,workId:source.workId,parentId:source.id,category:'characters',meta:{derivedFrom:source.id,cardType:'character'}});
   }
  }
  if(source.category==='map'&&source.title==='地点资料'){
   const lines=chunks(source.content);const start=lines.indexOf('出处')+1;
   for(let i=Math.max(0,start);i+1<lines.length;i+=2){const name=lines[i],description=lines[i+1];if(!/^[\p{Script=Han}]{2,12}$/u.test(name))continue;
    const id=`derived:place:${source.id}:${name}`;if(next.entities.some(e=>e.id===id))continue;
    next=createEntity(next,{id,kind:'setting',title:name,content:description,workId:source.workId,parentId:source.id,category:'map',meta:{derivedFrom:source.id,cardType:'place'}});
   }
  }
 }
 return next;
}
