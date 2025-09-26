// supabase-adapter.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

export const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (s)=>document.querySelector(s);
export function setAdminUI(on){ document.querySelectorAll('.admin-only').forEach(el=> el.style.display = on? 'inline-flex':'none'); }

export async function login(email, password){
  const { data, error } = await supa.auth.signInWithPassword({ email, password });
  if(error) throw error; return data.user;
}
export async function logout(){ await supa.auth.signOut(); }

// ===== Dashboard =====
export async function mountDashboard(caseCode){
  const { data: cs } = await supa.from('cases').select('*').eq('code', caseCode).single();
  if(!cs){ console.warn('Case not found'); return; }
  $('#caseNo') && ($('#caseNo').textContent = cs.code || '-');
  $('#caseStatus') && ($('#caseStatus').textContent = cs.status || '-');
  $('#dueDate') && ($('#dueDate').textContent = cs.due_date || '-');
  $('#tradeName') && ($('#tradeName').textContent = cs.product_trade || '-');
  $('#commonName') && ($('#commonName').textContent = cs.product_common || '-');
  renderProgress(cs.progress_pct || 0);
  await reloadSteps(cs.id);

  supa.channel('rt:cases')
    .on('postgres_changes', { event:'*', schema:'public', table:'cases', filter:`id=eq.${cs.id}` }, (p)=>{
      const row = p.new || p.old; renderProgress(row.progress_pct||0);
      $('#caseStatus') && ($('#caseStatus').textContent = row.status || '-');
    }).subscribe();

  supa.channel('rt:steps')
    .on('postgres_changes', { event:'*', schema:'public', table:'case_steps', filter:`case_id=eq.${cs.id}` }, reloadSteps.bind(null, cs.id))
    .subscribe();

  async function reloadSteps(caseId){
    const { data: steps } = await supa.from('case_steps').select('*').eq('case_id', caseId).order('step_index', {ascending:true});
    const holder = $('#stepper'); if(!holder) return; holder.innerHTML='';
    (steps||[]).forEach(s=>{
      const div = document.createElement('div');
      div.className = 'step ' + (s.state||'pending');
      div.innerHTML = `<div style="font-weight:700">${s.label}</div><div class="muted" style="font-size:11px">${s.step_date||'—'}</div>`;
      holder.appendChild(div);
    });
  }
  function renderProgress(pct){ const p = Math.max(0,Math.min(100,Number(pct)||0)); $('#progressPct')&&($('#progressPct').textContent=p+'%'); $('#progressFill')&&($('#progressFill').style.width=p+'%'); }

  window.dashboardActions = {
    async next(){ await fetch('/_noop'); }, // stub: wire to your admin UI or keep read-only
    async back(){}, async reset(){}, async completeAll(){}
  };
}

// ===== Timeline =====
export async function mountTimeline(caseCode){
  const { data: cs } = await supa.from('cases').select('id,code').eq('code', caseCode).single();
  if(!cs){ return; }
  async function render(){
    const { data } = await supa.from('case_timeline').select('*').eq('case_id', cs.id).order('created_at', {ascending:false});
    const wrap = $('#timeline'); if(!wrap) return; wrap.innerHTML='';
    (data||[]).forEach(row=>{
      const st = row.status || 'pending';
      const item = document.createElement('div'); item.className = 'item state-'+st;
      item.innerHTML = `<div class="dot"></div><div class="card">
          <div class="title">${row.text}</div>
          <div class="meta">${new Date(row.created_at).toLocaleString('th-TH')}</div>
          <span class="badge">${st==='success'?'ผ่าน':st==='danger'?'ตีกลับ':'รอ'}</span></div>`;
      wrap.appendChild(item);
    });
  }
  render();
  supa.channel('rt:timeline')
    .on('postgres_changes', { event:'*', schema:'public', table:'case_timeline', filter:`case_id=eq.${cs.id}` }, render)
    .subscribe();
  window.timelineActions = {
    async add(text, status='pending'){
      const user = (await supa.auth.getUser()).data.user; if(!user){ alert('โปรดล็อกอิน'); return; }
      await supa.from('case_timeline').insert({ case_id: cs.id, text, status });
    }
  };
}
