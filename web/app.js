/* Atlas workbench. Static facts, declared grouping and runtime observations stay separate. */
const $ = (q, root=document) => root.querySelector(q);
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={
 map:'M3 3h6v6H3zM15 3h6v6h-6zM9 15h6v6H9zM6 9v3h12V9M12 12v3',
 play:'m8 5 11 7-11 7z', pause:'M8 5v14M16 5v14', step:'m5 5 10 7-10 7zM19 5v14', reset:'M3 10a9 9 0 1 1 2 8M3 4v6h6',
 rocket:'M12 3c4 1 6 5 6 9l-6 5-6-5c0-4 2-8 6-9ZM9 17l-2 4m8-4 2 4M10 9h4M6 12l-3 3v3l5-2m10-4 3 3v3l-5-2',
 request:'m8 4-6 8 6 8M16 4l6 8-6 8M14 3l-4 18',
 screen:'M3 4h18v13H3zM8 21h8M12 17v4',
 database:'M20 6c0 2-16 2-16 0s16-2 16 0ZM4 6v12c0 3 16 3 16 0V6M4 12c0 3 16 3 16 0',
 shield:'m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM9 12l2 2 4-4',
 code:'m8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18',
 folder:'M3 5h6l2 3h10v12H3z',
 search:'M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
 upload:'M12 16V3m-5 5 5-5 5 5M3 15v6h18v-6',
 download:'M12 3v13m-5-5 5 5 5-5M3 17v4h18v-4',
 chevron:'m9 5 7 7-7 7',chevrondown:'m5 9 7 7 7-7',close:'m6 6 12 12M6 18 18 6',
 layers:'m12 3 10 5-10 5L2 8zM2 12l10 5 10-5M2 16l10 5 10-5',
 server:'M3 3h18v7H3zM3 14h18v7H3zM7 6.5h.01M7 17.5h.01',
 flow:'M3 6h6v6H3zM15 12h6v6h-6zM9 9h5a4 4 0 0 1 4 4M3 18h5',
 plus:'M12 5v14M5 12h14',minus:'M5 12h14',fit:'M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5',
 info:'M12 11v6M12 7h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
 file:'M13 2H4v20h16V9zM13 2v7h7M8 13h8M8 17h5',
 check:'m5 12 4 4L19 6',clock:'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
 branch:'M6 3v13a4 4 0 0 0 8 0V8M4 3h4M12 4h4v4h-4z',
 table:'M3 3h18v18H3zM3 9h18M9 9v12',link:'m9 15 6-6M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 12a4 4 0 0 0 6 0l5-5a4 4 0 0 0-6-6l-1 1',
 box:'m12 3 9 5v10l-9 4-9-4V8zM3 8l9 5 9-5M12 13v9',
 arrow:'M4 12h16m-6-6 6 6-6 6',terminal:'m4 6 6 6-6 6m9 0h7',eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
 phone:'M7 2h10v20H7zM10 18h4',monitor:'M2 3h20v14H2zM8 22h8M12 17v5',settings:'M3 6h18M7 3v6M3 12h18M16 9v6M3 18h18M10 15v6'
};
const icon=(name,cls='')=>`<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.box}"/></svg>`;
const kindIcon = k => ({process:'server',database:'database',table:'table',layer:'layers',file:'file',function:'code',type:'box',library:'box',policy:'shield'})[k]||'code';
const evidence = e => ({declared:['结构声明','blue'],extracted:['静态提取','gray'],observed:['运行观测','green'],inferred:['推断关系','amber'],unresolved:['未解析','amber'],imported:['外部导入','gray']})[e]||['未标记','gray'];
const badge = e => {const [s,c]=evidence(e);return `<span class="pill ${c}"><i class="dot"></i>${s}</span>`};
const btn=(text,action,ic='',cls='',extra='')=>`<button class="btn ${cls}" data-action="${action}" ${extra}>${ic?icon(ic):''}${text}</button>`;
const offline = Boolean(window.__ATLAS_SNAPSHOT__);
const s={graph:null,view:'architecture',scope:null,selected:'api',inspectorTab:'overview',run:null,step:-1,playing:false,startup:null,dataset:null,table:'members',row:null,layout:null,sourcePath:null,libs:false,zoom:1,pan:{x:0,y:0},modal:null,search:'',viewport:'desktop',history:[],busy:false,request:{method:'GET',scenario:'normal',body:'{\n  "name": "新成员",\n  "email": "new@example.test",\n  "team_id": "t-product"\n}',key:''},dataMode:'current'};
let timer=null, toastTimer, renderCounter=0;
const nav=[['architecture','map','架构地图'],['startup','rocket','启动过程'],['requests','request','请求实验室'],['frontend','screen','前端观察'],['data','database','数据地图'],['policies','shield','隐含机制'],['source','code','源码索引']];
const heads={architecture:['ARCHITECTURE','看见整个系统','从进程与资源开始，按需要逐层展开实现。'],startup:['LIFECYCLE','系统如何启动','从配置加载到开始监听，查看真实采集的启动里程碑。'],requests:['REQUEST LAB','让请求走一遍','发送真实请求，再沿同一次运行进入代码和数据。'],frontend:['UI OBSERVATORY','从页面进入实现','操作真实页面，连接事件、接口、源码和布局。'],data:['DATA EXPLORER','每一行，都有来处','浏览表结构与实体，区分当前数据和本次查询快照。'],policies:['POLICY LENS','看见隐藏的机制','查看重试、超时、事务和 ID 的实现位置与作用范围。'],source:['SOURCE EXPLORER','抵达具体实现','编译器提取的符号、源行和相关调用。']};
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3600)}
async function api(path,data){const response=await fetch(path,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});const out=await response.json();if(!response.ok)throw new Error(out.error||`HTTP ${response.status}`);return out}
function node(id){return s.graph?.nodes.find(n=>n.id===id)}
function children(id){return s.graph.nodes.filter(n=>n.parent===id&&(s.libs||n.kind!=='library'))}
function childCount(id){return s.graph.nodes.filter(n=>n.parent===id&&n.kind!=='library').length}
function sourceFor(event){return s.graph.nodes.find(n=>n.source?.path===event.source&&n.label===event.symbol)}
function selectedNode(){return s.graph.nodes.find(n=>n.id===s.selected)||s.graph.policies?.find(n=>n.id===s.selected)}
function notice(text,blue=false){return `<div class="notice ${blue?'blue':''}">${icon('info')}<span>${esc(text)}</span></div>`}
function empty(title,description,ic='eye'){return `<div class="empty-state">${icon(ic)}<h3>${title}</h3><p>${description}</p>${s.graph.mode!=='demo'?btn('返回全栈示例','demo','arrow'):''}</div>`}
function enabled(){return s.graph.mode==='demo'&&(s.graph.capabilities.runtime||offline)}
function heading(){const [en,title,sub]=heads[s.view];return `<header class="page-heading"><div><div class="overline">${en}<span style="letter-spacing:0;margin-left:10px;color:#bcc3d0">/ 01</span></div><h1>${title}</h1><p>${sub}</p></div><div class="page-actions">${btn('导出快照','export','download','ghost')}${btn('使用指南','help','info')}</div></header>`}
function stats(){const counts=[s.graph.nodes.filter(n=>n.kind==='process').length,new Set(s.graph.nodes.filter(n=>n.kind==='function').map(n=>n.language)).size,s.graph.nodes.filter(n=>n.kind==='function').length,s.graph.policies?.length||0];return `<div class="stats">${[['server','进程 / 应用'],['code','解析语言'],['flow','已提取函数'],['shield','已绑定机制']].map(([i,l],k)=>`<div class="stat"><div class="stat-icon">${icon(i)}</div><div><strong>${counts[k].toString().padStart(2,'0')}</strong><span>${l}</span></div></div>`).join('')}</div>`}
function breadcrumbs(){let chain=[],n=node(s.scope),seen=new Set();while(n&&!seen.has(n.id)){seen.add(n.id);chain.unshift(n);n=node(n.parent)}return `<div class="breadcrumbs"><button data-action="scope" data-id="">${icon('folder')} 项目</button>${chain.map(n=>`${icon('chevron')}<button data-action="scope" data-id="${esc(n.id)}">${esc(n.label)}</button>`).join('')}${!chain.length?`${icon('chevron')}<strong>${esc(s.graph.name)}</strong>`:''}</div>`}
function visibleGraph(){
 let nodes=children(s.scope),idset=new Set(nodes.map(n=>n.id));
 if(!nodes.length&&s.scope){const n=node(s.scope);nodes=n?[n]:[];idset=new Set(nodes.map(n=>n.id))}
 const top=id=>{let n=node(id),seen=new Set();while(n&&!seen.has(n.id)){if(idset.has(n.id))return n.id;seen.add(n.id);n=node(n.parent)}return null};
 if(s.scope){
  for(const e of s.graph.edges){
   const other=node(e.target);
   if(top(e.source)&&!top(e.target)&&other&&['process','database'].includes(other.kind)&&!idset.has(other.id)){
    nodes.push(other);idset.add(other.id);
   }
  }
 }
 const edges=[],unique=new Set();
 for(const e of s.graph.edges){const a=top(e.source),b=top(e.target);if(a&&b&&a!==b&&!unique.has(a+'|'+b+'|'+e.relation)){unique.add(a+'|'+b+'|'+e.relation);edges.push({...e,source:a,target:b})}}
 return {nodes:nodes.slice(0,40),edges,total:nodes.length};
}
function activeNode(id){
 const event=s.run?.events?.[s.step];if(!event)return false;
 if(id==='database'&&event.kind==='query')return true;
 if(id===event.service)return true;
 let n=sourceFor(event),seen=new Set();while(n&&!seen.has(n.id)){if(n.id===id)return true;seen.add(n.id);n=node(n.parent)}return false;
}
function graphView(){
 const g=visibleGraph(),count=g.nodes.length;
 const cols=Math.min(count,4)||1, rows=Math.ceil(count/cols);
 const worldW=Math.max(700,cols*266+52),worldH=Math.max(420,rows*180+90);
 const positions=new Map(g.nodes.map((n,i)=>[n.id,{x:42+(i%cols)*266,y:count<=4?145:66+Math.floor(i/cols)*180}]));
 const edgeMarkup=g.edges.filter(e=>positions.has(e.source)&&positions.has(e.target)).slice(0,70).map(e=>{
  const a=positions.get(e.source),b=positions.get(e.target),forward=b.x>a.x;
  const x1=a.x+(forward?200:0),x2=b.x+(forward?0:200),y1=a.y+60,y2=b.y+60;
  const mid=(x1+x2)/2;return `<path d="M${x1} ${y1} C${mid} ${y1},${mid} ${y2},${x2} ${y2}" fill="none" stroke="#bdc7db" stroke-width="1.4" ${e.evidence==='inferred'?'stroke-dasharray="5 4"':''} marker-end="url(#arrowhead)"/><rect x="${mid-43}" y="${(y1+y2)/2-82}" width="86" height="17" rx="4" fill="#fcfdff"/><text class="edge-label" x="${mid}" y="${(y1+y2)/2-70}" text-anchor="middle">${esc(e.label||e.relation)}</text>`
 }).join('');
 const grouping=s.graph.mode==='demo'&&!s.scope?'<div class="group-box" style="left:288px;top:103px;width:496px;height:218px"><span>BACKEND SERVICES · 2 个独立进程</span></div>':'';
 return `<section class="workspace"><div class="workspace-head">${breadcrumbs()}<div class="toolbar"><button class="btn small ${s.libs?'':'ghost'}" data-action="libraries">${icon('layers')} ${s.libs?'收起依赖':'基础依赖'}</button><span class="divider"></span><button class="icon-btn" data-action="fit" aria-label="适应画布">${icon('fit')}</button></div></div><div class="graph-stage" id="graph-stage"><div class="graph-hint">单击查看说明 · 双击进入下一层 · 拖动画布</div><div class="graph-world" id="graph-world" data-width="${worldW}" data-height="${worldH}" style="width:${worldW}px;height:${worldH}px">${grouping}<svg style="width:${worldW}px;height:${worldH}px"><defs><marker id="arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 10 5 0 10" fill="#bdc7db"/></marker></defs>${edgeMarkup}</svg>${g.nodes.map(n=>{const p=positions.get(n.id);return `<button class="graph-node ${n.id===s.selected?'selected':''} ${activeNode(n.id)?'executing':''}" data-action="select" data-id="${esc(n.id)}" style="left:${p.x}px;top:${p.y}px" title="${esc(n.label)}"><div class="node-top"><span class="node-icon ${n.kind}">${icon(kindIcon(n.kind))}</span><span class="node-language">${esc(n.language)}</span></div><h3>${esc(n.label)}</h3><p>${esc(n.summary.split('\n')[0])}</p><div class="node-footer"><span>${childCount(n.id)?`${childCount(n.id)} 个子节点`:(n.kind==='database'?'持久化资源':n.source?`${esc(n.source.path.split('/').pop())}:${n.source.line}`:'外部依赖')}</span><span>${childCount(n.id)?'展开 '+icon('chevron'):evidence(n.evidence)[0]}</span></div></button>`}).join('')}</div><div class="zoom-floater"><button class="icon-btn" data-action="zoom-out" aria-label="缩小">${icon('minus')}</button><span id="zoom-label">100%</span><button class="icon-btn" data-action="zoom-in" aria-label="放大">${icon('plus')}</button><button class="icon-btn" data-action="fit" aria-label="重置画布">${icon('fit')}</button></div><div class="mini-map"><svg viewBox="0 0 ${worldW} ${worldH}">${g.nodes.map(n=>{const p=positions.get(n.id);return `<rect x="${p.x}" y="${p.y}" width="200" height="116" rx="8" fill="${s.selected===n.id?'#bdc5f4':'#e7ebf3'}"/>`}).join('')}</svg></div></div><div class="graph-legend"><div class="items"><span><i class="legend-line"></i> 已声明 / 静态关系</span><span><i class="legend-line dashed"></i> 推断关系</span></div><span>${Math.min(g.total,40)} / ${g.total} 节点 · ${s.libs?'含基础依赖':'渐进式披露'}</span></div></section>`;
}
function architecture(){return `${stats()}${graphView()}<div class="info-grid"><div class="info-card"><div class="info-card-top">${icon('eye')} 先理解职责，再进入实现</div><p>图上的每个节点都是入口。展开进程查看分层，选择函数阅读黑盒说明与具体源码。</p></div><div class="info-card"><div class="info-card-top">${icon('shield')} 关系与运行不是一回事</div><p>静态关系不代表已经执行。发送一次真实请求，才会出现独立的运行记录与数据快照。</p></div></div>${notice(s.graph.notice)}`}
function startupView(){
 if(!enabled())return empty('此项目尚未接入运行采集','静态源码已经可浏览；没有启动记录时，不从调用图伪造执行顺序。','rocket');
 if(!s.startup)return '<div class="skeleton">读取启动记录…</div>';
 const events=s.startup.events||[];
 return `${notice('下面是本次启动显式采集的里程碑。Client 创建不代表完成连接；每个进程独立记录，未宣称覆盖全部语句。',true)}<div class="service-lanes">${[['storage','Member Service','Python'],['api','Member API','Go']].map(([id,label,lang])=>`<section><div class="lane-label">${icon('server')} ${label}<span class="pill gray">${lang}</span></div><div class="step-list">${events.map((e,i)=>({...e,index:i})).filter(e=>e.service===id).map((e,k)=>`<button class="step-row ${s.run?.kind==='startup'&&s.step===e.index?'active':''}" data-action="startup-step" data-index="${e.index}"><span class="step-number">${k+1}</span><div class="step-content"><h3>${esc(e.label)}</h3><p>${esc(e.symbol)} · PID ${e.pid||'已记录'}</p></div>${icon('chevron')}</button>`).join('')}</div></section>`).join('')}</div><div class="info-card"><div class="info-card-top">${icon('play')} 按阶段回放</div><p style="margin-bottom:12px">回放只改变当前选择，不会重新启动服务，也不会重复写入数据库。</p>${btn('回放启动里程碑','startup-play','play','primary')}</div>`;
}
function requestView(){
 if(!enabled())return empty('静态项目没有可发送的目标','接口调试只连接内置隔离示例，不会执行上传的源码或请求任意外部地址。','request');
 const run=s.run?.kind==='request'?s.run:null;
 return `${offline?'<div class="offline-banner">离线预览 · 下方播放的是随文件保存的真实采集记录。不会发送请求或修改数据库。</div>':''}<div class="request-layout"><section class="request-form"><div class="card-title">请求设置<span class="pill gray">DEMO ONLY</span></div><div class="form-body"><div class="method-row"><select id="req-method" aria-label="请求方法" ${offline?'disabled':''}><option ${s.request.method==='GET'?'selected':''}>GET</option><option ${s.request.method==='POST'?'selected':''}>POST</option></select><code>/members</code></div><div class="field"><label for="req-scenario">运行场景</label><select id="req-scenario"><option value="normal" ${s.request.scenario==='normal'?'selected':''}>正常请求</option><option value="fail_once" ${s.request.scenario==='fail_once'?'selected':''}>首次 503 → 等待 → 重试</option></select></div>${s.request.method==='POST'?`<div class="field"><label for="req-body">JSON 请求体</label><textarea id="req-body" spellcheck="false">${esc(s.request.body)}</textarea></div><div class="field"><label for="req-key">幂等键 · 可选</label><input id="req-key" value="${esc(s.request.key)}" placeholder="same-operation-key"></div>`:`<div class="notice" style="margin-bottom:16px;font-size:10px">GET 在首次网络 / 5xx 失败后最多重试一次。场景注入只作用于内置示例。</div>`}${btn(s.busy?'请求处理中…':offline?'载入已采集记录':'发送请求','send','play','primary full',s.busy?'disabled':'')}<p class="muted" style="font-size:9px;margin-top:10px">JavaScript → Go → Python → SQLite</p></div></section><section class="response-card"><div class="card-title">${run?`${icon('check')} 响应结果`:'等待一次运行'}${run?`<span class="pill ${run.status<400?'green':'amber'}">${run.status} · ${run.duration_ms} ms</span>`:''}</div>${run?`<div class="response-body">${esc(JSON.stringify(run.response.data??run.response,null,2))}</div><div class="table-footer"><span class="mono">${run.id.slice(0,12)}</span><span>实际响应 · 已保存快照</span></div>`:`<div class="response-empty">${icon('flow')}<p>一条请求，一条可追溯的路径。</p><p style="margin-top:6px;font-size:10px">响应、调用步骤和实际查询行将在这里出现。</p></div>`}</section></div>${run?runOverview(run):notice('发送一次请求后，底部时间线会记录调用与状态。你可以逐步展开 StorageClient、事务和具体 SQL。',true)}`;
}
function runOverview(run){const services=[['api','Go API'],['storage','Python Service'],['database','SQLite']];return `<div class="workspace"><div class="workspace-head"><span class="view-label">${icon('flow')} 此次请求的进程路径</span>${badge('observed')}</div><div style="display:flex;gap:10px;align-items:center;padding:23px">${services.filter(([id])=>id==='database'?run.events.some(e=>e.kind==='query'):run.events.some(e=>e.service===id)).map(([id,label],i)=>`${i?`<span class="muted">${icon('arrow')}</span>`:''}<button class="link-card" style="margin:0;flex:1" data-action="select" data-id="${id}"><span class="node-icon ${id==='database'?'database':''}">${icon(id==='database'?'database':'server')}</span><span>${label}<small>${id==='database'?'本次 SQL 观测':run.events.filter(e=>e.service===id).length+' 条步骤记录'}</small></span></button>`).join('')}</div></div>`}
function frontendView(){
 if(!enabled())return empty('前端运行适配尚未连接','导入图谱不会自动执行未知前端。内置示例可演示页面、源码、DOM 和后端的联动。','screen');
 if(offline)return `<div class="offline-banner">离线预览没有运行页面或服务。下面是采集到的结果，打开完整项目后可直接操作真实页面。</div>${dataView(true)}`;
 const width=s.viewport==='mobile'?375:s.viewport==='tablet'?620:900;
 return `<section class="workspace"><div class="workspace-head"><span class="view-label">${icon('screen')} members / 团队成员</span><div class="viewport-buttons">${[['desktop','monitor'],['tablet','screen'],['mobile','phone']].map(([v,i])=>`<button class="icon-btn ${s.viewport===v?'active':''}" aria-label="${v} 视口" data-action="viewport" data-value="${v}">${icon(i)}</button>`).join('')}</div></div><div class="preview-shell"><iframe id="live-preview" title="真实成员应用" src="/demo/index.html" style="width:${width}px" sandbox="allow-scripts allow-same-origin allow-forms"></iframe></div><div class="graph-legend"><span>${s.viewport} · iframe 内的真实布局</span><span>点击成员行检查 DOM 与源码</span></div></section>${notice('页面操作将真实经过 Go 和 Python 服务。点击成员行只做检查；提交表单会写入隔离示例数据库。')}`;
}
function getRows(){if(s.dataMode==='snapshot'&&s.run){const event=s.run.events.findLast(e=>Array.isArray(e.rows));return event?.rows||[]}return s.dataset?.[s.table]?.rows||[]}
function dataView(compact=false){
 if(!enabled())return empty('尚未连接此项目的数据源','表结构与实体映射、实际数据行是不同层次。外部静态图不会混入示例数据库。','database');
 if(!s.dataset)return '<div class="skeleton">读取 SQLite 模式与数据…</div>';
 const rows=getRows(),columns=s.dataMode==='snapshot'&&rows.length?Object.keys(rows[0]):(s.dataset[s.table]?.columns||[]).map(c=>c.name);
 return `${!compact?`<section class="workspace"><div class="workspace-head"><span class="view-label">${icon('database')} SQLite / demo.sqlite</span><span class="pill green">关系与实体</span></div><div class="table-layout">${['members','teams'].map((table,i)=>`${i?'<div class="schema-connection">team_id<br>→ id</div>':''}<div class="schema-card ${s.table===table?'selected':''}"><button class="schema-title full" data-action="table" data-value="${table}">${icon('table')} ${table}</button>${s.dataset[table].columns.map(c=>`<div class="schema-field"><span>${c.pk?'◇ ':''}${esc(c.name)}</span><b>${esc(c.type)}${c.pk?' · PK':''}</b></div>`).join('')}</div>`).join('')}</div></section>`:''}<section class="workspace"><div class="workspace-head"><span class="view-label">${icon('table')} ${esc(s.table)}<span class="number-badge">${rows.length} rows</span></span><div class="data-controls">${s.run?.events.some(e=>Array.isArray(e.rows))?btn(s.dataMode==='current'?'查看本次快照':'返回当前数据','data-mode','clock','small'):''}${btn('刷新','refresh-rows','reset','small',offline?'disabled':'')}${btn('实体','entity','code','small')}</div></div><div class="table-scroll"><table class="data-table"><thead><tr>${columns.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((row,i)=>`<tr data-action="row" data-index="${i}" class="${s.row?.id===row.id?'selected':''}" tabindex="0" aria-label="查看数据行 ${esc(row.name||row.id)}">${columns.map(c=>`<td title="${esc(row[c])}">${esc(row[c])}</td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="table-footer"><span>${s.dataMode==='snapshot'?'本次运行的结果快照 · 不是当前数据库':offline?'导出时采集的数据快照':'当前隔离数据库 · 不冒充旧运行结果'}</span><span>只读浏览</span></div></section>${!compact?notice('members.name / email 来自成员表，team 来自 teams.name。当前示例映射是显式定义；不宣称已实现任意 ORM 或行级血缘自动恢复。'):''}`;
}
function policyView(){if(!s.graph.policies?.length)return empty('没有已绑定的机制识别结果','代码索引仍然可用。本版机制卡来自内置示例的显式源码绑定，尚未实现任意仓库的通用策略推导。','shield');return `<div class="policy-grid">${s.graph.policies.map(p=>`<button class="policy-card ${s.selected===p.id?'selected':''}" data-action="policy" data-id="${p.id}"><div class="policy-top">${icon('shield')} ${esc(p.label)}<span class="pill gray">${esc(p.owner)}</span></div><strong>${esc(p.value)}</strong><p>${esc(p.summary)}</p><div class="policy-bottom">${icon('file')} ${esc(p.source.path.split('/').pop())}:${p.source.line}${icon('arrow')}</div></button>`).join('')}</div>${notice('机制卡中的解释和来源绑定为本版示例配置。源码值可点击核查；自动发现机制、解析库默认值和环境覆盖仍在后续范围。')}`}
function codeBlock(source,line=1,end=null){const lines=source.split('\n');return `<div class="source">${lines.map((text,i)=>`<div class="code-line ${i+1>=line&&i+1<=(end??line)?'highlight':''}"><span class="line-no">${i+1}</span><span class="line-code">${esc(text)}</span></div>`).join('')}</div>`}
function sourceView(){const sources=Object.keys(s.graph.sources||{});if(!sources.length)return empty('图谱没有携带源码正文','可以查看节点位置；要阅读具体实现，请导入项目文本。外部文件路径不会自动被服务器读取。','code');const selected=selectedNode();const path=s.sourcePath||selected?.source?.path||sources[0];return `<div class="source-layout"><div class="file-list"><div class="overline" style="padding:8px 9px 15px">PROJECT FILES</div>${sources.map(p=>`<button class="file-item ${path===p?'selected':''}" data-action="source-file" data-path="${esc(p)}">${icon('file')}${esc(p)}</button>`).join('')}</div><div class="workspace" style="padding:15px;min-width:0"><div class="view-label mono">${icon('code')} ${esc(path)}</div>${codeBlock(s.graph.sources[path]||'',selected?.source?.path===path?selected.source.line:1,selected?.source?.path===path?selected.source.end:null)}</div></div>`}
function traceDock(){
 if(!s.run?.events?.length)return '';
 return `<section class="trace-dock"><div class="trace-head"><h3>${icon('flow')} ${s.run.kind==='startup'?'启动里程碑':'运行时间线'} ${badge('observed')}<span class="muted mono">${esc(s.run.id.slice(0,10))}</span></h3><div class="trace-controls"><span class="muted" style="font-size:9px;margin-right:7px">逐步回放 · 非实时耗时</span><button class="icon-btn" data-action="trace-reset" aria-label="从头回放">${icon('reset')}</button><button class="icon-btn" data-action="trace-play" aria-label="${s.playing?'暂停':'播放'}">${icon(s.playing?'pause':'play')}</button><button class="icon-btn" data-action="trace-next" aria-label="下一步">${icon('step')}</button><button class="icon-btn" data-action="trace-close" aria-label="关闭时间线">${icon('close')}</button></div></div><div class="trace-events">${s.run.events.map((e,i)=>`<button class="trace-step ${s.step===i?'active':s.step>i?'done':''} ${e.kind==='fault'?'fault':''}" data-action="trace-step" data-index="${i}"><div class="trace-step-top"><span>${String(i+1).padStart(2,'0')} · ${esc(e.service)}</span><span>${Number(e.duration_ms||0).toFixed(1)}ms</span></div><p>${esc(e.label)}</p><small>${esc(e.kind)} · ${i===s.step?'当前步骤':'已采集'}</small></button>`).join('')}</div></section>`;
}
function inspector(){
 const n=selectedNode(),event=s.step>=0?s.run?.events[s.step]:null;
 const label=n?.label||'选择一个节点';const kind=n?.kind||'policy';
 let overview='';
 if(n){
  overview=`${event?`<div class="section-label">当前步骤 ${badge('observed')}</div><h3 style="font-size:12px;margin-bottom:8px">${esc(event.label)}</h3><pre class="code-json">${esc(JSON.stringify(event.state,null,2))}</pre>${Array.isArray(event.rows)?btn(`查看 ${event.rows.length} 行快照`,'event-rows','database','small full'):''}`:''}${s.row?`<div class="section-label">选中的数据行</div><pre class="code-json">${esc(JSON.stringify(s.row,null,2))}</pre>`:''}${s.layout?`<div class="section-label">浏览器实际布局</div>${Object.entries(s.layout).map(([k,v])=>`<div class="kv"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('')}`:''}<div class="section-label">对象信息</div><div class="kv"><span>类型</span><strong>${esc(n.kind||'技术策略')}</strong></div><div class="kv"><span>语言 / 所属</span><strong>${esc(n.language||n.owner||'—')}</strong></div><div class="kv"><span>来源</span><strong>${evidence(n.evidence)[0]}</strong></div>${n.value?`<div class="kv"><span>当前说明值</span><strong>${esc(n.value)}</strong></div>`:''}${n.inputs?.length?`<div class="section-label">输入参数</div><pre class="code-json">${esc(n.inputs.join('\n'))}</pre>`:''}${childCount(n.id)?`<div class="section-label">下一层 <span>${childCount(n.id)} 个对象</span></div>${children(n.id).slice(0,6).map(c=>`<button class="link-card" data-action="select" data-id="${esc(c.id)}">${icon(kindIcon(c.kind))}<span>${esc(c.label)}</span>${icon('chevron','chevron')}</button>`).join('')}${btn('进入这一层','drill','layers','primary full')}`:''}${s.graph.policies?.some(p=>p.owner===n.id)?`<div class="section-label">关联机制</div><div class="mechanism-links">${s.graph.policies.filter(p=>p.owner===n.id).map(p=>`<button class="pill blue" data-action="policy" data-id="${p.id}">${esc(p.label)}</button>`).join('')}</div>`:''}${n.source?`<div class="section-label">SOURCE EVIDENCE</div><button class="link-card" data-action="inspect-source">${icon('code')}<span class="mono">${esc(n.source.path.split('/').pop())}<small>L${n.source.line}${n.source.end?'–'+n.source.end:''}</small></span>${icon('chevron','chevron')}</button>`:''}${n.calls?.length?`<div class="section-label">函数体内调用表达式</div><div class="help-list mono">${n.calls.slice(0,12).map(x=>esc(x)).join('<br>')}</div><p class="muted" style="font-size:9px;margin-top:8px">调用表达式不代表所有目标均已解析。</p>`:''}`;
 }
 let body=overview;
 if(s.inspectorTab==='source')body=n?.source?`<div class="source-path">${esc(n.source.path)}:${n.source.line}</div>${s.graph.sources?.[n.source.path]?codeBlock(s.graph.sources[n.source.path],n.source.line,n.source.end):'<p class="compact-state">此图谱未携带源码正文。</p>'}${btn('在源码工作台查看','open-source','code','small full')}`:'<p class="compact-state">这是聚合对象，选择下一层的符号查看具体源码。</p>';
 if(s.inspectorTab==='evidence')body=`<div class="section-label">事实边界</div>${notice(n?.evidence==='observed'?'来自本次运行中的显式采集。':n?.evidence==='declared'?'这是示例显式声明的分组、绑定或说明，不是分析器自动恢复的架构。':'来源于静态解析或外部图谱。不代表运行时已经执行。')}<div class="section-label">版本 / 范围</div><div class="source-path">${esc(s.graph.revision)}<br>${esc(n?.source?.path||'项目模型')}</div><div class="section-label">解析诊断 <span>${s.graph.diagnostics?.length||0}</span></div><div class="help-list">${(s.graph.diagnostics||[]).slice(0,8).map(d=>`<p style="margin-bottom:10px">${esc(d)}</p>`).join('')||'没有解析诊断。'}</div>`;
 return `<div class="inspector-head"><span>INSPECTOR / 对象检查</span>${icon('settings')}</div><div class="inspector-body" style="padding-bottom:14px"><div class="overline">${esc(kind)}${n?.language?' / '+esc(n.language):''}</div><div class="inspector-title"><span class="node-icon ${kind}">${icon(kindIcon(kind))}</span><h2 class="${label.length>20?'symbol':''}">${esc(label)}</h2></div><p class="summary">${esc(n?.summary||'单击图上的进程、函数、表或运行步骤，从这里查看说明和实现。')}</p><div class="tag-line">${n?badge(n.evidence):''}${s.graph.mode==='demo'?'<span class="pill gray">v0.1 示例</span>':''}</div></div><div class="inspector-tabs">${[['overview','概览'],['source','源码'],['evidence','证据']].map(([id,t])=>`<button class="${s.inspectorTab===id?'active':''}" data-action="inspector-tab" data-value="${id}">${t}</button>`).join('')}</div><div class="inspector-body">${body}</div>`;
}
function mainView(){return ({architecture,startup:startupView,requests:requestView,frontend:frontendView,data:dataView,policies:policyView,source:sourceView})[s.view]()}
function render(){
 renderCounter++;
 // Keep a live iframe alive across selections and trace playback.
 const frame=$('#live-preview');const preserve=frame&&s.view==='frontend'&&!offline;
 if(preserve){
  $('.inspector').innerHTML=inspector();
  $('.trace-dock')?.remove();$('.main').insertAdjacentHTML('beforeend',traceDock());
  frame.style.width=(s.viewport==='mobile'?375:s.viewport==='tablet'?620:900)+'px';
  renderModal();return;
 }
 $('#app').innerHTML=`<div class="shell"><div class="brand"><span class="brand-mark">a</span><strong>Atlas</strong><small>v0.1</small></div><header class="topbar"><div class="project-crumb"><span>Workspace</span><span class="muted">/</span><strong>${esc(s.graph.name)}</strong><span class="pill gray">${s.graph.mode==='demo'?'示例项目':s.graph.mode==='imported'?'图谱导入':'源码分析'}</span></div><div class="top-actions"><button class="search-trigger" data-action="search">${icon('search')}<span>搜索符号、进程…</span><kbd>⌘ K</kbd></button>${btn('导入项目','import','upload')}${btn('快照','export','download','ghost')}</div></header><aside class="sidebar"><div class="nav-label">EXPLORE / 探索</div>${nav.map(([id,i,t])=>`<button class="nav-item ${s.view===id?'active':''}" data-action="view" data-value="${id}" title="${t}">${icon(i)}<span>${t}</span>${id==='policies'?`<span class="nav-count">${s.graph.policies?.length||0}</span>`:''}</button>`).join('')}<div class="sidebar-sep"></div><div class="nav-label">PROJECT CONTEXT</div><div class="side-project"><div>${icon('branch')} <strong>source-first</strong></div><p>先看结构，按需展开。<br>每个结论保留自己的来源。</p></div><div class="side-bottom"><span class="pill ${offline?'amber':s.graph.capabilities.runtime?'green':'gray'}"><i class="dot"></i>${offline?'离线 · 已采集快照':s.graph.capabilities.runtime?'本地示例运行中':'静态分析模式'}</span><p>Software Observatory<br>代码、行为与数据，同一张地图。</p></div></aside><main class="main">${heading()}${mainView()}${traceDock()}</main><aside class="inspector">${inspector()}</aside><footer class="footbar"><div><span class="connection">● ${offline?'Snapshot ready':'Workspace ready'}</span><span>${s.graph.nodes.length} nodes · ${s.graph.edges.length} relations</span><span class="mono">${esc(s.graph.revision)}</span></div><div><span>源码优先</span><span>静态 ≠ 运行</span><span>Atlas / 0.1.0</span></div></footer></div>`;
 if(preserve){const fresh=$('#live-preview');if(fresh){frame.style.width=fresh.style.width;fresh.replaceWith(frame)}}
 renderModal();
 if($('#graph-stage'))requestAnimationFrame(fitGraph);
 if(s.inspectorTab==='source')requestAnimationFrame(()=>{$('.inspector .source .highlight')?.scrollIntoView({block:'nearest'})});
}
function fitGraph(){const stage=$('#graph-stage'),world=$('#graph-world');if(!stage||!world)return;const scale=Math.min((stage.clientWidth-30)/Number(world.dataset.width),(stage.clientHeight-32)/Number(world.dataset.height),1.1)*s.zoom;world.style.transform=`translate(${(stage.clientWidth-Number(world.dataset.width)*scale)/2+s.pan.x}px,${(stage.clientHeight-Number(world.dataset.height)*scale)/2+s.pan.y}px) scale(${scale})`;$('#zoom-label').textContent=Math.round(scale*100)+'%'}
function renderModal(){document.querySelector('.overlay')?.remove();if(!s.modal)return;let content='';
 if(s.modal==='search'){content=`<div class="search-box">${icon('search')}<input id="search-input" placeholder="搜索进程、函数、表或机制…" aria-label="搜索项目" value="${esc(s.search)}"><button class="icon-btn" data-action="close-modal" aria-label="关闭">${icon('close')}</button></div><div class="search-results" id="search-results">${searchResults()}</div><div class="modal-footer">点击结果直接查看来源与说明 · Esc 关闭</div>`}
 if(s.modal==='import'){content=`<div class="modal-head"><h2>把你的项目放进来</h2><button class="icon-btn" data-action="close-modal" aria-label="关闭">${icon('close')}</button></div><div class="modal-body"><p>导入只分析文本，不运行项目。没有专用注释也可以提取基础结构。</p><div class="import-option"><h3>${icon('folder')} 选择项目文件夹</h3><p>Python AST · Go parser · TypeScript Compiler API<br>最多 150 个文件 / 5 MB。排除依赖、构建和隐藏目录。</p><input type="file" id="folder-input" webkitdirectory multiple hidden><button class="btn primary" data-action="choose-folder" ${offline?'disabled':''}>选择文件夹</button></div><div class="import-option"><h3>${icon('map')} 导入 Graphify JSON</h3><p>支持 nodes + edges / links；保留方向、关系和置信标记。不宣称直接兼容 Codebase Memory 的私有数据库格式。</p><input type="file" id="graph-input" accept=".json,application/json" hidden><button class="btn" data-action="choose-graph" ${offline?'disabled':''}>选择 graph.json</button></div>${offline?'<div class="offline-banner">离线预览不启动分析器。运行完整版后可使用以上导入。</div>':''}${btn('打开内置全栈示例','demo','arrow','ghost full')}</div>`}
 if(s.modal==='help'){content=`<div class="modal-head"><h2>一次从页面到数据的阅读</h2><button class="icon-btn" data-action="close-modal" aria-label="关闭">${icon('close')}</button></div><div class="modal-body"><div class="help-list"><p><b>01 / 架构地图</b>　双击 Member API，展开接口与 Client。</p><p><b>02 / 请求实验室</b>　选择“首次 503”，发送并查看重试。</p><p><b>03 / 运行时间线</b>　点击 SQL 步骤，查看实际结果行。</p><p><b>04 / 前端观察</b>　创建成员；点击行检查布局与来源。</p><p><b>05 / 数据地图</b>　比较当前数据库和历史查询快照。</p><p><b>06 / 源码导入</b>　分析自己的 Python、Go、JS/TS 文件。</p></div><div class="rule"></div>${notice('本版不是通用自动插桩器：示例分层和策略显式配置，运行步骤显式采集。外部项目先提供静态结构，能力边界不会隐藏。')}</div>`}
 const overlay=document.createElement('div');overlay.className='overlay';overlay.innerHTML=`<section class="modal" role="dialog" aria-modal="true" aria-label="${s.modal==='search'?'搜索':'工作台对话框'}">${content}</section>`;document.body.append(overlay);if(s.modal==='search')$('#search-input').focus();else $('.modal button')?.focus();
}
function searchResults(){const q=s.search.toLowerCase();const results=[...s.graph.nodes,...(s.graph.policies||[])].filter(n=>`${n.label} ${n.source?.path||''}`.toLowerCase().includes(q)).slice(0,18);return results.map(n=>`<button class="search-result" data-action="search-select" data-id="${esc(n.id)}">${icon(kindIcon(n.kind))}<span>${esc(n.label)}</span><small>${esc(n.source?.path||n.language||'policy')}</small></button>`).join('')||'<p class="compact-state">没有匹配的对象。</p>'}
function stop(){clearInterval(timer);timer=null;s.playing=false}
function chooseStep(index){if(!s.run?.events?.length)return;s.step=Math.max(0,Math.min(index,s.run.events.length-1));const event=s.run.events[s.step],n=sourceFor(event);s.selected=n?.id||event.service;s.row=null;s.layout=null;s.inspectorTab='overview';render();requestAnimationFrame(()=>$('.trace-step.active')?.scrollIntoView({block:'nearest',inline:'nearest'}))}
function play(){if(!s.run?.events?.length)return;if(s.playing){stop();render();return}s.playing=true;if(s.step>=s.run.events.length-1)s.step=-1;timer=setInterval(()=>{if(s.step>=s.run.events.length-1){stop();render()}else chooseStep(s.step+1)},800);render()}
async function loadView(){if(!enabled())return;if(s.view==='startup'&&!s.startup)s.startup=offline?window.__ATLAS_SNAPSHOT__.startup:await api('/api/startup');if((s.view==='data'||s.view==='frontend')&&!s.dataset)s.dataset=offline?window.__ATLAS_SNAPSHOT__.dataset:await api('/api/rows')}
function setGraph(graph){stop();s.graph=graph;s.scope=null;s.selected=graph.mode==='demo'?'api':graph.nodes.find(n=>n.kind!=='library')?.id;s.run=null;s.step=-1;s.row=null;s.layout=null;s.view='architecture';s.zoom=1;s.pan={x:0,y:0};s.modal=null;s.inspectorTab='overview';s.sourcePath=null;s.startup=null;s.dataset=null;render()}
async function send(){if(s.busy)return;stop();try{
 s.busy=true;render();
 let run;
 if(offline){const saved=window.__ATLAS_SNAPSHOT__.runs;run=saved.find(r=>r.scenario===s.request.scenario)||saved[0];if(!run)throw new Error('此快照没有请求记录')}
 else run=await api('/api/execute',{method:s.request.method,scenario:s.request.scenario,body:s.request.method==='POST'?JSON.parse(s.request.body):null,key:s.request.key});
 s.run=run;s.step=-1;s.dataset=null;s.row=null;s.layout=null;s.history.unshift(run);toast(offline?'已载入真实采集记录；未发送请求':`${run.method} ${run.path} → ${run.status} · ${run.events.length} 个采集步骤`);
 }catch(e){toast(e.message)}finally{s.busy=false;render()}}
function download(name,data,type='application/json'){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
async function action(el){const a=el.dataset.action,id=el.dataset.id,value=el.dataset.value;
 try{
  if(a==='view'){stop();s.view=value;s.row=null;s.layout=null;await loadView();render()}
  if(a==='select'){s.selected=id;s.row=null;s.layout=null;s.inspectorTab='overview';$('.inspector').innerHTML=inspector();document.querySelectorAll('.graph-node').forEach(n=>n.classList.toggle('selected',n.dataset.id===id))}
  if(a==='scope'){s.scope=id||null;s.zoom=1;s.pan={x:0,y:0};render()}
  if(a==='drill'){const n=selectedNode();if(n&&childCount(n.id)){s.scope=n.id;s.view='architecture';s.zoom=1;s.pan={x:0,y:0};render()}}
  if(a==='libraries'){s.libs=!s.libs;render()}
  if(a==='fit'){s.zoom=1;s.pan={x:0,y:0};fitGraph()}
  if(a==='zoom-in'||a==='zoom-out'){s.zoom=Math.max(.45,Math.min(2.4,s.zoom*(a==='zoom-in'?1.15:1/1.15)));fitGraph()}
  if(a==='inspector-tab'){s.inspectorTab=value;render()}
  if(a==='inspect-source'){s.inspectorTab='source';render()}
  if(a==='open-source'){s.sourcePath=selectedNode()?.source?.path;s.view='source';render()}
  if(a==='source-file'){s.sourcePath=el.dataset.path;s.selected=s.graph.nodes.find(n=>n.source?.path===s.sourcePath)?.id;render()}
  if(['search','import','help'].includes(a)){s.modal=a;renderModal()}
  if(a==='close-modal'){s.modal=null;renderModal()}
  if(a==='search-select'){s.modal=null;s.selected=id;s.inspectorTab='overview';const n=node(id);if(n?.parent)s.scope=n.parent;s.view='architecture';render()}
  if(a==='choose-folder')$('#folder-input').click();
  if(a==='choose-graph')$('#graph-input').click();
  if(a==='demo'){setGraph(offline?window.__ATLAS_SNAPSHOT__.graph:await api('/api/graph'))}
  if(a==='export')download('atlas.snapshot.json',JSON.stringify({...s.graph,recording:s.run},null,2));
  if(a==='send')await send();
  if(a==='startup-step'){s.run={...s.startup};chooseStep(Number(el.dataset.index))}
  if(a==='startup-play'){s.run={...s.startup};s.step=-1;play()}
  if(a==='trace-step'){stop();chooseStep(Number(el.dataset.index))}
  if(a==='trace-play')play();
  if(a==='trace-next'){stop();chooseStep(s.step+1)}
  if(a==='trace-reset'){stop();s.step=-1;render()}
  if(a==='trace-close'){stop();s.run=null;s.step=-1;render()}
  if(a==='event-rows'){s.view='data';s.dataMode='snapshot';s.table='members';await loadView();render()}
  if(a==='table'){s.table=value;s.dataMode='current';s.selected='table:'+value;s.row=null;render()}
  if(a==='refresh-rows'){s.dataset=await api('/api/rows');s.dataMode='current';render()}
  if(a==='data-mode'){s.dataMode=s.dataMode==='current'?'snapshot':'current';s.row=null;render()}
  if(a==='row'){s.row=getRows()[Number(el.dataset.index)];s.layout=null;s.selected='table:'+s.table;s.inspectorTab='overview';render()}
  if(a==='entity'){s.selected=s.graph.nodes.find(n=>n.label==='Member')?.id;s.inspectorTab='source';render()}
  if(a==='viewport'){s.viewport=value;render()}
  if(a==='policy'){s.selected=id;s.row=null;s.layout=null;s.step=-1;s.inspectorTab='overview';render()}
 }catch(error){toast(error.message)}
}
document.addEventListener('click',event=>{const el=event.target.closest('[data-action]');if(el)action(el);if(event.target.classList.contains('overlay')){s.modal=null;renderModal()}});
document.addEventListener('dblclick',event=>{const el=event.target.closest('.graph-node');if(el&&childCount(el.dataset.id)){s.selected=el.dataset.id;s.scope=el.dataset.id;s.pan={x:0,y:0};s.zoom=1;render()}});
document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();s.modal='search';renderModal()}if(event.key==='Escape'){s.modal=null;renderModal()}if(event.key==='Enter'&&event.target.matches('tr[data-action]'))action(event.target);if(event.key==='Tab'&&s.modal){const focusables=[...document.querySelectorAll('.modal button:not(:disabled),.modal input:not([hidden]),.modal [tabindex="0"]')];if(!focusables.length)return;const first=focusables[0],last=focusables.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}});
document.addEventListener('input',event=>{const el=event.target;if(el.id==='search-input'){s.search=el.value;$('#search-results').innerHTML=searchResults()}if(el.id==='req-body')s.request.body=el.value;if(el.id==='req-key')s.request.key=el.value});
document.addEventListener('change',async event=>{const el=event.target;if(el.id==='req-method'){s.request.method=el.value;render()}if(el.id==='req-scenario')s.request.scenario=el.value;
 try{
  if(el.id==='graph-input'&&el.files[0]){if(el.files[0].size>6_000_000)throw new Error('图谱大于 6 MB');toast('正在验证图谱…');setGraph(await api('/api/import',JSON.parse(await el.files[0].text())))}
  if(el.id==='folder-input'){
   const files={};const selected=[...el.files].filter(f=>/\.(py|go|js|jsx|ts|tsx|sql|css)$/i.test(f.name)&&!/(^|\/)(node_modules|\.git|\.venv|venv|dist|build|__pycache__|\.atlas)\//.test(f.webkitRelativePath));
   if(selected.length>150)throw new Error('最多 150 个源码文件，请选择较小的子目录');
   if(!selected.length)throw new Error('没有支持的源码文件');
   if(selected.reduce((n,f)=>n+f.size,0)>5_000_000)throw new Error('项目文本总量不能超过 5 MB');
   for(const f of selected)files[f.webkitRelativePath.split('/').slice(1).join('/')||f.name]=await f.text();
   toast(`正在解析 ${selected.length} 个文件；不会执行源码…`);setGraph(await api('/api/analyze',{files}));
  }
 }catch(error){toast(error.message)}
});
let drag=null;
document.addEventListener('pointerdown',e=>{if(e.target.id==='graph-stage'||e.target.id==='graph-world'){drag={x:e.clientX,y:e.clientY,px:s.pan.x,py:s.pan.y};e.target.setPointerCapture?.(e.pointerId)}});
document.addEventListener('pointermove',e=>{if(drag){s.pan={x:drag.px+e.clientX-drag.x,y:drag.py+e.clientY-drag.y};fitGraph()}});
document.addEventListener('pointerup',()=>{drag=null});
window.addEventListener('resize',fitGraph);
window.addEventListener('message',event=>{const frame=$('#live-preview');if(!frame||event.source!==frame.contentWindow||event.origin!==location.origin)return;const {type,payload}=event.data||{};if(type==='atlas-run'&&payload?.id&&Array.isArray(payload.events)){stop();s.run=payload;s.step=-1;s.dataset=null;render()}if(type==='atlas-inspect'){s.selected=s.graph.nodes.find(n=>n.label===payload.symbol&&n.source?.path==='demo/web/portal.js')?.id;s.row=payload.row;s.layout=payload.layout;s.inspectorTab='overview';render()}});
(async()=>{try{s.graph=offline?window.__ATLAS_SNAPSHOT__.graph:await api('/api/graph');if(offline){s.startup=window.__ATLAS_SNAPSHOT__.startup;s.dataset=window.__ATLAS_SNAPSHOT__.dataset}render()}catch(error){$('#app').innerHTML=`<div class="loading">${icon('info')}<h2>工作台未连接</h2><p>${esc(error.message)}</p><p>请运行 python -m observatory，再打开显示的本地地址。</p></div>`}})();
