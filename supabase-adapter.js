import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

export const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== Dashboard (รายละเอียดเคสเดี่ยว) =====
export async function mountDashboard(caseCode){
  const { data: cs, error } = await supa
    .from('cases')
    .select('*')
    .eq('case_number', caseCode)
    .maybeSingle();

  if (error) { console.error(error); return; }
  if (!cs) { console.warn('Case not found'); return; }

  const $id = (s)=>document.querySelector(s);
  $id('#caseNo')     && ($id('#caseNo').textContent     = cs.case_number);
  $id('#caseStatus') && ($id('#caseStatus').textContent = cs.status);
  $id('#tradeName')  && ($id('#tradeName').textContent  = cs.trade_name);
  $id('#commonName') && ($id('#commonName').textContent = cs.common_name);
  $id('#notes')      && ($id('#notes').textContent      = cs.notes || '-'); // ✅ เพิ่มโน้ต

  renderProgress(cs.progress ?? 0);

  function renderProgress(pct){
    const p = Math.max(0, Math.min(100, Number(pct) || 0));
    const bar = $id('#progressFill');
    const txt = $id('#progressPct');
    if (bar) bar.style.width = p + '%';
    if (txt) txt.textContent = p + '%';
  }

  // subscribe real-time
  supa.channel('rt:cases')
    .on('postgres_changes', { event:'*', schema:'public', table:'cases', filter:`id=eq.${cs.id}` }, (p)=>{
      const row = p.new || p.old;
      $id('#caseStatus') && ($id('#caseStatus').textContent = row.status || '-');
      $id('#notes')      && ($id('#notes').textContent      = row.notes || '-'); // ✅ update real-time ด้วย
      renderProgress(row.progress ?? 0);
    })
    .subscribe();
}

// ===== My Cases List (ทุกเคสของฉัน) =====
export async function renderMyCasesList(userId){
  const tbody = document.getElementById("myCasesTbody");
  const empty = document.getElementById("myCasesEmpty");
  const wrap  = document.getElementById("myCasesTableWrap");

  tbody.innerHTML = "<tr><td colspan='7'>⏳ กำลังโหลด...</td></tr>";

  const { data, error } = await supa
    .from("cases")
    .select("id, case_number, trade_name, common_name, status, progress, due_date, notes")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if(error){
    console.error(error);
    tbody.innerHTML = "<tr><td colspan='7'>❌ โหลดข้อมูลผิดพลาด</td></tr>";
    return;
  }

  if(!data || data.length === 0){
    tbody.innerHTML = "<tr><td colspan='7'>ยังไม่มีเคส</td></tr>";
    wrap.style.display = "none";
    return;
  }

  empty.style.display = "none";
  wrap.style.display = "block";

  tbody.innerHTML = data.map(c => {
    const due = c.due_date ? new Date(c.due_date).toLocaleDateString('th-TH') : '-';
    const pct = (c.progress ?? 0) + '%';
    const code = encodeURIComponent(c.case_number);
    return `
      <tr>
        <td>${c.case_number}</td>
        <td>${c.trade_name || '-'}</td>
        <td>${c.common_name || '-'}</td>
        <td>${c.status || '-'}</td>
        <td>${pct}</td>
        <td>${due}</td>
        <td>${c.notes || '-'}</td>
      </tr>
    `;
  }).join("");

  // subscribe real-time
  supa.channel('rt:mycases')
    .on('postgres_changes', { event:'*', schema:'public', table:'cases', filter:`user_id=eq.${userId}` }, () => {
      renderMyCasesList(userId);
    })
    .subscribe();
}
