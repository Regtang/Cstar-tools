/* 喜事达AEO认证管理平台 —— 前端 SPA */
const $ = s => document.querySelector(s);
const CATS = ['内部控制', '财务状况', '守法规范', '贸易安全', '附加标准'];
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
  ['认证总览',[['dashboard','▥','认证驾驶舱'],['selfassess','✓','标准自评（2026版）','standards'],
    ['gap','◧','差距分析与证据','standards'],['fincalc','∑','财务指标测算','finance'],
    ['audit','⊚','内部审计','audit'],['rectify','⟳','整改跟踪','rectify']]],
  ['业务记录系统',[['customs','⎙','关务单证管理','customs'],['logistics','⇄','物流与集装箱','logistics'],
    ['finance','¥','财务状况记录','finance']]],
  ['贸易安全',[['security','⛨','贸易安全管理','security'],['partner','⚯','商业伙伴评估','partner']]],
  ['合规支撑',[['docs','▤','制度与档案库','docs'],['training','◉','培训管理','training'],['regs','§','法规与政策库','']]],
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
  $('#uAvatar').innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><circle cx="12" cy="8" r="3.4"/><path d="M5.5 19.5c1-3.7 4-5 6.5-5s5.5 1.3 6.5 5" stroke-linecap="round"/></svg>';
  const _v=$('#appVer'); if(_v) _v.textContent=(window.APP_VERSION||'v1.0')+(window.APP_BUILD?' · '+window.APP_BUILD:'');
  buildNav();
  go('dashboard');
}

/* ---------- 路由 ---------- */
const TITLES={dashboard:['认证驾驶舱','首页 / 认证总览'],selfassess:['标准自评（2026版）','认证总览 / 标准自评'],
  gap:['差距分析与证据清单','认证总览 / 差距分析'],fincalc:['财务指标测算（9项）','认证总览 / 财务测算'],
  audit:['内部审计','认证总览 / 内部审计'],rectify:['整改跟踪','认证总览 / 整改跟踪'],
  customs:['关务单证管理','业务记录系统 / 关务'],logistics:['物流与集装箱','业务记录系统 / 物流'],
  finance:['财务状况记录','业务记录系统 / 财务'],security:['贸易安全管理','贸易安全 / 安全管控'],
  partner:['商业伙伴评估','贸易安全 / 商业伙伴'],docs:['制度与档案库','合规支撑 / 档案'],
  training:['培训管理','合规支撑 / 培训'],regs:['法规与政策库','合规支撑 / 法规'],users:['用户管理','系统 / 用户'],
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

/* 四模块雷达图（SVG） */
function radarSVG(cats,size=210){
  const cx=size/2,cy=size/2,R=size/2-26,n=cats.length;
  const pt=(i,r)=>{const a=-Math.PI/2+i*2*Math.PI/n;return [cx+r*Math.cos(a),cy+r*Math.sin(a)];};
  let grid='';[0.25,0.5,0.75,1].forEach(f=>{
    grid+='<polygon points="'+cats.map((_,i)=>pt(i,R*f).map(v=>v.toFixed(1)).join(',')).join(' ')+
      `" fill="none" stroke="var(--line)" stroke-width="1" opacity="${f===1?0.9:0.5}"/>`;});
  let axes='',labels='';
  cats.forEach((c,i)=>{const [x,y]=pt(i,R);axes+=`<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--line)" stroke-width="1" opacity=".6"/>`;
    const [lx,ly]=pt(i,R+16);
    labels+=`<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="11" fill="var(--muted)">${esc(c.cat)} ${c.rate}%</text>`;});
  const poly=cats.map((c,i)=>pt(i,R*Math.max(0.03,c.rate/100)).map(v=>v.toFixed(1)).join(',')).join(' ');
  return `<svg viewBox="0 0 ${size} ${size}" style="width:100%;max-width:${size+30}px">${grid}${axes}
    <polygon points="${poly}" fill="rgba(232,67,104,.22)" stroke="#e84368" stroke-width="2"/>
    ${cats.map((c,i)=>{const [x,y]=pt(i,R*Math.max(0.03,c.rate/100));return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="#e84368"/>`;}).join('')}
    ${labels}</svg>`;
}
/* 认证目标日期（本地保存） */
function getTarget(){return localStorage.getItem('aeo_target_date')||'';}
function setTargetDate(){
  const v=prompt('设置认证目标日期（如海关现场认证/取证目标日），格式 YYYY-MM-DD：',getTarget()||'2026-12-31');
  if(v===null)return;
  if(v&&!/^\d{4}-\d{2}-\d{2}$/.test(v.trim())){toast('日期格式应为 YYYY-MM-DD',true);return;}
  if(v)localStorage.setItem('aeo_target_date',v.trim());else localStorage.removeItem('aeo_target_date');
  go('dashboard');
}
function milestonePlan(days){ // 按剩余天数倒排五阶段
  const names=['差距分析与材料准备','制度落地与内审','财务指标测算达标','模拟认证与整改闭环','海关现场认证'];
  return names.map((n,i)=>({n,pct:Math.round((i+1)/names.length*100)}));
}
/* 34号公告口径估算总分（达标=满分、基本达标按60%折算；附加最多+2；通过线95） */
function estScore(d){
  const base=d.total?(d.ok+d.mid*0.6)/d.total*100:0;
  return {base:Math.round(base*10)/10, bonus:Math.min(2,d.bonusGot||0),
          total:Math.round((base+Math.min(2,d.bonusGot||0))*10)/10};
}
VIEWS.dashboard=async()=>{
  const d=await api('/dashboard');
  try{await reload('finance');}catch(e){CACHE.finance=CACHE.finance||[];}
  const finLatest=(CACHE.finance||[]).slice().sort((a,b)=>String(a.y).localeCompare(String(b.y))).pop();
  const finVerdict=finLatest&&finLatest.verdict?finLatest.verdict:'';
  $('#pillOverall').textContent=d.overall+'%';
  const sc=estScore(d);
  const tgt=getTarget();
  let cd='';
  if(tgt){
    const days=Math.ceil((new Date(tgt+'T23:59:59')-new Date())/86400000);
    const cls=days<0?'t-bad':days<=30?'t-mid':'t-ok';
    cd=`<div style="text-align:center;margin:6px 0 10px"><div class="num" style="font-size:38px;color:${days<0?'var(--bad)':days<=30?'var(--warn)':'var(--ok)'}">${days<0?'已超期 '+(-days):days}</div>
        <div class="mini">${days<0?'天 · 目标日 '+tgt+' 已过':'天后到达目标日 '+tgt}</div></div>
      <div class="steps" style="margin-top:4px">${milestonePlan(days).map((m,i)=>{
        const done=d.overall>=m.pct;return `<div class="st ${done?'done':(i===0||d.overall>=Math.round(i/5*100)?'cur':'')}"><div class="c">${done?'✓':i+1}</div>${m.n}</div>`;}).join('')}</div>`;
  }else{
    cd='<div class="empty" style="padding:18px">未设置认证目标日期</div>';
  }
  let h=`<div class="toolbar" style="justify-content:flex-end;margin-bottom:4px">
    <button class="btn ghost sm" onclick="setTargetDate()">⏱ 设置目标日期</button>
    <button class="btn sm" onclick="exportBoardReport()">📄 导出汇报版报告</button></div>
  <div class="grid kpis">
    ${kpi(d.total,'纳入自评标准','2026版 · 4大类核心'+(d.bonusTotal?' + 附加'+d.bonusTotal+'项':''),'info','▥')}
    ${kpi(d.ok,'达标项',d.total?Math.round(d.ok/d.total*100)+'%':'0%','ok','✓')}
    ${kpi(d.mid,'基本达标项','通过上限 ≤3 项','mid','◐')}
    ${kpi(d.bad+d.pending,'未达标/待评',d.bad+' 不达标 · '+d.pending+' 待评','bad','✕')}
    ${kpi(d.openRectify.length,'整改进行中','闭环后达标','warn','⟳')}
  </div>
  <div class="row" style="margin-top:16px">
    <div class="card" style="width:300px;display:flex;flex-direction:column;align-items:center">
      <h3>认证综合达标度</h3>${donut(d.overall)}
      <div style="margin-top:12px;text-align:center"><span class="tag ${d.pass?'t-ok':'t-bad'}">${d.pass?'满足通过条件':'尚未满足通过条件'}</span>
      <div style="margin-top:10px;font-size:13px">估算总分 <b style="font-size:18px;color:${sc.total>=95?'var(--ok)':'var(--warn)'}">${sc.total}</b> / 通过线 95
        <span class="mini">（基准 ${sc.base} + 附加 ${sc.bonus}）</span></div>
      <div class="mini" style="margin-top:6px">通过条件：无不达标/待评项 且 基本达标 ≤3；总分为估算值，以海关认定为准</div></div>
    </div>
    <div class="card" style="width:300px;display:flex;flex-direction:column;align-items:center">
      <h3>四大模块雷达</h3>${radarSVG(d.cats)}
      <div class="mini" style="margin-top:4px">外圈=100% 达标</div>
    </div>
    <div class="card flex1"><h3>认证里程碑 · 倒计时</h3>${cd}
      <div style="border-top:1px solid var(--line);margin-top:10px;padding-top:10px">
      ${d.cats.map(c=>`<div style="margin:9px 0"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
        <span>${c.cat} <span class="mini">（${c.ok}/${c.total}）</span></span><b>${c.rate}%</b></div>
        <div class="bar"><i style="width:${c.rate}%;background:${c.rate>=85?'#22c55e':c.rate>=60?'#f59e0b':'#e84368'}"></i></div></div>`).join('')}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
        <span class="mini">附加标准已获 ${d.bonusGot||0}/${d.bonusTotal||0} 项（每项+1，最多+2）</span>
        <b style="color:var(--brand2)">+${Math.min(2,d.bonusGot||0)} 分</b></div></div>
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
      <tr><td>财务9项指标判定（最新年度）</td><td style="text-align:right">${finVerdict?statTag(finVerdict):'<span class="mini">未测算 → <a style="color:var(--brand2);cursor:pointer" onclick="go(\'fincalc\')">去测算</a></span>'}</td></tr>
    </tbody></table></div>
  </div>`;
  $('#content').innerHTML=h;
};
/* 驾驶舱：导出汇报版报告（打印/PDF） */
async function exportBoardReport(){
  const d=await api('/dashboard');
  try{await reload('standards');}catch(e){}
  try{await reload('finance');}catch(e){}
  const sc=estScore(d);const tgt=getTarget();
  const finLatest=(CACHE.finance||[]).slice().sort((a,b)=>String(a.y).localeCompare(String(b.y))).pop();
  const gaps=(CACHE.standards||[]).filter(s=>s.cat!=='附加标准'&&['不达标','基本达标','待评估'].includes(s.status))
    .sort((a,b)=>({'不达标':0,'待评估':1,'基本达标':2}[a.status]-{'不达标':0,'待评估':1,'基本达标':2}[b.status]));
  const html=`<html><head><meta charset="utf-8"><title>AEO认证进度汇报</title><style>
    body{font-family:"Microsoft YaHei",sans-serif;color:#1f2a37;padding:30px}h1{font-size:20px;margin:0 0 4px}
    h2{font-size:15px;margin:20px 0 8px;border-left:4px solid #e84368;padding-left:8px}
    .sum{color:#555;font-size:13px;margin:3px 0}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
    th,td{border:1px solid #999;padding:5px 8px;text-align:left;vertical-align:top}thead th{background:#252f45;color:#fff}
    .big{font-size:26px;font-weight:800}.ft{margin-top:18px;color:#888;font-size:11px}
    .grid{display:flex;gap:14px;margin-top:8px}.box{flex:1;border:1px solid #ccc;border-radius:6px;padding:10px;text-align:center}</style></head><body>
    <h1>喜事达 AEO 高级认证 · 进度汇报</h1>
    <div class="sum">依据：海关总署公告2026年第34号 · 生成时间：${new Date().toLocaleString('zh-CN',{hour12:false})}${tgt?' · 目标日期：'+tgt:''}</div>
    <div class="grid">
      <div class="box"><div class="big">${d.overall}%</div>综合达标度</div>
      <div class="box"><div class="big">${sc.total}</div>估算总分（通过线95）</div>
      <div class="box"><div class="big">${d.ok}/${d.total}</div>核心条款达标</div>
      <div class="box"><div class="big">+${sc.bonus}</div>附加标准加分</div>
      <div class="box"><div class="big">${d.openRectify.length}</div>整改进行中</div></div>
    <h2>四大模块达标情况</h2>
    <table><thead><tr><th>模块</th><th>达标/总数</th><th>达标率</th></tr></thead><tbody>
      ${d.cats.map(c=>`<tr><td>${c.cat}</td><td>${c.ok}/${c.total}</td><td>${c.rate}%</td></tr>`).join('')}</tbody></table>
    <h2>财务9项指标（最新年度）</h2>
    ${finLatest&&finLatest.verdict?`<table><thead><tr><th>年度</th><th>企业类型</th><th>偿债符合</th><th>盈利符合</th><th>判定</th></tr></thead><tbody>
      <tr><td>${esc(finLatest.y)}</td><td>${esc(finLatest.ftype||'-')}</td>
      <td>${finLatest.metrics&&finLatest.metrics.debtOK!=null?finLatest.metrics.debtOK+'/4':'-'}</td>
      <td>${finLatest.metrics&&finLatest.metrics.profOK!=null?finLatest.metrics.profOK+'/5':'-'}</td>
      <td>${esc(finLatest.verdict)}</td></tr></tbody></table>`:'<div class="sum">尚未进行财务指标测算。</div>'}
    <h2>差距与风险（${gaps.length} 项）</h2>
    ${gaps.length?`<table><thead><tr><th>条款</th><th>标准</th><th>状态</th><th>问题说明</th><th>责任部门</th></tr></thead><tbody>
      ${gaps.map(s=>`<tr><td>${esc(s.code)}</td><td>${esc(s.name)}</td><td>${esc(s.status)}</td><td>${esc(s.note||'')}</td><td>${esc(s.dept)}</td></tr>`).join('')}</tbody></table>`:
      '<div class="sum">核心条款全部达标。</div>'}
    <div class="ft">${(window.APP_VERSION||'')} · 喜事达AEO认证管理平台 · 总分为系统估算，最终以海关认定为准。</div>
    </body></html>`;
  const w=window.open('','_blank'); if(!w){alert('请允许弹出窗口以导出报告');return;}
  w.document.write(html); w.document.close(); w.focus(); setTimeout(()=>{try{w.print();}catch(e){}},400);
}

/* ---- 标准自评 ---- */
const SA_FIELDS=[
  {key:'code',label:'条款号',required:true},{key:'cat',label:'类别',type:'select',options:CATS},
  {key:'name',label:'标准名称',required:true},{key:'dept',label:'责任部门'},
  {key:'req',label:'标准要求',type:'textarea',full:true},
  {key:'origin',label:'官方逐字原文（公告2026年第34号附件，可逐条粘贴录入）',type:'textarea',full:true},
  {key:'status',label:'自评状态',type:'select',options:['待评估','达标','基本达标','不达标']},
  {key:'note',label:'问题说明',type:'textarea',full:true},
  {key:'evidence',label:'证明材料（每行一项）',type:'textarea',array:true,full:true}];

/* 应备证据材料参考库（按条款号；差距分析与条款详情使用） */
const EVID_LIB={
 '1.1':['组织架构图（标注关务岗位）','关务部门/岗位职责说明书','关务人员任命文件'],
 '1.2':['法定代表人/关务负责人培训记录','高管海关法规学习证明','守法承诺书'],
 '1.3':['进出口单证制作规程','单证复核记录（双复核）','单证与货物相符抽查记录'],
 '1.4':['单证归档管理办法','归档台账（≥3年）','档案室/电子档案系统截图'],
 '1.5':['信息系统功能清单','ERP/关务系统操作手册','业务全流程系统留痕示例'],
 '1.6':['财务/关务/物流模块运行截图','模块间数据联动说明','系统权限分配表'],
 '1.7':['数据备份策略文件','数据保存期限设置证明','历史数据可调取演示记录'],
 '1.8':['内部审计制度','年度内审计划','内审报告与工作底稿'],
 '1.9':['问题整改台账（闭环）','纠错改进流程文件','主动披露记录（如有）'],
 '1.10':['商品归类管理规程','归类要素库/归类台账','疑难归类咨询记录'],
 '1.11':['价格申报管理规程','特许权使用费排查记录','关联交易价格说明（如有）'],
 '1.12':['原产地管理规程','原产地证书台账','享惠申报核查记录'],
 '1.13':['禁限/两用物项合规审查制度','管制商品筛查记录','出口管制专岗任命文件','两用物项许可证（如有）'],
 '2.1':['经审计年度财务报告','会计师事务所审计报告','账实相符核查记录'],
 '2.2':['资产负债表','资产负债率测算表'],'2.3':['货币资金明细','现金比率测算表'],
 '2.4':['现金流量表','经营现金流负债比测算表'],'2.5':['流动资产/负债明细','流动比率测算表'],
 '2.6':['利润表（净利润）'],'2.7':['营业利润率测算表'],'2.8':['毛利率测算表'],
 '2.9':['经营活动现金流量净额证明'],'2.10':['总资产报酬率测算表'],
 '2.11':['财务9项指标综合测算报告（本平台财务测算可生成）'],
 '2.12':['纳税信用等级证明（A/B级）','完税凭证样例','无欠税证明'],
 '3.1':['海关企业信用查询截图','无走私违规声明','近2年行政处罚情况说明'],
 '3.2':['年度报关差错率统计表','差错原因分析与纠正记录'],
 '3.3':['违规处置流程文件','违规整改闭环记录'],
 '3.4':['关联主体清单（法人/关务/财务负责人/报关人员/分支机构/代理等）','关联主体信用查询记录','员工无违法承诺书'],
 '3.5':['信用中国/执行信息公开网查询截图','企业信用报告'],
 '3.6':['行政处罚台账（次数/金额）','欠税查询证明'],
 '4.1':['海关联络人备案/任命文件','关企沟通记录（会议纪要等）'],
 '4.2':['门禁/监控/围墙等安防设施照片','安防设施巡查维护记录','来访登记台账'],
 '4.3':['入职背景调查记录','离职权限回收单','敏感岗位人员管理制度'],
 '4.4':['货物收发存管理规程','出入库台账（可追溯）','装卸交接记录'],
 '4.5':['集装箱七点检查表（带照片）','铅封管理台账','箱体异常处置记录'],
 '4.6':['运输工具检查记录','车辆/驾驶员管理台账','异常上报记录'],
 '4.7':['商业伙伴安全评估问卷','伙伴安全协议/条款','AEO资质证明（伙伴）','定期复评记录'],
 '4.8':['信息安全管理制度','账号权限矩阵','数据备份与恢复演练记录','防病毒/防入侵措施证明'],
 '4.9':['年度培训计划','培训签到与考核记录','新员工安全培训记录'],
 '4.10':['贸易安全应急预案','应急演练记录','突发事件处置报告（如有）'],
 '4.11':['可疑货物报告流程','异常报告记录（如有）','员工报告渠道公示'],
 '5.1':['国家级绿色工厂/绿色供应链证书'],'5.2':['专精特新“小巨人”证书'],
 '5.3':['其他附加情形证明材料（以公告附件为准）'],
};
function evidLib(code){return EVID_LIB[code]||[];}
VIEWS.selfassess=async()=>{
  await reload('standards');
  const w=canW('standards');
  let h=`<div class="toolbar">
    <select id="fCat" onchange="renderSA()"><option value="">全部类别</option>${CATS.map(c=>`<option>${c}</option>`).join('')}</select>
    <select id="fStat" onchange="renderSA()"><option value="">全部状态</option><option>待评估</option><option>达标</option><option>基本达标</option><option>不达标</option></select>
    <input id="fKw" placeholder="搜索名称/条款号…" oninput="renderSA()" style="flex:1;min-width:160px">
    <button class="btn ghost" onclick="exportSAReport()">📄 导出自评报告</button>
    ${w?'<button class="btn" onclick="addSA()">+ 新增标准项</button>':''}</div>
    <div class="card" style="padding:0;overflow:hidden"><div id="saTable"></div></div>`;
  $('#content').innerHTML=h;renderSA();
};
function renderSA(){
  const cat=$('#fCat')?.value||'',stt=$('#fStat')?.value||'',kw=($('#fKw')?.value||'').trim();
  const rows=CACHE.standards.filter(s=>(!cat||s.cat===cat)&&(!stt||s.status===stt)&&(!kw||s.name.includes(kw)||s.code.includes(kw)));
  let h=`<table><thead><tr><th>条款号</th><th>类别</th><th>标准名称</th><th>要求</th><th>原文</th><th>责任部门</th><th>状态</th><th>材料</th><th>操作</th></tr></thead><tbody>`;
  rows.forEach(s=>h+=`<tr><td><b>${esc(s.code)}</b></td><td><span class="tag t-info">${esc(s.cat)}</span></td>
    <td><a style="cursor:pointer;color:var(--brand2)" onclick="viewSA(${s.id})">${esc(s.name)}</a></td><td class="mini" style="max-width:210px">${esc(s.req)}</td>
    <td>${s.origin?'<span class="tag t-ok">已录</span>':'<span class="tag t-gray">待录</span>'}</td><td>${esc(s.dept)}</td>
    <td>${statTag(s.status)}</td><td>${(s.evidence||[]).length}/${evidLib(s.code).length||'-'}</td>
    <td>${actBtns('standards',`editSA(${s.id})`,`crudDelete('standards',${s.id})`)}</td></tr>`);
  h+='</tbody></table>';$('#saTable').innerHTML=h;
}
/* 条款详情：标准要求 + 官方原文 + 应备材料对照 */
function viewSA(id){
  const s=CACHE.standards.find(x=>x.id===id);if(!s)return;
  const lib=evidLib(s.code);const have=s.evidence||[];
  const h=`<div class="kv" style="grid-template-columns:90px 1fr">
    <div class="k">类别</div><div><span class="tag t-info">${esc(s.cat)}</span> · 责任部门：${esc(s.dept)}</div>
    <div class="k">自评状态</div><div>${statTag(s.status)} ${s.note?'<span class="mini">'+esc(s.note)+'</span>':''}</div>
    <div class="k">标准要求</div><div>${esc(s.req)}</div>
    <div class="k">官方原文</div><div>${s.origin?esc(s.origin).replace(/\n/g,'<br>'):
      '<span class="mini">待录入 —— 以海关总署公告2026年第34号附件为准，可在「编辑」中逐条粘贴官方原文。</span>'}</div></div>
   <div style="margin-top:12px"><b style="font-size:13px">应备材料对照</b>
   <table style="margin-top:6px"><thead><tr><th>参考应备材料</th><th style="width:90px">状态</th></tr></thead><tbody>
   ${lib.length?lib.map(m=>{const got=have.some(e=>e&&(e.includes(m.slice(0,4))||m.includes(e.slice(0,4))));
     return `<tr><td class="mini">${esc(m)}</td><td>${got?'<span class="tag t-ok">已备</span>':'<span class="tag t-mid">待备</span>'}</td></tr>`;}).join(''):
     '<tr><td colspan="2" class="mini">该条款暂无参考清单</td></tr>'}
   ${have.length?`<tr><td class="mini" colspan="2">已登记材料：${have.map(esc).join('、')}</td></tr>`:''}
   </tbody></table></div>
   <div style="text-align:right;margin-top:10px">${canW('standards')?`<button class="btn sm" onclick="closeModal();editSA(${s.id})">编辑该条款</button>`:''}</div>`;
  openModal(`${s.code} ${s.name}`,h);
}
function addSA(){openForm('新增标准项',SA_FIELDS,{cat:'内部控制',status:'待评估'},v=>api('/standards','POST',v));}
function editSA(id){const s=CACHE.standards.find(x=>x.id===id);openForm('编辑标准项 '+s.code,SA_FIELDS,s,v=>api('/standards/'+id,'PUT',v));}
/* 功能①：一键导出/打印 AEO 自评报告 */
function exportSAReport(){
  const s=CACHE.standards||[]; const byCat={};
  s.forEach(x=>{(byCat[x.cat]=byCat[x.cat]||[]).push(x);});
  const core=s.filter(x=>x.cat!=='附加标准'); const ok=core.filter(x=>x.status==='达标').length;
  const bonus=s.filter(x=>x.cat==='附加标准'&&x.status==='达标').length;
  let rows='';
  CATS.forEach(c=>{const arr=(byCat[c]||[]).slice().sort((a,b)=>a.code.localeCompare(b.code,'zh'));if(!arr.length)return;
    rows+=`<tr><th colspan="4" style="background:#eef3f7;text-align:left">${c}</th></tr>`;
    arr.forEach(x=>rows+=`<tr><td>${esc(x.code)}</td><td>${esc(x.name)}</td><td>${esc(x.status)}</td><td>${esc(x.note||'')}</td></tr>`);});
  const html=`<html><head><meta charset="utf-8"><title>AEO自评报告</title><style>
    body{font-family:"Microsoft YaHei",sans-serif;color:#1f2a37;padding:30px}h1{font-size:20px;margin:0 0 4px}
    .sum{color:#555;font-size:13px;margin:3px 0}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:14px}
    th,td{border:1px solid #999;padding:5px 8px;text-align:left;vertical-align:top}thead th{background:#252f45;color:#fff}
    .ft{margin-top:18px;color:#888;font-size:11px}</style></head><body>
    <h1>喜事达 AEO 高级认证 · 标准自评报告</h1>
    <div class="sum">依据：海关总署公告2026年第34号《海关高级认证企业标准》（通用标准—进出口货物收发货人）</div>
    <div class="sum">核心条款达标：<b>${ok}/${core.length}</b> · 附加标准加分：<b>+${Math.min(2,bonus)}</b> 分 · 生成时间：${new Date().toLocaleString('zh-CN',{hour12:false})}</div>
    <table><thead><tr><th>条款</th><th>标准名称</th><th>自评状态</th><th>问题说明</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="ft">${(window.APP_VERSION||'')} · 喜事达AEO认证管理平台 · 本报告由系统自动生成，最终以海关认定为准。</div>
    </body></html>`;
  const w=window.open('','_blank'); if(!w){alert('请允许弹出窗口以导出报告');return;}
  w.document.write(html); w.document.close(); w.focus(); setTimeout(()=>{try{w.print();}catch(e){}},400);
}
/* ===== 差距分析与证据清单 ===== */
const GAP_W={'不达标':3,'待评估':2,'基本达标':1,'达标':0};
VIEWS.gap=async()=>{
  await reload('standards');
  const core=CACHE.standards.filter(s=>s.cat!=='附加标准');
  const bad=core.filter(s=>s.status==='不达标').length,pend=core.filter(s=>s.status==='待评估').length,
        mid=core.filter(s=>s.status==='基本达标').length;
  let lack=0;core.forEach(s=>{const lib=evidLib(s.code);const n=(s.evidence||[]).length;if(lib.length&&n<lib.length)lack+=lib.length-n;});
  let h=`<div class="grid kpis" style="grid-template-columns:repeat(4,1fr)">
    ${kpi(bad,'不达标（高差距）','优先整改','bad','✕')}
    ${kpi(pend,'待评估','尽快完成自评','warn','◌')}
    ${kpi(mid,'基本达标','通过上限 ≤3 项','mid','◐')}
    ${kpi(lack,'材料缺口（参考）','对照应备清单估算','info','▤')}</div>
  <div class="toolbar" style="margin-top:16px">
    <select id="gCat" onchange="renderGap()"><option value="">全部类别</option>${CATS.filter(c=>c!=='附加标准').map(c=>`<option>${c}</option>`).join('')}</select>
    <select id="gLv" onchange="renderGap()"><option value="">全部差距</option><option>仅看有差距</option><option>不达标</option><option>待评估</option><option>基本达标</option></select>
    <span style="flex:1"></span>
    <button class="btn ghost" onclick="exportGapReport()">📄 导出差距分析</button>
    ${canW('rectify')?'<button class="btn" onclick="genAllRect()">⟳ 一键生成全部整改项</button>':''}</div>
  <div class="card" style="padding:0;overflow:hidden"><div id="gapTable"></div></div>
  <div class="alert info" style="margin-top:12px"><span class="ai">ℹ</span><div>「应备材料」为按公告2026年第34号要求整理的<b>参考清单</b>，已备判断按名称近似匹配，最终以海关现场认证认定为准。</div></div>`;
  $('#content').innerHTML=h;renderGap();
};
function gapAdvice(s){
  if(s.status==='不达标')return '立即整改：'+(s.note||'对照标准要求落实制度与记录');
  if(s.status==='待评估')return '完成自评：收集应备材料后评估状态';
  if(s.status==='基本达标')return '补强：'+(s.note||'消除剩余差距，争取达标');
  const lib=evidLib(s.code),n=(s.evidence||[]).length;
  return lib.length&&n<lib.length?'材料补全：对照应备清单补齐证明材料':'保持：定期复核材料有效性';
}
function renderGap(){
  const cat=$('#gCat')?.value||'',lv=$('#gLv')?.value||'';
  let rows=CACHE.standards.filter(s=>s.cat!=='附加标准'&&(!cat||s.cat===cat));
  if(lv==='仅看有差距')rows=rows.filter(s=>s.status!=='达标');
  else if(lv)rows=rows.filter(s=>s.status===lv);
  rows=rows.slice().sort((a,b)=>(GAP_W[b.status]||0)-(GAP_W[a.status]||0)||a.code.localeCompare(b.code,'zh'));
  let h=`<table><thead><tr><th>条款</th><th>标准</th><th>状态</th><th>材料(已备/应备)</th><th>差距与建议</th><th>操作</th></tr></thead><tbody>`;
  rows.forEach(s=>{const lib=evidLib(s.code),n=(s.evidence||[]).length;
    const gapLv=GAP_W[s.status]||0;
    h+=`<tr><td><b>${esc(s.code)}</b><br><span class="mini">${esc(s.cat)}</span></td>
    <td><a style="cursor:pointer;color:var(--brand2)" onclick="viewSA(${s.id})">${esc(s.name)}</a></td>
    <td>${statTag(s.status)}</td>
    <td>${lib.length?`<b style="color:${n>=lib.length?'var(--ok)':'var(--warn)'}">${n}</b>/${lib.length}`:n+'/-'}</td>
    <td class="mini" style="max-width:280px">${esc(gapAdvice(s))}</td>
    <td>${gapLv>0&&canW('rectify')?`<button class="ib" onclick="genRect(${s.id})">生成整改</button>`:(gapLv>0?'<span class="mini">差距</span>':'<span class="tag t-ok">无差距</span>')}</td></tr>`;});
  h+='</tbody></table>';if(!rows.length)h='<div class="empty">无符合条件的条款</div>';
  $('#gapTable').innerHTML=h;
}
function _dueDate(days){const d=new Date(Date.now()+days*86400000);return d.toISOString().slice(0,10);}
async function genRect(id){
  const s=CACHE.standards.find(x=>x.id===id);if(!s)return;
  try{
    await reload('rectify');
    if(CACHE.rectify.some(r=>(r.step||1)<3&&r.std&&r.std.startsWith(s.code))){toast('该条款已有进行中的整改项',true);return;}
    await api('/rectify','POST',{code:'R-GAP-'+s.code,src:'差距分析',std:s.code+' '+s.name,
      issue:s.note||('差距分析：'+s.status+'，对照标准要求整改'),dept:s.dept,owner:'',
      due:_dueDate(s.status==='不达标'?15:30),step:1,risk:s.status==='不达标'?'高':'中'});
    toast('已生成整改项');refreshBadge();
  }catch(e){toast(e.message,true);}
}
async function genAllRect(){
  const targets=CACHE.standards.filter(s=>s.cat!=='附加标准'&&['不达标','基本达标','待评估'].includes(s.status));
  if(!targets.length){toast('当前没有差距条款');return;}
  if(!confirm(`将为 ${targets.length} 个差距条款生成整改项（已有进行中整改的条款跳过），确认？`))return;
  await reload('rectify');let n=0;
  for(const s of targets){
    if(CACHE.rectify.some(r=>(r.step||1)<3&&r.std&&r.std.startsWith(s.code)))continue;
    try{await api('/rectify','POST',{code:'R-GAP-'+s.code,src:'差距分析',std:s.code+' '+s.name,
      issue:s.note||('差距分析：'+s.status+'，对照标准要求整改'),dept:s.dept,owner:'',
      due:_dueDate(s.status==='不达标'?15:30),step:1,risk:s.status==='不达标'?'高':'中'});n++;}catch(e){}
  }
  toast(`已生成 ${n} 个整改项`);refreshBadge();go('gap');
}
function exportGapReport(){
  const core=(CACHE.standards||[]).filter(s=>s.cat!=='附加标准');
  const rows=core.slice().sort((a,b)=>(GAP_W[b.status]||0)-(GAP_W[a.status]||0)||a.code.localeCompare(b.code,'zh'));
  const html=`<html><head><meta charset="utf-8"><title>AEO差距分析报告</title><style>
    body{font-family:"Microsoft YaHei",sans-serif;color:#1f2a37;padding:30px}h1{font-size:20px;margin:0 0 4px}
    .sum{color:#555;font-size:13px;margin:3px 0}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:14px}
    th,td{border:1px solid #999;padding:5px 8px;text-align:left;vertical-align:top}thead th{background:#252f45;color:#fff}
    .ft{margin-top:18px;color:#888;font-size:11px}</style></head><body>
    <h1>喜事达 AEO 高级认证 · 差距分析与证据清单</h1>
    <div class="sum">依据：海关总署公告2026年第34号 · 生成时间：${new Date().toLocaleString('zh-CN',{hour12:false})}</div>
    <div class="sum">不达标 <b>${core.filter(s=>s.status==='不达标').length}</b> · 待评估 <b>${core.filter(s=>s.status==='待评估').length}</b> · 基本达标 <b>${core.filter(s=>s.status==='基本达标').length}</b> · 达标 <b>${core.filter(s=>s.status==='达标').length}</b></div>
    <table><thead><tr><th>条款</th><th>标准</th><th>状态</th><th>已备/应备材料</th><th>应备材料参考清单</th><th>差距与建议</th></tr></thead><tbody>
    ${rows.map(s=>{const lib=evidLib(s.code);return `<tr><td>${esc(s.code)}</td><td>${esc(s.name)}</td><td>${esc(s.status)}</td>
      <td>${(s.evidence||[]).length}/${lib.length||'-'}</td><td>${lib.map(esc).join('；')}</td><td>${esc(gapAdvice(s))}</td></tr>`;}).join('')}
    </tbody></table>
    <div class="ft">${(window.APP_VERSION||'')} · 喜事达AEO认证管理平台 · 应备材料为参考清单，以海关认定为准。</div></body></html>`;
  const w=window.open('','_blank');if(!w){alert('请允许弹出窗口以导出报告');return;}
  w.document.write(html);w.document.close();w.focus();setTimeout(()=>{try{w.print();}catch(e){}},400);
}

/* ===== 财务指标测算（2026版 9 项：偿债4 + 盈利5） ===== */
const FIN_TH_DEF={dbrProd:95,dbrNon:95,cashRatio:20,ocfLiab:10,curRatio:1.0};
function finTh(){try{return Object.assign({},FIN_TH_DEF,JSON.parse(localStorage.getItem('aeo_fin_th')||'{}'));}catch(e){return {...FIN_TH_DEF};}}
function saveFinTh(){
  const t={};['dbrProd','dbrNon','cashRatio','ocfLiab','curRatio'].forEach(k=>{t[k]=parseFloat($('#th_'+k).value)||FIN_TH_DEF[k];});
  localStorage.setItem('aeo_fin_th',JSON.stringify(t));toast('阈值已保存（本机）');calcFin();
}
function finCompute(v,th){
  const pct=(a,b)=>b? a/b*100 : null;
  const ind=[];
  const dbr=pct(v.liab,v.assets);
  const dbrTh=v.ftype==='生产型'?th.dbrProd:th.dbrNon;
  ind.push({grp:'偿债',code:'2.2',name:'资产负债率',val:dbr,unit:'%',rule:'≤ '+dbrTh+'%',pass:dbr!=null&&dbr<=dbrTh});
  // 分母为0（无负债/无流动负债）视为符合：无偿债压力
  const cr=pct(v.cash,v.curl);
  ind.push({grp:'偿债',code:'2.3',name:'现金比率',val:cr,unit:'%',rule:'≥ '+th.cashRatio+'%',pass:cr!=null?cr>=th.cashRatio:v.curl===0});
  const ol=pct(v.ocf,v.liab);
  ind.push({grp:'偿债',code:'2.4',name:'经营现金流负债比',val:ol,unit:'%',rule:'≥ '+th.ocfLiab+'%',pass:ol!=null?ol>=th.ocfLiab:(v.liab===0&&v.ocf>=0)});
  const lr=v.curl?v.cura/v.curl:null;
  ind.push({grp:'偿债',code:'2.5',name:'流动比率',val:lr,unit:'',rule:'≥ '+th.curRatio,pass:lr!=null?lr>=th.curRatio:v.curl===0});
  ind.push({grp:'盈利',code:'2.6',name:'净利润',val:v.netprofit,unit:'万元',rule:'> 0',pass:v.netprofit>0});
  const opr=pct(v.opprofit,v.revenue);
  ind.push({grp:'盈利',code:'2.7',name:'营业利润率',val:opr,unit:'%',rule:'> 0',pass:opr!=null&&opr>0});
  const gm=v.revenue?(v.revenue-v.cost)/v.revenue*100:null;
  ind.push({grp:'盈利',code:'2.8',name:'毛利率',val:gm,unit:'%',rule:'> 0',pass:gm!=null&&gm>0});
  ind.push({grp:'盈利',code:'2.9',name:'经营性现金流',val:v.ocf,unit:'万元',rule:'> 0',pass:v.ocf>0});
  const roa=v.assets?((v.totalprofit||v.netprofit)+(v.interest||0))/v.assets*100:null;
  ind.push({grp:'盈利',code:'2.10',name:'总资产报酬率',val:roa,unit:'%',rule:'> 0',pass:roa!=null&&roa>0});
  const debtOK=ind.filter(i=>i.grp==='偿债'&&i.pass).length;
  const profOK=ind.filter(i=>i.grp==='盈利'&&i.pass).length;
  const verdict=(debtOK>=2&&profOK>=2)?'达标':(debtOK>=1&&profOK>=1)?'基本达标':'不达标';
  return {ind,debtOK,profOK,verdict,dbr:dbr!=null?Math.round(dbr*10)/10:0};
}
const FIN_IN=[['y','年度','2025'],['assets','资产总额','number'],['liab','负债总额','number'],
  ['cash','货币资金','number'],['cura','流动资产','number'],['curl','流动负债','number'],
  ['ocf','经营活动现金流量净额','number'],['revenue','营业收入','number'],['cost','营业成本','number'],
  ['opprofit','营业利润','number'],['netprofit','净利润','number'],['totalprofit','利润总额','number'],
  ['interest','利息支出（可0）','number']];
function finVals(){
  const v={ftype:$('#fc_ftype').value,y:$('#fc_y').value.trim(),tax:$('#fc_tax').value};
  FIN_IN.slice(1).forEach(([k])=>{v[k]=parseFloat($('#fc_'+k).value)||0;});
  return v;
}
VIEWS.fincalc=async()=>{
  await reload('finance');
  const th=finTh();const w=canW('finance');
  const hist=CACHE.finance.slice().sort((a,b)=>String(b.y).localeCompare(String(a.y)));
  let h=`<div class="alert info"><span class="ai">∑</span><div>按公告2026年第34号财务状况标准测算：<b>偿债4项中≥2项 且 盈利5项中≥2项</b>符合 → 达标；各仅1项符合 → 基本达标。金额单位：<b>万元</b>。</div></div>
  <div class="row">
   <div class="card" style="flex:1.4;min-width:340px"><h3>① 录入财报数据（万元）</h3>
    <div class="form2">
      <div class="fld"><label>企业类型</label><select id="fc_ftype"><option>非生产型</option><option>生产型</option></select></div>
      <div class="fld"><label>纳税信用等级</label><select id="fc_tax"><option>A级</option><option>B级</option><option>M级</option><option>C级</option><option>D级</option></select></div>
      ${FIN_IN.map(([k,lbl,t])=>`<div class="fld"><label>${lbl}</label><input id="fc_${k}" type="${t==='number'?'number':'text'}" placeholder="${t==='number'?'0':t}"></div>`).join('')}
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
      <button class="btn" onclick="calcFin()">∑ 测算 9 项指标</button>
      <button class="btn ghost" onclick="fillFinSample()">示例数据</button>
      ${w?'<button class="btn ghost" id="fcSaveBtn" onclick="saveFinYear()" disabled>保存为年度记录</button>':''}
    </div></div>
   <div class="card" style="width:280px"><h3>判定阈值（可按官方说明校准）</h3>
    <div class="form2" style="grid-template-columns:1fr">
      <div class="fld"><label>资产负债率上限-生产型 %</label><input id="th_dbrProd" type="number" value="${th.dbrProd}"></div>
      <div class="fld"><label>资产负债率上限-非生产型 %</label><input id="th_dbrNon" type="number" value="${th.dbrNon}"></div>
      <div class="fld"><label>现金比率下限 %</label><input id="th_cashRatio" type="number" value="${th.cashRatio}"></div>
      <div class="fld"><label>经营现金流负债比下限 %</label><input id="th_ocfLiab" type="number" value="${th.ocfLiab}"></div>
      <div class="fld"><label>流动比率下限</label><input id="th_curRatio" type="number" step="0.1" value="${th.curRatio}"></div>
    </div>
    <button class="btn ghost sm" onclick="saveFinTh()">保存阈值</button>
    <div class="mini" style="margin-top:8px">默认值为参考口径；盈利5项按官方"相关指标符合要求(>0)"判定。请对照《海关企业认证标准》说明校准后使用，以海关认定为准。</div></div>
  </div>
  <div id="fcResult"></div>
  <div class="section-title">历史测算 / 年度财务记录</div>
  <div class="card" style="padding:0">${hist.length?`<table><thead><tr><th>年度</th><th>类型</th><th>资产负债率</th><th>偿债符合</th><th>盈利符合</th><th>判定</th><th>操作</th></tr></thead><tbody>
    ${hist.map(f=>`<tr><td><b>${esc(f.y)}</b></td><td>${esc(f.ftype||'-')}</td><td>${f.rate?f.rate+'%':'-'}</td>
      <td>${f.metrics&&f.metrics.debtOK!=null?f.metrics.debtOK+'/4':'-'}</td><td>${f.metrics&&f.metrics.profOK!=null?f.metrics.profOK+'/5':'-'}</td>
      <td>${f.verdict?statTag(f.verdict):'<span class="tag t-gray">未测算</span>'}</td>
      <td><span class="act"><button class="ib" onclick="loadFinYear(${f.id})">载入</button>${w?`<button class="ib danger" onclick="crudDelete('finance',${f.id})">删除</button>`:''}</span></td></tr>`).join('')}
    </tbody></table>`:'<div class="empty">暂无记录，测算后点「保存为年度记录」</div>'}</div>`;
  $('#content').innerHTML=h;
};
let _finResult=null;
function calcFin(){
  const v=finVals();
  const errs=[];
  if(!v.y)errs.push('年度');
  if(v.assets<=0)errs.push('资产总额需>0');
  if(v.curl<0||v.liab<0)errs.push('负债不可为负');
  if(errs.length){toast('请检查：'+errs.join('、'),true);return;}
  if(!v.curl)toast('流动负债为0：现金比率/流动比率将无法计算',true);
  const r=finCompute(v,finTh());_finResult={v,r};
  const sb=$('#fcSaveBtn');if(sb)sb.disabled=false;
  const grpRow=g=>r.ind.filter(i=>i.grp===g).map(i=>`<tr><td>${i.code}</td><td>${i.name}</td>
    <td style="text-align:right"><b>${i.val==null?'—':(Math.round(i.val*100)/100)}</b> ${i.unit}</td>
    <td>${i.rule}</td><td>${i.pass?'<span class="tag t-ok">符合</span>':'<span class="tag t-bad">不符合</span>'}</td></tr>`).join('');
  $('#fcResult').innerHTML=`<div class="section-title">② 测算结果 — ${esc(v.y)} 年度（${esc(v.ftype)}）
     <small>偿债 ${r.debtOK}/4 · 盈利 ${r.profOK}/5</small>
     <span style="margin-left:auto">${statTag(r.verdict)}</span></div>
   <div class="row">
    <div class="card flex1" style="padding:0"><table><thead><tr><th>条款</th><th>偿债能力指标</th><th style="text-align:right">测算值</th><th>判定规则</th><th>结果</th></tr></thead>
      <tbody>${grpRow('偿债')}</tbody></table></div>
    <div class="card flex1" style="padding:0"><table><thead><tr><th>条款</th><th>盈利能力指标</th><th style="text-align:right">测算值</th><th>判定规则</th><th>结果</th></tr></thead>
      <tbody>${grpRow('盈利')}</tbody></table></div></div>
   <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
     ${canW('standards')?'<button class="btn" onclick="writeBackSA()">✓ 回写标准自评（2.2–2.11）</button>':''}
     <button class="btn ghost" onclick="exportFinReport()">📄 导出测算报告</button></div>
   <div class="alert ${r.verdict==='达标'?'info':'warn'}" style="margin-top:10px"><span class="ai">${r.verdict==='达标'?'✓':'⚠'}</span>
     <div>判定：<b>${r.verdict}</b> —— 偿债能力 ${r.debtOK}/4 项符合、盈利能力 ${r.profOK}/5 项符合。${r.verdict!=='达标'?'建议优先补强不符合项，或在差距分析中生成整改任务。':''}</div></div>`;
  window.scrollTo({top:$('#fcResult').offsetTop-80,behavior:'smooth'});
}
function fillFinSample(){
  const demo={ftype:'生产型',y:'2025',tax:'A级',assets:58200,liab:32600,cash:8600,cura:28400,curl:19800,
    ocf:4350,revenue:60200,cost:48900,opprofit:6120,netprofit:5240,totalprofit:6200,interest:480};
  $('#fc_ftype').value=demo.ftype;$('#fc_tax').value=demo.tax;
  FIN_IN.forEach(([k])=>{const el=$('#fc_'+k);if(el)el.value=demo[k]!=null?demo[k]:'';});
  $('#fc_y').value=demo.y;
  toast('已填入示例数据（华兴精密示例口径）');calcFin();
}
async function saveFinYear(){
  if(!_finResult){toast('请先测算',true);return;}
  const {v,r}=_finResult;
  const payload={...v,rate:r.dbr,rev:v.revenue?(v.revenue/10000).toFixed(2)+'亿':'',
    profit:v.netprofit?v.netprofit+'万':'',metrics:{debtOK:r.debtOK,profOK:r.profOK,
      ind:r.ind.map(i=>({code:i.code,name:i.name,val:i.val==null?null:Math.round(i.val*100)/100,pass:i.pass}))},
    verdict:r.verdict};
  try{
    await reload('finance');
    const exist=CACHE.finance.find(f=>String(f.y)===String(v.y));
    if(exist){ if(!confirm(v.y+' 年度已有记录，覆盖更新？'))return; await api('/finance/'+exist.id,'PUT',payload); }
    else await api('/finance','POST',payload);
    toast('已保存年度记录');go('fincalc');
  }catch(e){toast(e.message,true);}
}
function loadFinYear(id){
  const f=CACHE.finance.find(x=>x.id===id);if(!f)return;
  $('#fc_ftype').value=f.ftype||'非生产型';$('#fc_tax').value=f.tax||'A级';
  FIN_IN.forEach(([k])=>{const el=$('#fc_'+k);if(el)el.value=f[k]!=null&&f[k]!==0?f[k]:(k==='y'?f.y:'');});
  $('#fc_y').value=f.y||'';
  toast('已载入 '+f.y+' 年度数据');if(f.assets)calcFin();
}
async function writeBackSA(){
  if(!_finResult){toast('请先测算',true);return;}
  const {r}=_finResult;
  if(!confirm('将按测算结果回写标准自评 2.2–2.10 各指标状态及 2.11 综合判定，确认？'))return;
  try{
    await reload('standards');
    let n=0;
    for(const i of r.ind){
      const s=CACHE.standards.find(x=>x.code===i.code);
      if(s){await api('/standards/'+s.id,'PUT',{status:i.pass?'达标':'不达标',
        note:(i.pass?'':'测算不符合：')+i.name+'='+(i.val==null?'—':Math.round(i.val*100)/100)+i.unit+'（规则 '+i.rule+'）'});n++;}
    }
    const s11=CACHE.standards.find(x=>x.code==='2.11');
    if(s11){await api('/standards/'+s11.id,'PUT',{status:r.verdict,
      note:'财务测算：偿债 '+r.debtOK+'/4 · 盈利 '+r.profOK+'/5 → '+r.verdict});n++;}
    toast('已回写 '+n+' 个条款');refreshBadge();
  }catch(e){toast(e.message,true);}
}
function exportFinReport(){
  if(!_finResult){toast('请先测算',true);return;}
  const {v,r}=_finResult;const th=finTh();
  const html=`<html><head><meta charset="utf-8"><title>AEO财务指标测算报告</title><style>
    body{font-family:"Microsoft YaHei",sans-serif;color:#1f2a37;padding:30px}h1{font-size:20px;margin:0 0 4px}
    h2{font-size:14px;margin:16px 0 6px;border-left:4px solid #e84368;padding-left:8px}
    .sum{color:#555;font-size:13px;margin:3px 0}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
    th,td{border:1px solid #999;padding:5px 8px;text-align:left}thead th{background:#252f45;color:#fff}
    .v{font-size:16px;font-weight:800}.ft{margin-top:18px;color:#888;font-size:11px}</style></head><body>
    <h1>喜事达 AEO 高级认证 · 财务指标测算报告（${esc(v.y)} 年度）</h1>
    <div class="sum">依据：海关总署公告2026年第34号 财务状况标准（9项指标） · 企业类型：${esc(v.ftype)} · 生成时间：${new Date().toLocaleString('zh-CN',{hour12:false})}</div>
    <div class="sum">综合判定：<span class="v">${r.verdict}</span>（偿债 ${r.debtOK}/4 · 盈利 ${r.profOK}/5；规则：偿债≥2且盈利≥2为达标，各仅1项为基本达标）</div>
    <h2>测算明细</h2>
    <table><thead><tr><th>条款</th><th>指标</th><th>测算值</th><th>判定规则</th><th>结果</th></tr></thead><tbody>
    ${r.ind.map(i=>`<tr><td>${i.code}</td><td>${i.name}</td><td>${i.val==null?'—':(Math.round(i.val*100)/100)+' '+i.unit}</td><td>${i.rule}</td><td>${i.pass?'符合':'不符合'}</td></tr>`).join('')}
    </tbody></table>
    <h2>录入基础数据（万元）</h2>
    <table><tbody>${FIN_IN.slice(1).map(([k,lbl])=>`<tr><td>${lbl}</td><td style="text-align:right">${v[k]}</td></tr>`).join('')}</tbody></table>
    <div class="ft">阈值口径：资产负债率上限 生产型${th.dbrProd}%/非生产型${th.dbrNon}%、现金比率≥${th.cashRatio}%、经营现金流负债比≥${th.ocfLiab}%、流动比率≥${th.curRatio}。本报告由系统按可配置阈值自动测算，最终以海关认定为准。${(window.APP_VERSION||'')}</div>
    </body></html>`;
  const w=window.open('','_blank');if(!w){alert('请允许弹出窗口以导出报告');return;}
  w.document.write(html);w.document.close();w.focus();setTimeout(()=>{try{w.print();}catch(e){}},400);
}

/* 功能③：法规与政策库 */
VIEWS.regs=async()=>{
  const items=[
    ['海关总署公告2026年第34号','《海关高级认证企业标准》《海关认证企业标准》（2026/4/1施行，废止2022年第106号、114号）','http://www.customs.gov.cn/customs/2026-03/31/article_2026033114511949415.html'],
    ['海关总署令第282号','《海关注册登记和备案企业信用管理办法》（2026/4/1施行）',''],
    ['SAFE标准框架（2025版）','世界海关组织《全球贸易安全与便利标准框架》，AEO制度国际互认依据','']
  ];
  const atts=[
    ['附件1 《海关企业认证标准》说明','http://www.customs.gov.cn/customs/attachDir/2026/04/1.%E3%80%8A%E6%B5%B7%E5%85%B3%E4%BC%81%E4%B8%9A%E8%AE%A4%E8%AF%81%E6%A0%87%E5%87%86%E3%80%8B%E8%AF%B4%E6%98%8E.doc'],
    ['附件2 《海关高级认证企业标准》（通用标准—进出口收发货人）★ 本平台依据','http://www.customs.gov.cn/customs/attachDir/2026/04/2.%E3%80%8A%E6%B5%B7%E5%85%B3%E9%AB%98%E7%BA%A7%E8%AE%A4%E8%AF%81%E4%BC%81%E4%B8%9A%E6%A0%87%E5%87%86%E3%80%8B%EF%BC%88%E9%80%9A%E7%94%A8%E6%A0%87%E5%87%86%E2%80%94%E8%BF%9B%E5%87%BA%E5%8F%A3%E6%94%B6%E5%8F%91%E8%B4%A7%E4%BA%BA%EF%BC%89.doc'],
    ['附件4 《海关高级认证企业标准》（单项标准）','http://www.customs.gov.cn/customs/attachDir/2026/04/4.%E3%80%8A%E6%B5%B7%E5%85%B3%E9%AB%98%E7%BA%A7%E8%AE%A4%E8%AF%81%E4%BC%81%E4%B8%9A%E6%A0%87%E5%87%86%E3%80%8B%EF%BC%88%E5%8D%95%E9%A1%B9%E6%A0%87%E5%87%86%EF%BC%89.doc'],
  ];
  let h=`<div class="section-title">法规与政策库 <small>AEO 认证依据与最新动态</small></div>
  <div class="card"><h3>2026版标准修订要点（公告第34号）</h3>
   <ul style="margin:10px 0 0;padding-left:20px;line-height:2.05">
    <li>通用标准细分为「进出口货物收发货人」与「报关企业」2类；单项标准由 10 类精简为 4 类</li>
    <li>保留 内部控制 / 财务状况 / 守法规范 / 贸易安全 四大核心模块（对标 SAFE 2025）</li>
    <li>财务状况改为 9 项指标（4 项偿债 + 5 项盈利），区分生产型/非生产型，新增达标判定规则</li>
    <li>内部控制新增「禁限及两用物项审查」单独分项</li>
    <li>守法规范覆盖面扩展至更多关联主体，量化要求增加</li>
    <li>新增 附加标准（加分项）：每项 +1 分，高级认证最多累计 +2 分</li>
    <li>建立容错整改机制：除附加标准外可申请整改，整改期 6 个月 / 1 年，期间保留信用等级</li>
   </ul></div>
  <div class="card" style="margin-top:14px"><h3>核心法规文件</h3>
   <table><thead><tr><th>文号</th><th>名称</th><th>链接</th></tr></thead><tbody>
   ${items.map(it=>`<tr><td><b>${esc(it[0])}</b></td><td>${esc(it[1])}</td><td>${it[2]?`<a href="${it[2]}" target="_blank" rel="noopener" style="color:var(--brand2)">官方原文 ↗</a>`:'—'}</td></tr>`).join('')}
   </tbody></table>
   <div style="margin-top:14px"><b style="font-size:13px">官方附件下载（海关总署）</b>
   <table style="margin-top:6px"><tbody>
   ${atts.map(a=>`<tr><td>${esc(a[0])}</td><td style="text-align:right"><a href="${a[1]}" target="_blank" rel="noopener" style="color:var(--brand2)">下载 .doc ↗</a></td></tr>`).join('')}
   </tbody></table></div>
   <div class="alert info" style="margin-top:12px"><span class="ai">ℹ</span><div>标准逐条原文以海关总署公告附件为准；可下载附件2后，在「标准自评 → 编辑」中将官方原文逐条粘贴到各条款的「官方逐字原文」字段，详情页与海关现场口径即可逐字对齐。</div></div>
  </div>`;
  $('#content').innerHTML=h;
};

/* ---- 内审 ---- */
const AUD_FIELDS=[
  {key:'no',label:'内审编号',required:true},{key:'scope',label:'审计范围',full:true},
  {key:'date',label:'周期'},{key:'lead',label:'负责人'},
  {key:'find',label:'发现问题数',type:'number'},{key:'closed',label:'已闭环数',type:'number'},
  {key:'status',label:'状态',type:'select',options:['计划中','整改中','已结案']}];
VIEWS.audit=async()=>{
  await reload('audits');const w=canW('audit');const list=CACHE.audits;
  const tot=list.reduce((s,a)=>s+a.find,0),cl=list.reduce((s,a)=>s+a.closed,0);
  let h=`<div class="section-title">内部审计计划与记录 <small>公告2026年第34号 1.8 内审制度 / 1.9 改进机制</small>${w?'<button class="btn sm" onclick="addAud()">+ 新增内审</button>':''}</div>
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
  let h=`<div class="section-title">货物物流与集装箱安全 <small>公告2026年第34号 4.4 货物 / 4.5 集装箱 / 4.6 运输工具</small>${w?'<button class="btn sm" onclick="addCon()">+ 新增集装箱</button>':''}</div>
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
  let h=`<div class="section-title">财务状况记录 <small>公告2026年第34号 · 9项指标（偿债4+盈利5）· 生产型/非生产型差异化</small>
    <button class="btn sm" style="margin-left:auto" onclick="go('fincalc')">∑ 9项指标自动测算</button>${w?'<button class="btn sm" onclick="addFin()">+ 新增年度</button>':''}</div>
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
  <div class="card" style="padding:0">${list.length?`<table><thead><tr><th>年度</th><th>营业收入</th><th>净利润</th><th>资产负债率</th><th>纳税信用</th><th>9项指标判定</th><th>操作</th></tr></thead><tbody>
    ${list.map(f=>`<tr><td><b>${esc(f.y)}</b></td><td>${esc(f.rev)}</td><td>${esc(f.profit)}</td><td>${f.rate}%</td>
      <td><span class="tag t-ok">${esc(f.tax)}</span></td>
      <td>${f.verdict?statTag(f.verdict):'<span class="mini"><a style="color:var(--brand2);cursor:pointer" onclick="go(\'fincalc\')">未测算 →</a></span>'}</td>
      <td>${actBtns('finance',`editFin(${f.id})`,`crudDelete('finance',${f.id})`)}</td></tr>`).join('')}
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
  let h=`<div class="section-title">商业伙伴安全评估 <small>公告2026年第34号 4.7 商业伙伴安全</small>${w?'<button class="btn sm" onclick="addPt()">+ 新增伙伴</button>':''}</div>
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
  let h=`<div class="section-title">培训管理 <small>公告2026年第34号 4.9 海关业务与贸易安全培训</small>${w?'<button class="btn sm" onclick="addTr()">+ 新增培训</button>':''}</div>
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
    <div class="k">产品</div><div>喜事达AEO认证管理平台 ${window.APP_VERSION||'v1.0'}${window.APP_BUILD?'（构建 '+window.APP_BUILD+'）':''}</div>
    <div class="k">依据标准</div><div>《海关高级认证企业标准》（海关总署公告2026年第34号，2026/4/1施行）</div>
    <div class="k">信用管理</div><div>海关总署令第282号</div>
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
