// ===== Dashboard =====
export async function mountDashboard() {
  try {
    // ดึง session ของ user ที่ login อยู่
    const { data: { user } } = await supa.auth.getUser();
    if (!user) {
      console.warn("No user logged in");
      return;
    }

    // ดึงข้อมูลเคสทั้งหมดของ user นี้
    const { data: cases, error } = await supa
      .from('cases')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      console.error("Error fetching cases:", error.message);
      return;
    }

    if (!cases || cases.length === 0) {
      console.warn("No cases found for this user");
      return;
    }

    // ใส่ข้อมูลเคสลง UI
    const $id = (s) => document.querySelector(s);
    const firstCase = cases[0]; // สมมติแสดงเคสแรกก่อน

    $id('#caseNo') && ($id('#caseNo').textContent = firstCase.case_number);
    $id('#caseStatus') && ($id('#caseStatus').textContent = firstCase.status);
    $id('#tradeName') && ($id('#tradeName').textContent = firstCase.trade_name);
    $id('#commonName') && ($id('#commonName').textContent = firstCase.common_name);

  } catch (err) {
    console.error("Unexpected error:", err);
  }
}
