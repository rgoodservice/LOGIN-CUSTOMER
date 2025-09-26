// ===== Supabase Client =====
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

export const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== Login =====
export async function login(email, password) {
  const { error } = await supa.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return true;
}

// ===== Logout =====
export async function logout() {
  await supa.auth.signOut();
  location.href = "index.html";
}

// ===== Dashboard (ดูรายละเอียดเคสเดียว) =====
export async function mountDashboard(caseCode) {
  const { data: { user } } = await supa.auth.getUser();
  if (!user) {
    alert("โปรดเข้าสู่ระบบก่อน");
    location.href = "index.html";
    return;
  }

  const { data: cs, error } = await supa
    .from("cases")
    .select("*")
    .eq("case_number", caseCode)
    .eq("user_id", user.id) // กรองให้แน่ใจว่าเป็นเคสของ user นี้
    .maybeSingle();

  if (error) {
    console.error("โหลดเคสผิดพลาด:", error.message);
    return;
  }
  if (!cs) {
    alert("ไม่พบเคสนี้ หรือคุณไม่มีสิทธิ์เข้าถึง");
    location.href = "index.html";
    return;
  }

  const $ = (s) => document.querySelector(s);
  $("#caseNo") && ($("#caseNo").textContent = cs.case_number);
  $("#caseStatus") && ($("#caseStatus").textContent = cs.status);
  $("#tradeName") && ($("#tradeName").textContent = cs.trade_name);
  $("#commonName") && ($("#commonName").textContent = cs.common_name);
  $("#dueDate") && ($("#dueDate").textContent = cs.due_date || "-");
  $("#notes") && ($("#notes").textContent = cs.notes || "-");

  renderProgress(cs.progress ?? 0);

  // subscribe real-time เปลี่ยนสถานะ/เปอร์เซ็นต์
  supa.channel("rt:cases")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "cases", filter: `id=eq.${cs.id}` },
      (p) => {
        const row = p.new || p.old;
        $("#caseStatus") && ($("#caseStatus").textContent = row.status || "-");
        $("#notes") && ($("#notes").textContent = row.notes || "-");
        renderProgress(row.progress ?? 0);
      }
    )
    .subscribe();

  function renderProgress(pct) {
    const p = Math.max(0, Math.min(100, Number(pct) || 0));
    const bar = $("#progressFill");
    const txt = $("#progressPct");
    if (bar) bar.style.width = p + "%";
    if (txt) txt.textContent = p + "%";
  }
}

// ===== My Cases List (ดูทุกเคสของ user) =====
export async function renderMyCasesList(userId) {
  const tbody = document.getElementById("myCasesTbody");
  tbody.innerHTML = "<tr><td colspan='7'>⏳ กำลังโหลด...</td></tr>";

  const { data, error } = await supa
    .from("cases")
    .select("id, case_number, trade_name, common_name, status, progress, due_date, notes")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    tbody.innerHTML = "<tr><td colspan='7'>❌ โหลดข้อมูลผิดพลาด</td></tr>";
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = "<tr><td colspan='7'>ยังไม่มีเคส</td></tr>";
    return;
  }

  tbody.innerHTML = data
    .map((c) => {
      const due = c.due_date ? new Date(c.due_date).toLocaleDateString("th-TH") : "-";
      return `
        <tr>
          <td>${c.case_number}</td>
          <td>${c.trade_name || "-"}</td>
          <td>${c.common_name || "-"}</td>
          <td>${c.status || "-"}</td>
          <td>${c.progress ?? 0}%</td>
          <td>${due}</td>
          <td>${c.notes || "-"}</td>
        </tr>
      `;
    })
    .join("");

  // subscribe real-time อัปเดตอัตโนมัติ
  supa.channel("rt:mycases")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "cases", filter: `user_id=eq.${userId}` },
      () => {
        renderMyCasesList(userId);
      }
    )
    .subscribe();
}
