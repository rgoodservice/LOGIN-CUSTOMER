// ===== Dashboard =====
export async function mountDashboard(caseCode){
  // ดึงเคสด้วยคอลัมน์ case_number (ไม่ใช่ code)
  const { data: cs, error } = await supa
    .from('cases')
    .select('*')
    .eq('case_number', caseCode)
    .maybeSingle();

  if (error) { console.error(error); return; }
  if (!cs) { console.warn('Case not found or no permission'); return; }

  // ใส่ค่าลง UI (ตั้งชื่อคอลัมน์ให้ตรงกับตารางของเรา)
  const $id = (s)=>document.querySelector(s);
  $id('#caseNo')        && ($id('#caseNo').textContent        = cs.case_number || '-');
  $id('#caseStatus')    && ($id('#caseStatus').textContent    = cs.status      || '-');
  $id('#dueDate')       && ($id('#dueDate').textContent       = cs.due_date    || '-');
  $id('#tradeName')     && ($id('#tradeName').textContent     = cs.trade_name  || '-');
  $id('#commonName')    && ($id('#commonName').textContent    = cs.common_name || '-');

  renderProgress(cs.progress ?? 0);

  // ถ้ามี stepper/ไทม์ไลน์ให้โหลดเพิ่มเองตามที่ใช้จริง
  // (ตัวอย่างนี้ยังไม่ดึง steps)

  // subscribe real-time เปลี่ยนแปลงของเคสนี้
  supa.channel('rt:cases')
    .on('postgres_changes', { event:'*', schema:'public', table:'cases', filter:`id=eq.${cs.id}` }, (p)=>{
      const row = p.new || p.old;
      $id('#caseStatus') && ($id('#caseStatus').textContent = row.status || '-');
      renderProgress(row.progress ?? 0);
    })
    .subscribe();

  function renderProgress(pct){
    const p = Math.max(0, Math.min(100, Number(pct) || 0));
    const bar = $id('#progressFill');
    const txt = $id('#progressPct');
    if (bar) bar.style.width = p + '%';
    if (txt) txt.textContent = p + '%';
  }

  // action ปุ่มต่าง ๆ (ถ้ามี)
  window.dashboardActions = {
    async next(){ /* TODO */ },
    async back(){ /* TODO */ },
    async reset(){ /* TODO */ },
    async completeAll(){ /* TODO */ }
  };
}
