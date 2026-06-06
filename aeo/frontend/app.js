/* 喜事达AEO认证管理平台 —— 前端 SPA */
const $ = s => document.querySelector(s);
const CATS = ['内部控制', '财务状况', '守法规范', '贸易安全'];
let TOKEN = localStorage.getItem('aeo_token') || '';
let ME = null;
const CACHE = {};                  // 实体数据缓存

/* ---------- 工具 ---------- */
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function toast(msg,err){const t=$('#toast');t.textContent=msg;t.className='toast show'+(err?' err':'');setTimeout(()=>t.className='toast'+(err?' err':''),1900);}
function statTag(s){const m={'达标':'t-ok','基本达标':'t-mid','不达标':'t-bad','待评估':'t-gray'};return `<span class="tag ${m[s]||'t-gray'}">${esc(s)}</span>`;}
function riskTag(r){const m={'低':'t-ok','中':'t-mid','高':'t-bad','待定':'t-gray'};return `<span class="tag ${m[r]||'t-gray'}">${esc(r)}风险</span>`;}
function canW(mod){return ME && (ME.isAdmin || ME.writable.includes(mod));}
function actBtns(mod,onEdit,onDel){if(!canW(mod))return '<span class="mini">只读</span>';
  return `<span class="act"><button class="ib" onclick="${onEdit}">编辑</button><button class="ib danger" onclick="${onDel}">删除</button></span>`;}

/* ---------- API ---------- */
async function api(path, method='GET', body){
  const opt={method, headers:{}};
  if(TOKEN) opt.headers['Authorization']='Bearer '+TOKEN;
  if(body!==undefined){opt.headers['Content-Type']='application/json';opt.body=JSON.stringify(body);}
  const res=await fetch('/api'+path, opt);
  if(res.status===401){doLogout();throw new Error('未登录');}
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.detail||('请求失败 '+res.status));
  return data;
}

/* ---------- 登录 / 注册 / 找回 / 重置 ---------- */
let _authMode='login';   // login | register | forgot | reset
let _resetToken='';
function show(id,on){const e=$('#'+id);if(e)e.style.display=on?'':'none';}
function setAuthMode(m){
  _authMode=m;
  const T={
    login:['喜事达工具平台 · 登录','登录后使用 AEO 合规平台与装箱软件等工具','登 录'],
    register:['注册外部账号','注册即创建外部客户账号，可使用装箱软件等工具','注 册'],
    forgot:['找回密码','输入你的用户名或注册邮箱，我们会把重置链接发到邮箱','发送重置邮件'],
    reset:['设置新密码','请输入新密码完成重置','重置密码'],
  }[m]||T.login;
  $('#liTitle').textContent=T[0];$('#liDesc').textContent=T[1];$('#liBtn').textContent=T[2];
  show('liUserRow', m!=='reset');
  show('liNameRow', m==='register');
  show('liEmailRow', m==='register');
  show('liPassRow', m==='login'||m==='register'||m==='reset');
  show('liToggleRow', m!=='reset');
  show('liForgotRow', m==='login');
  show('liHint', m==='login');
  $('#liUserLabel').textContent=(m==='forgot')?'用户名或邮箱':'用户名';
  $('#liPassLabel').textContent=(m==='reset')?'新密码（至少6位）':'密码';
  if(m==='forgot'){ $('#liToggleText').textContent=''; $('#liToggle').textContent='← 返回登录'; }
  else { $('#liToggleText').textContent=m==='register'?'已有账号？':'还没有账号？';
         $('#liToggle').textContent=m==='register'?'返回登录':'注册外部账号'; }
  $('#liErr').textContent='';$('#liErr').style.color='';
}
function afterAuth(){
  if(ME && ME.isCustomer){ location.replace('/packer/'); return; }
  enterApp();
}
async function doLogin(){
  const u=$('#liUser').value.trim(), p=$('#liPass').value;
  if(!u||!p){$('#liErr').textContent='请输入用户名和密码';return;}
  $('#liBtn').disabled=true;
  try{
    const r=await api('/login','POST',{username:u,password:p});
    TOKEN=r.token;localStorage.setItem('aeo_token',TOKEN);ME=r.user;
    afterAuth();
  }catch(e){$('#liErr').textContent=e.message;}
  $('#liBtn').disabled=false;
}
async function doRegister(){
  const u=$('#liUser').value.trim(), p=$('#liPass').value, name=$('#liName').value.trim(), email=$('#liEmail').value.trim();
  if(u.length<3){$('#liErr').textContent='用户名至少3个字符';return;}
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){$('#liErr').textContent='请填写有效的邮箱（用于找回密码）';return;}
  if(p.length<6){$('#liErr').textContent='密码至少6位';return;}
  $('#liBtn').disabled=true;
  try{
    const r=await api('/register','POST',{username:u,password:p,name:name,email:email});
    TOKEN=r.token;localStorage.setItem('aeo_token',TOKEN);ME=r.user;
    afterAuth();
  }catch(e){$('#liErr').textContent=e.message;}
  $('#liBtn').disabled=false;
}
async function doForgot(){
  const acc=$('#liUser').value.trim();
  if(!acc){$('#liErr').textContent='请输入用户名或邮箱';return;}
  $('#liBtn').disabled=true;
  try{
    const r=await api('/forgot-password','POST',{account:acc});
    $('#liErr').style.color='var(--ok)';
    $('#liErr').textContent=r.emailEnabled?'如果该账号存在，重置链接已发送到其邮箱，请查收（注意垃圾箱）。':'邮件服务暂未配置，请联系管理员重置密码。';
  }catch(e){$('#liErr').textContent=e.message;}
  $('#liBtn').disabled=false;
}
async function doReset(){
  const p=$('#liPass').value;
  if(p.length<6){$('#liErr').textContent='新密码至少6位';return;}
  $('#liBtn').disabled=true;
  try{
    await api('/reset-password','POST',{token:_resetToken,password:p});
    history.replaceState(null,'','/aeo/');
    setAuthMode('login');
    $('#liErr').style.color='var(--ok)';$('#liErr').textContent='密码已重置，请用新密码登录。';
  }catch(e){$('#liErr').textContent=e.message;}
  $('#liBtn').disabled=false;
}
function doAuth(){
  if(_authMode==='register')return doRegister();
  if(_authMode==='forgot')return doForgot();
  if(_authMode==='reset')return doReset();
  return doLogin();
}
function doLogout(){TOKEN='';localStorage.removeItem('aeo_token');ME=null;
  $('#appView').classList.add('hidden');$('#loginView').classList.remove('hidden');}
function logout(){doLogout();}

/* ---------- 导航（按权限） ---------- */
const NAV=[
  ['认证总览',[['dashboard','▥','认证驾驶舱'],['selfassess','✓','标准自评（32项）','standards'],
    ['audit','⊚','内部审计','audit'],['rectify','⟳','整改跟踪','rectify']]],
  ['业务记录系统',[['customs','⎙','关务单证管理','customs'],['logistics','⇄','物流与集装箱','logistics'],
    ['finance','¥','财务状况记录','finance']]],
  ['贸易安全',[['security','⛨','贸易安全管理','security'],['partner','⚯','商业伙伴评估','partner']]],
  ['合规支撑',[['docs','▤','制度与档案库','docs'],['training','◉','培训管理','training']]],
  ['外部工具',[['packer','⊞','装箱软件','','/packer/']]],
  ['系统',[['users','👤','用户管理','__admin'],['logs','📋','操作日志','__admin'],['settings','⚙','设置']]],
];
function buildNav(){
  let h='';
  NAV.forEach(([grp,items])=>{
    const vis=items.filter(it=>{const mod=it[3];
      if(mod==='__admin')return ME.isAdmin;
      if(!mod)return true;
      return ME.isAdmin||true;});         // 业务模块所有登录用户可读
    if(!vis.length)return;
    h+=`<div class="nav-group">${grp}</div>`;
    vis.forEach(it=>{
      if(it[4]){ h+=`<a href="${it[4]}" target="_blank" rel="noopener" title="在新标签页打开"><span class="ic">${it[1]}</span>${it[2]}<span style="margin-left:auto;opacity:.55;font-size:12px">↗</span></a>`; }
      else { h+=`<a data-view="${it[0]}"><span class="ic">${it[1]}</span>${it[2]}${it[0]==='rectify'?'<span class="badge" id="nbRect" style="display:none">0</span>':''}</a>`; }
    });
  });
  $('#nav').innerHTML=h;
  document.querySelectorAll('#nav a').forEach(a=>{ if(a.dataset.view) a.onclick=()=>go(a.dataset.view); });
}

/* ---------- 进入应用 ---------- */
async function enterApp(){
  $('#loginView').classList.add('hidden');$('#appView').classList.remove('hidden');
  $('#uName').textContent=ME.name||ME.username;
  $('#uRole').textContent=ME.roleName;
  $('#uAvatar').textContent=(ME.name||ME.username).slice(0,1);
  buildNav();
  go('dashboard');
}

/* ---------- 路由 ---------- */
const TITLES={dashboard:['认证驾驶舱','首页 / 认证总览'],selfassess:['标准自评（32项）','认证总览 / 标准自评'],
  audit:['内部审计','认证总览 / 内部审计'],rectify:['整改跟踪','认证总览 / 整改跟踪'],
  customs:['关务单证管理','业务记录系统 / 关务'],logistics:['物流与集装箱','业务记录系统 / 物流'],
  finance:['财务状况记录','业务记录系统 / 财务'],security:['贸易安全管理','贸易安全 / 安全管控'],
  partner:['商业伙伴评估','贸易安全 / 商业伙伴'],docs:['制度与档案库','合规支撑 / 档案'],
  training:['培训管理','合规支撑 / 培训'],users:['用户管理','系统 / 用户'],
  logs:['操作日志','系统 / 日志'],settings:['设置','系统 / 设置']};
let _curView='dashboard';
async function go(v){
  _curView=v;
  document.querySelectorAll('#nav a').forEach(a=>a.classList.toggle('active',a.dataset.view===v));
  $('#vTitle').textContent=TITLES[v][0];$('#vCrumb').textContent=TITLES[v][1];
  $('#content').innerHTML='<div class="empty">加载中…</div>';
  try{ await VIEWS[v](); }catch(e){ $('#content').innerHTML=`<div class="empty">加载失败：${esc(e.message)}</div>`; }
  window.scrollTo(0,0);
}
async function refreshBadge(){
  try{const d=await api('/dashboard');$('#pillOverall').textContent=d.overall+'%';
    const b=$('#nbRect');if(b){const n=d.openRectify.length;b.textContent=n;b.style.display=n?'':'none';}
  }catch(e){}
}
async function reload(entity){CACHE[entity]=await api('/'+entity);}

/* ---------- 通用表单 ---------- */
function openModal(t,b){$('#mTitle').textContent=t;$('#mBody').innerHTML=b;$('#modalBg').classList.add('show');}
function closeModal(){$('#modalBg').classList.remove('show');}
$('#modalBg').onclick=e=>{if(e.target.id==='modalBg')closeModal();};

function openForm(title, fields, record, onSave){
  const r=record||{};
  let h='<div class="form2">';
  fields.forEach(f=>{
    let val=r[f.key];if(Array.isArray(val))val=val.join('\n');if(val==null)val=f.default!=null?f.default:'';
    h+=`<div class="fld ${f.full?'full':''}"><label>${f.label}</label>`;
    if(f.type==='select')h+=`<select id="f_${f.key}">${f.options.map(o=>`<option ${o==val?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
    else if(f.type==='textarea')h+=`<textarea id="f_${f.key}" rows="3">${esc(val)}</textarea>`;
    else h+=`<input id="f_${f.key}" type="${f.type==='number'?'number':(f.type==='password'?'password':'text')}" value="${esc(val)}">`;
    h+='</div>';
  });
  h+=`</div><div style="text-align:right;margin-top:8px"><button class="btn ghost" onclick="closeModal()">取消</button> <button class="btn" id="formSave">保存</button></div>`;
  openModal(title,h);
  $('#formSave').onclick=async()=>{
    const out={};
    for(const f of fields){
      let v=$('#f_'+f.key).value;
      if(f.type==='number')v=parseFloat(v)||0;
      if(f.array)v=v.split('\n').map(x=>x.trim()).filter(Boolean);
      if(f.required&&(v===''||v==null)){toast('请填写「'+f.label+'」',true);return;}
      out[f.key]=v;
    }
    $('#formSave').disabled=true;
    try{ await onSave(out); closeModal(); toast('已保存'); await go(_curView); refreshBadge(); }
    catch(e){ toast(e.message,true); $('#formSave').disabled=false; }
  };
}
async function crudDelete(entity,id){
  if(!confirm('确认删除该记录？'))return;
  try{ await api('/'+entity+'/'+id,'DELETE'); toast('已删除'); await go(_curView); refreshBadge(); }
  catch(e){ toast(e.message,true); }
}

/* ===================== 视图 ===================== */
const VIEWS={};
function kpi(num,lbl,sub,color,ic){return `<div class="card kpi"><h3><span style="color:var(--${color})">${ic}</span></h3>
  <div class="num" style="color:var(--${color})">${num}</div><div class="lbl">${lbl}</div><div class="sub mini">${sub}</div></div>`;}
function donut(p){const c=p>=85?'#22c55e':p>=60?'#f59e0b':'#e54c5e';
  return `<div class="donut" style="background:conic-gradient(${c} ${p*3.6}deg,#22325a 0)"><div class="inner"><b>${p}%</b><span>综合达标</span></div></div>`;}

VIEWS.dashboard=async()=>{
  const d=await api('/dashboard');
  $('#pillOverall').textContent=d.overall+'%';
  let h=`<div class="grid kpis">
    ${kpi(d.total,'纳入自评标准','32项 / 4大类','info','▥')}
    ${kpi(d.ok,'达标项',d.total?Math.round(d.ok/d.total*100)+'%':'0%','ok','✓')}
    ${kpi(d.mid,'基本达标项','通过上限 ≤3 项','mid','◐')}
    ${kpi(d.bad+d.pending,'未达标/待评',d.bad+' 不达标 · '+d.pending+' 待评','bad','✕')}
    ${kpi(d.openRectify.length,'整改进行中','闭环后达标','warn','⟳')}
  </div>
  <div class="row" style="margin-top:16px">
    <div class="card" style="width:300px;display:flex;flex-direction:column;align-items:center">
      <h3>认证综合达标度</h3>${donut(d.overall)}
      <div style="margin-top:14px;text-align:center"><span class="tag ${d.pass?'t-ok':'t-bad'}">${d.pass?'满足通过条件':'尚未满足通过条件'}</span>
      <div class="mini" style="margin-top:8px">通过条件：无不达标/待评项 且 基本达标 ≤ 3</div></div>
    </div>
    <div class="card flex1"><h3>四大类标准达标情况</h3>
      ${d.cats.map(c=>`<div style="margin:14px 0"><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px">
        <span>${c.cat} <span class="mini">（${c.ok}/${c.total} 项达标）</span></span><b>${c.rate}%</b></div>
        <div class="bar"><i style="width:${c.rate}%;background:${c.rate>=85?'#22c55e':c.rate>=60?'#f59e0b':'#e54c5e'}"></i></div></div>`).join('')}
    </div>
  </div>
  <div class="row" style="margin-top:16px">
    <div class="card flex1"><h3>⚠ 认证风险预警</h3>
      ${d.openRectify.length?d.openRectify.map(r=>`<div class="alert ${r.risk==='高'?'bad':'warn'}"><span class="ai">⚠</span>
        <div><b>${esc(r.std)}</b> — ${esc(r.issue)}<br><span class="mini">责任：${esc(r.dept)} ${esc(r.owner)} · 期限 ${esc(r.due)}</span></div></div>`).join(''):
        '<div class="alert info"><span class="ai">✓</span><div>暂无进行中的整改项。</div></div>'}
    </div>
    <div class="card flex1"><h3>关键运行指标</h3><table><tbody>
      <tr><td>报关单记录</td><td style="text-align:right"><b>${d.counts.decls}</b> 票</td></tr>
      <tr><td>报关差错</td><td style="text-align:right"><b>${d.counts.declErr}</b> 票</td></tr>
      <tr><td>商业伙伴-待评估</td><td style="text-align:right"><b style="color:var(--warn)">${d.counts.partnersPending}</b> 家</td></tr>
      <tr><td>制度文件</td><td style="text-align:right"><b>${d.counts.docs}</b> 份</td></tr>
      <tr><td>资产负债率（最新）</td><td style="text-align:right"><b>${d.latestFinance?d.latestFinance.rate+'%':'—'}</b></td></tr>
    </tbody></table></div>
  </div>`;
  $('#content').innerHTML=h;
};

/* ---- 标准自评 ---- */
const SA_FIELDS=[
  {key:'code',label:'条款号',required:true},{key:'cat',label:'类别',type:'select',options:CATS},
  {key:'name',label:'标准名称',required:true},{key:'dept',label:'责任部门'},
  {key:'req',label:'标准要求',type:'textarea',full:true},
  {key:'status',label:'自评状态',type:'select',options:['待评估','达标','基本达标','不达标']},
  {key:'note',label:'问题说明',type:'textarea',full:true},
  {key:'evidence',label:'证明材料（每行一项）',type:'textarea',array:true,full:true}];
VIEWS.selfassess=async()=>{
  await reload('standards');
  const w=canW('standards');
  let h=`<div class="toolbar">
    <select id="fCat" onchange="renderSA()"><option value="">全部类别</option>${CATS.map(c=>`<option>${c}</option>`).join('')}</select>
    <select id="fStat" onchange="renderSA()"><option value="">全部状态</option><option>待评估</option><option>达标</option><option>基本达标</option><option>不达标</option></select>
    <input id="fKw" placeholder="搜索名称/条款号…" oninput="renderSA()" style="flex:1;min-width:160px">
    ${w?'<button class="btn" onclick="addSA()">+ 新增标准项</button>':''}</div>
    <div class="card" style="padding:0;overflow:hidden"><div id="saTable"></div></div>`;
  $('#content').innerHTML=h;renderSA();
};
function renderSA(){
  const cat=$('#fCat')?.value||'',stt=$('#fStat')?.value||'',kw=($('#fKw')?.value||'').trim();
  const rows=CACHE.standards.filter(s=>(!cat||s.cat===cat)&&(!stt||s.status===stt)&&(!kw||s.name.includes(kw)||s.code.includes(kw)));
  let h=`<table><thead><tr><th>条款号</th><th>类别</th><th>标准名称</th><th>要求</th><th>责任部门</th><th>状态</th><th>材料</th><th>操作</th></tr></thead><tbody>`;
  rows.forEach(s=>h+=`<tr><td><b>${esc(s.code)}</b></td><td><span class="tag t-info">${esc(s.cat)}</span></td>
    <td>${esc(s.name)}</td><td class="mini" style="max-width:230px">${esc(s.req)}</td><td>${esc(s.dept)}</td>
    <td>${statTag(s.status)}</td><td>${(s.evidence||[]).length} 份</td>
    <td>${actBtns('standards',`editSA(${s.id})`,`crudDelete('standards',${s.id})`)}</td></tr>`);
  h+='</tbody></table>';$('#saTable').innerHTML=h;
}
function addSA(){openForm('新增标准项',SA_FIELDS,{cat:'内部控制',status:'待评估'},v=>api('/standards','POST',v));}
function editSA(id){const s=CACHE.standards.find(x=>x.id===id);openForm('编辑标准项 '+s.code,SA_FIELDS,s,v=>api('/standards/'+id,'PUT',v));}

/* ---- 内审 ---- */
const AUD_FIELDS=[
  {key:'no',label:'内审编号',required:true},{key:'scope',label:'审计范围',full:true},
  {key:'date',label:'周期'},{key:'lead',label:'负责人'},
  {key:'find',label:'发现问题数',type:'number'},{key:'closed',label:'已闭环数',type:'number'},
  {key:'status',label:'状态',type:'select',options:['计划中','整改中','已结案']}];
VIEWS.audit=async()=>{
  await reload('audits');const w=canW('audit');const list=CACHE.audits;
  const tot=list.reduce((s,a)=>s+a.find,0),cl=list.reduce((s,a)=>s+a.closed,0);
  let h=`<div class="section-title">内部审计计划与记录 <small>106号公告 1.8 内审制度 / 1.9 改进机制</small>${w?'<button class="btn sm" onclick="addAud()">+ 新增内审</button>':''}</div>
  <div class="card" style="padding:0">${list.length?`<table><thead><tr><th>编号</th><th>范围</th><th>周期</th><th>负责人</th><th>发现</th><th>闭环</th><th>状态</th><th>操作</th></tr></thead><tbody>
    ${list.map(a=>{const cls=a.status==='已结案'?'t-ok':a.status==='整改中'?'t-mid':'t-gray';
      return `<tr><td><b>${esc(a.no)}</b></td><td>${esc(a.scope)}</td><td>${esc(a.date)}</td><td>${esc(a.lead)}</td>
      <td>${a.find}</td><td>${a.closed}/${a.find}</td><td><span class="tag ${cls}">${esc(a.status)}</span></td>
      <td>${actBtns('audit',`editAud(${a.id})`,`crudDelete('audits',${a.id})`)}</td></tr>`;}).join('')}
    </tbody></table>`:'<div class="empty">暂无内审记录</div>'}</div>
  <div class="alert info" style="margin-top:14px"><span class="ai">ℹ</span><div>高级认证要求企业具备<b>自查自纠、自主合规</b>能力：发现问题应进入「整改跟踪」形成闭环。</div></div>
  <div class="row"><div class="card flex1" style="background:var(--panel2)"><h3>累计发现</h3><div class="num" style="font-size:22px;color:var(--info)">${tot}</div></div>
  <div class="card flex1" style="background:var(--panel2)"><h3>已闭环</h3><div class="num" style="font-size:22px;color:var(--ok)">${cl}</div></div>
  <div class="card flex1" style="background:var(--panel2)"><h3>闭环率</h3><div class="num" style="font-size:22px;color:var(--mid)">${tot?Math.round(cl/tot*100):0}%</div></div></div>`;
  $('#content').innerHTML=h;
};
function addAud(){openForm('新增内审',AUD_FIELDS,{status:'计划中',find:0,closed:0},v=>api('/audits','POST',v));}
function editAud(id){openForm('编辑内审',AUD_FIELDS,CACHE.audits.find(x=>x.id===id),v=>api('/audits/'+id,'PUT',v));}

/* ---- 整改 ---- */
const REC_FIELDS=[
  {key:'code',label:'整改编号',required:true},{key:'src',label:'来源内审'},
  {key:'std',label:'关联标准',full:true},{key:'issue',label:'问题描述',type:'textarea',full:true},
  {key:'dept',label:'责任部门'},{key:'owner',label:'责任人'},
  {key:'due',label:'整改期限'},{key:'risk',label:'风险',type:'select',options:['低','中','高']}];
VIEWS.rectify=async()=>{
  await reload('rectify');const w=canW('rectify');const list=CACHE.rectify;
  let h=`<div class="section-title">整改跟踪（闭环管理） <small>登记 → 整改 → 验证关闭</small>${w?'<button class="btn sm" onclick="addRec()">+ 新增整改项</button>':''}</div>`;
  if(!list.length)h+='<div class="card"><div class="empty">暂无整改项</div></div>';
  list.forEach(r=>{const names=['问题登记','原因分析与整改','验证关闭'];const step=Math.max(1,Math.min(3,r.step||1));
    h+=`<div class="card" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;flex-wrap:wrap"><b>${esc(r.code)}</b> ${riskTag(r.risk)}
        <span class="tag t-gray">关联 ${esc(r.std)}</span><span class="mini" style="margin-left:auto">来源：${esc(r.src)} · 期限 ${esc(r.due)}</span></div>
      <div style="margin-bottom:10px">${esc(r.issue)}</div>
      <div class="steps">${names.map((n,k)=>{const cls=k<step?'done':k===step-1?'cur':'';return `<div class="st ${cls}"><div class="c">${k<step-1||(step===3&&k===2)?'✓':k+1}</div>${n}</div>`;}).join('')}</div>
      <div style="display:flex;align-items:center;gap:8px"><span class="mini">责任：${esc(r.dept)} · ${esc(r.owner)}</span>
        ${step<3?(w?`<button class="btn sm" style="margin-left:auto" onclick="advRec(${r.id})">推进到下一步</button>`:'<span class="tag t-mid" style="margin-left:auto">进行中</span>'):'<span class="tag t-ok" style="margin-left:auto">已关闭</span>'}
        ${actBtns('rectify',`editRec(${r.id})`,`crudDelete('rectify',${r.id})`)}</div></div>`;});
  $('#content').innerHTML=h;
};
function addRec(){openForm('新增整改项',REC_FIELDS,{risk:'中',src:'手动登记'},v=>api('/rectify','POST',Object.assign({step:1},v)));}
function editRec(id){openForm('编辑整改项',REC_FIELDS,CACHE.rectify.find(x=>x.id===id),v=>api('/rectify/'+id,'PUT',v));}
async function advRec(id){try{await api('/rectify/'+id+'/advance','POST');toast('已推进');await go('rectify');refreshBadge();}catch(e){toast(e.message,true);}}

/* ---- 关务 ---- */
const DECL_FIELDS=[
  {key:'no',label:'报关单号',required:true},{key:'type',label:'类型',type:'select',options:['进口','出口']},
  {key:'date',label:'申报日期'},{key:'hs',label:'HS编码'},{key:'goods',label:'品名',full:true},
  {key:'value',label:'申报货值'},{key:'cur',label:'币种'},
  {key:'status',label:'状态',type:'select',options:['已放行','查验放行','申报中','已退单']},
  {key:'err',label:'归类复核',type:'select',options:['正常','差错-已整改','差错-待整改']}];
VIEWS.customs=async()=>{
  await reload('decls');const w=canW('customs');const list=CACHE.decls;
  const err=list.filter(d=>d.err!=='正常').length;
  let h=`<div class="grid kpis" style="grid-template-columns:repeat(4,1fr)">
    ${kpi(list.length,'报关单记录','进口 '+list.filter(d=>d.type==='进口').length+' / 出口 '+list.filter(d=>d.type==='出口').length,'info','⎙')}
    ${kpi((list.length?err/list.length*100:0).toFixed(1)+'%','样本差错率','低于预警线 0.5%','ok','◷')}
    ${kpi(err,'差错单','建议建整改','mid','⚠')}
    ${kpi('3 年+','单证留存','自办结之日起','ok','⏱')}</div>
  <div class="section-title" style="margin-top:18px">报关单证记录 <small>关务模块 · 自动归档保存3年以上</small>${w?'<button class="btn sm" onclick="addDecl()">+ 新增报关单</button>':''}</div>
  <div class="toolbar"><select id="dType" onchange="renderDecl()"><option value="">全部</option><option>进口</option><option>出口</option></select>
    <input id="dKw" placeholder="搜索单号/品名…" oninput="renderDecl()" style="flex:1"></div>
  <div class="card" style="padding:0"><div id="declTable"></div></div>`;
  $('#content').innerHTML=h;renderDecl();
};
function renderDecl(){
  const t=$('#dType')?.value||'',kw=($('#dKw')?.value||'').trim();
  const rows=CACHE.decls.filter(d=>(!t||d.type===t)&&(!kw||d.no.includes(kw)||d.goods.includes(kw)));
  let h=`<table><thead><tr><th>报关单号</th><th>类型</th><th>日期</th><th>HS编码</th><th>品名</th><th>货值</th><th>状态</th><th>复核</th><th>操作</th></tr></thead><tbody>`;
  rows.forEach(d=>h+=`<tr><td><b>${esc(d.no)}</b></td><td><span class="tag ${d.type==='出口'?'t-info':'t-gray'}">${esc(d.type)}</span></td>
    <td>${esc(d.date)}</td><td>${esc(d.hs)}</td><td>${esc(d.goods)}</td><td>${esc(d.value)}</td>
    <td><span class="tag t-ok">${esc(d.status)}</span></td>
    <td>${d.err==='正常'?'<span class="tag t-ok">正常</span>':d.err.includes('待')?'<span class="tag t-bad">'+esc(d.err)+'</span>':'<span class="tag t-mid">'+esc(d.err)+'</span>'}</td>
    <td>${actBtns('customs',`editDecl(${d.id})`,`crudDelete('decls',${d.id})`)}</td></tr>`);
  h+='</tbody></table>';if(!rows.length)h='<div class="empty">暂无报关单，点击右上「新增报关单」录入</div>';$('#declTable').innerHTML=h;
}
function addDecl(){openForm('新增报关单',DECL_FIELDS,{type:'出口',status:'已放行',err:'正常',cur:'USD'},v=>api('/decls','POST',v));}
function editDecl(id){openForm('编辑报关单',DECL_FIELDS,CACHE.decls.find(x=>x.id===id),v=>api('/decls/'+id,'PUT',v));}

/* ---- 物流 ---- */
const CON_FIELDS=[
  {key:'no',label:'箱号',required:true},{key:'type',label:'箱型',type:'select',options:['20GP','40GP','40HQ','45HQ']},
  {key:'seal',label:'铅封号'},{key:'goods',label:'货物',full:true},{key:'chk',label:'检查情况'},
  {key:'photo',label:'照片留存',type:'select',options:['是','否']},
  {key:'status',label:'状态',type:'select',options:['已铅封发运','已拆箱入库','待复核','装箱中']}];
VIEWS.logistics=async()=>{
  await reload('containers');const w=canW('logistics');const list=CACHE.containers;
  let h=`<div class="section-title">货物物流与集装箱安全 <small>106号公告 4.4 货物 / 4.5 集装箱 / 4.6 运输工具</small>${w?'<button class="btn sm" onclick="addCon()">+ 新增集装箱</button>':''}</div>
  <div class="card" style="padding:0">${list.length?`<table><thead><tr><th>箱号</th><th>箱型</th><th>铅封号</th><th>货物</th><th>检查</th><th>照片</th><th>状态</th><th>操作</th></tr></thead><tbody>
    ${list.map(c=>`<tr><td><b>${esc(c.no)}</b></td><td>${esc(c.type)}</td><td>${esc(c.seal)}</td><td>${esc(c.goods)}</td>
      <td>${c.photo==='是'?'<span class="tag t-ok">'+esc(c.chk)+'</span>':'<span class="tag t-mid">'+esc(c.chk)+'</span>'}</td>
      <td>${c.photo==='是'?'<span class="tag t-ok">已留存</span>':'<span class="tag t-bad">缺失</span>'}</td>
      <td>${c.status==='待复核'?'<span class="tag t-bad">'+esc(c.status)+'</span>':'<span class="tag t-info">'+esc(c.status)+'</span>'}</td>
      <td>${actBtns('logistics',`editCon(${c.id})`,`crudDelete('containers',${c.id})`)}</td></tr>`).join('')}
    </tbody></table>`:'<div class="empty">暂无集装箱记录</div>'}</div>
  <div class="section-title">货物全程可追溯轨迹（示例）</div>
  <div class="card"><div class="steps">
    <div class="st done"><div class="c">✓</div>原料入库</div><div class="st done"><div class="c">✓</div>生产投料</div>
    <div class="st done"><div class="c">✓</div>成品入库</div><div class="st done"><div class="c">✓</div>装箱铅封</div>
    <div class="st done"><div class="c">✓</div>报关放行</div><div class="st cur"><div class="c">6</div>口岸发运</div></div>
  <div class="alert info"><span class="ai">ℹ</span><div>每一环节记录操作人、时间、单据号与监控影像编号，实现货物全程受控、可追溯。</div></div></div>`;
  $('#content').innerHTML=h;
};
function addCon(){openForm('新增集装箱',CON_FIELDS,{type:'40HQ',photo:'是',status:'装箱中',chk:'七点检查完成'},v=>api('/containers','POST',v));}
function editCon(id){openForm('编辑集装箱',CON_FIELDS,CACHE.containers.find(x=>x.id===id),v=>api('/containers/'+id,'PUT',v));}

/* ---- 财务 ---- */
const FIN_FIELDS=[
  {key:'y',label:'年度',required:true},{key:'rate',label:'资产负债率(%)',type:'number'},
  {key:'rev',label:'营业收入'},{key:'profit',label:'净利润'},
  {key:'tax',label:'纳税信用',type:'select',options:['A级','B级','M级','C级','D级']}];
VIEWS.finance=async()=>{
  await reload('finance');const w=canW('finance');
  const list=CACHE.finance.slice().sort((a,b)=>String(a.y).localeCompare(String(b.y)));
  const max=Math.max(1,...list.map(f=>f.rate));
  let h=`<div class="section-title">财务状况记录 <small>106号公告 · 无连续5年资产负债率超95%</small>${w?'<button class="btn sm" onclick="addFin()">+ 新增年度</button>':''}</div>
  <div class="row"><div class="card flex1"><h3>资产负债率趋势（预警线 95%）</h3>
    <div style="display:flex;align-items:flex-end;gap:18px;height:180px;padding:10px 0">
    ${list.length?list.map(f=>`<div style="flex:1;text-align:center;display:flex;flex-direction:column;justify-content:flex-end;height:100%">
      <b style="font-size:13px">${f.rate}%</b><div style="background:linear-gradient(180deg,#007892,#0a9bbd);border-radius:6px 6px 0 0;height:${f.rate/max*120}px;margin:6px 0"></div>
      <span class="mini">${esc(f.y)}</span></div>`).join(''):'<div class="empty">暂无数据</div>'}</div>
    ${list.some(f=>f.rate>95)?'<div class="alert warn"><span class="ai">⚠</span><div>存在资产负债率超95%年度。</div></div>':(list.length?'<div class="alert info"><span class="ai">✓</span><div>各年度均低于95%预警线。</div></div>':'')}
    </div>
    <div class="card" style="width:300px"><h3>关键指标（最新年度）</h3>${list.length?(()=>{const f=list[list.length-1];return `<div class="kv">
      <div class="k">年度</div><div><b>${esc(f.y)}</b></div><div class="k">营业收入</div><div>${esc(f.rev)}</div>
      <div class="k">净利润</div><div>${esc(f.profit)}</div><div class="k">资产负债率</div><div><b style="color:${f.rate>95?'var(--bad)':'var(--ok)'}">${f.rate}%</b></div>
      <div class="k">纳税信用</div><div><span class="tag t-ok">${esc(f.tax)}</span></div></div>`;})():'<div class="mini">暂无数据</div>'}</div></div>
  <div class="section-title">年度财务记录</div>
  <div class="card" style="padding:0">${list.length?`<table><thead><tr><th>年度</th><th>营业收入</th><th>净利润</th><th>资产负债率</th><th>纳税信用</th><th>操作</th></tr></thead><tbody>
    ${list.map(f=>`<tr><td><b>${esc(f.y)}</b></td><td>${esc(f.rev)}</td><td>${esc(f.profit)}</td><td>${f.rate}%</td>
      <td><span class="tag t-ok">${esc(f.tax)}</span></td><td>${actBtns('finance',`editFin(${f.id})`,`crudDelete('finance',${f.id})`)}</td></tr>`).join('')}
    </tbody></table>`:'<div class="empty">暂无财务记录</div>'}</div>`;
  $('#content').innerHTML=h;
};
function addFin(){openForm('新增年度财务',FIN_FIELDS,{tax:'A级',rate:70},v=>api('/finance','POST',v));}
function editFin(id){openForm('编辑年度财务',FIN_FIELDS,CACHE.finance.find(x=>x.id===id),v=>api('/finance/'+id,'PUT',v));}

/* ---- 贸易安全 ---- */
VIEWS.security=async()=>{
  await reload('standards');
  const items=CACHE.standards.filter(s=>s.cat==='贸易安全');
  let h=`<div class="grid kpis" style="grid-template-columns:repeat(4,1fr)">
    ${kpi(items.length,'贸易安全标准项','场所/人员/货物/箱体等','info','⛨')}
    ${kpi(items.filter(s=>s.status==='达标').length,'已达标','安全管控到位','ok','✓')}
    ${kpi(items.filter(s=>s.status==='基本达标').length,'待完善','整改中','mid','◐')}
    ${kpi(items.filter(s=>!['达标','基本达标'].includes(s.status)).length,'未达标/待评','须整改','bad','✕')}</div>
  <div class="section-title" style="margin-top:18px">贸易安全管控矩阵 <small>编辑请前往「标准自评」</small></div>
  <div class="card" style="padding:0"><table><thead><tr><th>条款</th><th>安全领域</th><th>管控要求</th><th>责任部门</th><th>状态</th></tr></thead><tbody>
    ${items.map(s=>`<tr><td><b>${esc(s.code)}</b></td><td>${esc(s.name)}</td><td class="mini">${esc(s.req)}</td><td>${esc(s.dept)}</td><td>${statTag(s.status)}</td></tr>`).join('')}
  </tbody></table></div>
  <div class="section-title">安全风险评估热力图（厂区分区）</div>
  <div class="card"><div class="heat">
    ${['原料库','生产车间A','生产车间B','成品库','装卸区','门禁区','办公区','危化品暂存','质检区','配电房','停车场','围墙周界','监控中心','装箱区'].map((z,i)=>{
      const lv=[0,0,1,0,1,0,0,2,0,1,0,0,0,1][i];const col=lv===0?'rgba(34,197,94,.25)':lv===1?'rgba(245,158,11,.3)':'rgba(239,68,68,.3)';
      return `<div class="h" style="background:${col}" title="${z}">${z}</div>`;}).join('')}</div>
  <div class="legend"><span><i class="dot" style="background:var(--ok)"></i>低风险</span><span><i class="dot" style="background:var(--mid)"></i>需关注</span><span><i class="dot" style="background:var(--bad)"></i>重点管控</span></div></div>`;
  $('#content').innerHTML=h;
};

/* ---- 商业伙伴 ---- */
const PT_FIELDS=[
  {key:'name',label:'商业伙伴名称',required:true,full:true},{key:'type',label:'类型',type:'select',options:['供应商','客户','承运/报关代理','其他']},
  {key:'role',label:'合作内容'},{key:'risk',label:'风险',type:'select',options:['低','中','高','待定']},
  {key:'aeo',label:'AEO资质'},{key:'sec',label:'安全评估',type:'select',options:['已评估','待评估']},{key:'expire',label:'评估到期'}];
VIEWS.partner=async()=>{
  await reload('partners');const w=canW('partner');const list=CACHE.partners;
  const pending=list.filter(p=>p.sec!=='已评估').length;
  const aeoCnt=list.filter(p=>p.aeo&&p.aeo!=='未认证'&&p.aeo!=='-').length;
  let h=`<div class="section-title">商业伙伴安全评估 <small>106号公告 4.7 商业伙伴安全</small>${w?'<button class="btn sm" onclick="addPt()">+ 新增伙伴</button>':''}</div>
  ${pending?`<div class="alert warn"><span class="ai">⚠</span><div>有 <b>${pending}</b> 家商业伙伴安全评估待补齐。</div></div>`:''}
  <div class="card" style="padding:0">${list.length?`<table><thead><tr><th>商业伙伴</th><th>类型</th><th>合作内容</th><th>风险</th><th>AEO资质</th><th>安全评估</th><th>到期</th><th>操作</th></tr></thead><tbody>
    ${list.map(p=>`<tr><td><b>${esc(p.name)}</b></td><td>${esc(p.type)}</td><td class="mini">${esc(p.role)}</td><td>${riskTag(p.risk)}</td>
      <td>${(!p.aeo||p.aeo==='未认证')?'<span class="tag t-gray">未认证</span>':'<span class="tag t-info">'+esc(p.aeo)+'</span>'}</td>
      <td>${p.sec==='已评估'?'<span class="tag t-ok">已评估</span>':'<span class="tag t-bad">待评估</span>'}</td>
      <td>${esc(p.expire)}</td><td>${actBtns('partner',`editPt(${p.id})`,`crudDelete('partners',${p.id})`)}</td></tr>`).join('')}
    </tbody></table>`:'<div class="empty">暂无商业伙伴</div>'}</div>
  ${list.length?`<div class="alert info" style="margin-top:14px"><span class="ai">ℹ</span><div>优先选择已获 AEO 认证或互认国家 AEO 的合作伙伴。当前 AEO 伙伴占比 <b>${Math.round(aeoCnt/list.length*100)}%</b>。</div></div>`:''}`;
  $('#content').innerHTML=h;
};
function addPt(){openForm('新增商业伙伴',PT_FIELDS,{type:'供应商',risk:'待定',sec:'待评估',aeo:'未认证'},v=>api('/partners','POST',v));}
function editPt(id){openForm('编辑商业伙伴',PT_FIELDS,CACHE.partners.find(x=>x.id===id),v=>api('/partners/'+id,'PUT',v));}

/* ---- 制度档案 ---- */
const DOC_FIELDS=[
  {key:'name',label:'文件名称',required:true,full:true},{key:'cat',label:'分类',type:'select',options:['关务制度','单证管理','内审制度','贸易安全','信息安全','财务制度','其他']},
  {key:'ver',label:'版本'},{key:'date',label:'生效日期'},{key:'owner',label:'归口部门'},
  {key:'keep',label:'留存要求',type:'select',options:['长期','3年+','5年','永久']}];
VIEWS.docs=async()=>{
  await reload('docfiles');const w=canW('docs');const list=CACHE.docfiles;
  let h=`<div class="section-title">制度与档案库 <small>统一管理，满足数据留存≥3年</small>${w?'<button class="btn sm" onclick="addDoc()">+ 登记文件</button>':''}</div>
  <div class="card" style="padding:0">${list.length?`<table><thead><tr><th>文件名称</th><th>分类</th><th>版本</th><th>生效日期</th><th>归口部门</th><th>留存</th><th>操作</th></tr></thead><tbody>
    ${list.map(d=>`<tr><td><b>${esc(d.name)}</b></td><td><span class="tag t-info">${esc(d.cat)}</span></td><td>${esc(d.ver)}</td><td>${esc(d.date)}</td><td>${esc(d.owner)}</td>
      <td>${['3年+','5年'].includes(d.keep)?'<span class="tag t-mid">'+esc(d.keep)+'</span>':'<span class="tag t-gray">'+esc(d.keep)+'</span>'}</td>
      <td>${actBtns('docs',`editDoc(${d.id})`,`crudDelete('docfiles',${d.id})`)}</td></tr>`).join('')}
    </tbody></table>`:'<div class="empty">暂无制度文件</div>'}</div>`;
  $('#content').innerHTML=h;
};
function addDoc(){openForm('登记制度文件',DOC_FIELDS,{cat:'关务制度',keep:'长期'},v=>api('/docfiles','POST',v));}
function editDoc(id){openForm('编辑制度文件',DOC_FIELDS,CACHE.docfiles.find(x=>x.id===id),v=>api('/docfiles/'+id,'PUT',v));}

/* ---- 培训 ---- */
const TR_FIELDS=[
  {key:'topic',label:'培训主题',required:true,full:true},{key:'date',label:'日期'},
  {key:'aud',label:'参训对象'},{key:'people',label:'人数',type:'number'},
  {key:'passrate',label:'考核通过率'},{key:'status',label:'状态',type:'select',options:['计划中','进行中','已完成']}];
VIEWS.training=async()=>{
  await reload('trainings');const w=canW('training');const list=CACHE.trainings;
  let h=`<div class="section-title">培训管理 <small>106号公告 4.9 海关业务与贸易安全培训</small>${w?'<button class="btn sm" onclick="addTr()">+ 新增培训</button>':''}</div>
  <div class="card" style="padding:0">${list.length?`<table><thead><tr><th>培训主题</th><th>日期</th><th>参训对象</th><th>人数</th><th>通过率</th><th>状态</th><th>操作</th></tr></thead><tbody>
    ${list.map(t=>`<tr><td><b>${esc(t.topic)}</b></td><td>${esc(t.date)}</td><td>${esc(t.aud)}</td><td>${t.people}</td><td>${esc(t.passrate)}</td>
      <td>${t.status==='已完成'?'<span class="tag t-ok">已完成</span>':t.status==='进行中'?'<span class="tag t-info">进行中</span>':'<span class="tag t-mid">计划中</span>'}</td>
      <td>${actBtns('training',`editTr(${t.id})`,`crudDelete('trainings',${t.id})`)}</td></tr>`).join('')}
    </tbody></table>`:'<div class="empty">暂无培训记录</div>'}</div>`;
  $('#content').innerHTML=h;
};
function addTr(){openForm('新增培训',TR_FIELDS,{status:'计划中',people:0,passrate:'-'},v=>api('/trainings','POST',v));}
function editTr(id){openForm('编辑培训',TR_FIELDS,CACHE.trainings.find(x=>x.id===id),v=>api('/trainings/'+id,'PUT',v));}

/* ---- 用户管理（管理员） ---- */
const ROLES=[['admin','系统管理员'],['customs','关务部'],['audit','内审部'],['finance','财务部'],['logistics','物流部'],['security','安保/贸易安全部'],['customer','外部客户']];
const USER_FIELDS=[
  {key:'username',label:'用户名',required:true},{key:'name',label:'姓名'},
  {key:'email',label:'邮箱（用于找回密码）'},
  {key:'role',label:'角色',type:'select',options:ROLES.map(r=>r[1])},{key:'dept',label:'部门'},
  {key:'password',label:'密码（编辑时留空=不变）',type:'password'}];
function roleVal(name){const r=ROLES.find(x=>x[1]===name);return r?r[0]:'customs';}
function roleName(v){const r=ROLES.find(x=>x[0]===v);return r?r[1]:v;}
VIEWS.users=async()=>{
  const list=await api('/users');CACHE.users=list;
  let h=`<div class="section-title">用户管理 <small>多角色权限</small><button class="btn sm" onclick="addUser()">+ 新增用户</button></div>
  <div class="card" style="padding:0"><table><thead><tr><th>用户名</th><th>姓名</th><th>角色</th><th>部门</th><th>操作</th></tr></thead><tbody>
    ${list.map(u=>`<tr><td><b>${esc(u.username)}</b></td><td>${esc(u.name)}</td><td><span class="tag t-info">${esc(u.roleName)}</span></td><td>${esc(u.dept)}</td>
      <td><span class="act"><button class="ib" onclick="editUser(${u.id})">编辑</button>${u.username==='admin'?'':`<button class="ib danger" onclick="crudDelete('users',${u.id})">删除</button>`}</span></td></tr>`).join('')}
  </tbody></table></div>
  <div class="card" style="margin-top:14px"><h3>角色权限说明</h3><div class="kv">
    <div class="k">系统管理员</div><div>全部模块读写 + 用户/日志/数据管理</div>
    <div class="k">关务部</div><div>标准自评、关务、物流、制度、整改（写）</div>
    <div class="k">内审部</div><div>标准自评、内审、整改（写）</div>
    <div class="k">财务部</div><div>财务、标准自评（写）</div>
    <div class="k">物流部</div><div>物流与集装箱（写）</div>
    <div class="k">安保/贸易安全部</div><div>商业伙伴、培训（写）</div>
    <div class="k">通用</div><div>所有角色可查看全部业务模块（只读）</div>
  </div></div>`;
  $('#content').innerHTML=h;
};
function addUser(){openForm('新增用户',USER_FIELDS,{role:'关务部'},v=>{v.role=roleVal(v.role);return api('/users','POST',v);});}
function editUser(id){const u=CACHE.users.find(x=>x.id===id);openForm('编辑用户 '+u.username,
  USER_FIELDS.map(f=>f.key==='username'?{...f,type:'text'}:f),{...u,role:u.roleName,password:''},
  v=>{v.role=roleVal(v.role);if(!v.password)delete v.password;return api('/users/'+id,'PUT',v);});}

/* ---- 操作日志（管理员） ---- */
VIEWS.logs=async()=>{
  const list=await api('/logs');
  let h=`<div class="section-title">操作日志 <small>合规留痕，最近 300 条</small></div>
  <div class="card" style="padding:0">${list.length?`<table><thead><tr><th>时间</th><th>用户</th><th>角色</th><th>操作</th><th>对象</th><th>记录</th></tr></thead><tbody>
    ${list.map(l=>`<tr><td class="mini">${esc(l.ts)}</td><td>${esc(l.user)}</td><td><span class="tag t-gray">${esc(roleName(l.role))}</span></td>
      <td><span class="tag t-info">${esc(l.action)}</span></td><td>${esc(l.entity)}</td><td class="mini">${esc(l.ref)}</td></tr>`).join('')}
  </tbody></table>`:'<div class="empty">暂无日志</div>'}</div>`;
  $('#content').innerHTML=h;
};

/* ---- 设置 ---- */
VIEWS.settings=async()=>{
  let h=`<div class="section-title">账号信息</div>
  <div class="card" style="max-width:520px"><div class="kv">
    <div class="k">用户名</div><div>${esc(ME.username)}</div>
    <div class="k">姓名</div><div>${esc(ME.name||'-')}</div>
    <div class="k">角色</div><div><span class="tag t-info">${esc(ME.roleName)}</span></div>
    <div class="k">部门</div><div>${esc(ME.dept||'-')}</div>
  </div><button class="btn" style="margin-top:14px" onclick="changePw()">修改密码</button></div>`;
  if(ME.isAdmin){
    h+=`<div class="section-title">数据管理（管理员）</div>
    <div class="card" style="max-width:520px"><p class="mini" style="margin-bottom:12px">示例数据用于试用与培训。正式使用前请清空并录入企业真实数据。</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn" onclick="loadSample()">装载示例数据</button>
      <button class="btn ghost" onclick="clearBiz()">清空业务数据</button></div></div>`;
  }
  h+=`<div class="section-title">关于</div>
  <div class="card" style="max-width:520px"><div class="kv">
    <div class="k">产品</div><div>喜事达AEO认证管理平台 v1.0</div>
    <div class="k">依据标准</div><div>海关总署公告2022年第106号</div>
    <div class="k">信用管理</div><div>海关总署令第251号</div>
    <div class="k">技术架构</div><div>FastAPI + SQLite + 多角色权限</div>
  </div></div>`;
  $('#content').innerHTML=h;
};
function changePw(){openForm('修改密码',[{key:'old',label:'原密码',type:'password',required:true,full:true},
  {key:'new',label:'新密码（至少6位）',type:'password',required:true,full:true}],{},
  async v=>{await api('/me/password','POST',v);});}
async function loadSample(){try{await api('/admin/load-sample','POST');toast('已装载示例数据');go('dashboard');refreshBadge();}catch(e){toast(e.message,true);}}
async function clearBiz(){if(!confirm('确认清空全部业务数据并重置标准状态？'))return;try{await api('/admin/clear','POST');toast('已清空');go('dashboard');refreshBadge();}catch(e){toast(e.message,true);}}

/* ---------- 启动 ---------- */
$('#liBtn').onclick=doAuth;
$('#liToggle').onclick=()=>setAuthMode(_authMode==='login'?'register':'login');
$('#liForgot').onclick=()=>setAuthMode('forgot');
$('#liPass').addEventListener('keydown',e=>{if(e.key==='Enter')doAuth();});
$('#liUser').addEventListener('keydown',e=>{if(e.key==='Enter')doAuth();});
$('#liEmail')&&$('#liEmail').addEventListener('keydown',e=>{if(e.key==='Enter')doAuth();});
(async function init(){
  // 重置密码链接： /aeo/?reset=TOKEN
  const rt=new URLSearchParams(location.search).get('reset');
  if(rt){ _resetToken=rt; setAuthMode('reset'); return; }
  if(TOKEN){try{
    ME=await api('/me');
    if(ME.isCustomer){ location.replace('/packer/'); return; }  // 外部客户不进合规平台
    enterApp();
  }catch(e){doLogout();}}
})();
