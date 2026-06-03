import React from "react";
import { useState, useEffect } from "react";

const SB_URL = "https://izocgtpagsiezyrgmszu.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6b2NndHBhZ3NpZXp5cmdtc3p1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MzI4MzMsImV4cCI6MjA5NjAwODgzM30.Ob3Y5euIhyNFj9A0QwuHd96xXpeDWedhAUxchIdnRhc";

const sb = async (path, opts = {}) => {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json", Prefer: "return=representation", ...opts.headers },
    ...opts,
  });
  if (!res.ok) { const e = await res.text(); throw new Error(e); }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
};

const dbGet = (table, query = "") => sb(`${table}?order=created_at.asc${query}`);
const dbInsert = (table, row) => sb(table, { method: "POST", body: JSON.stringify(row) });
const dbUpdate = (table, id, row) => sb(`${table}?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(row) });
const dbDelete = (table, id) => sb(`${table}?id=eq.${id}`, { method: "DELETE" });

// 이미지 업로드 - Supabase Storage
const uploadImage = async (file) => {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const res = await fetch(`${SB_URL}/storage/v1/object/images/${path}`, {
    method: "POST",
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": file.type || "image/jpeg" },
    body: file,
  });
  if (!res.ok) { const e = await res.text(); throw new Error(e); }
  return `${SB_URL}/storage/v1/object/public/images/${path}`;
};

const callClaude = async (prompt, imageBase64 = null) => {
  const content = imageBase64
    ? [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageBase64 } }, { type: "text", text: prompt }]
    : prompt;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content }] }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
};

const fmt = (d) => d ? new Date(d).toLocaleDateString("ko-KR") : "";
const today = () => new Date().toISOString().split("T")[0];
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const comma = (n) => Number(n || 0).toLocaleString("ko-KR");

// camelCase <-> snake_case
const toRow = (obj) => { const r = {}; Object.entries(obj).forEach(([k, v]) => { r[k.replace(/([A-Z])/g, "_$1").toLowerCase()] = v; }); return r; };
const toCamel = (obj) => { const r = {}; Object.entries(obj).forEach(([k, v]) => { r[k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = v; }); return r; };

const printHtml = (html) => {
  const w = window.open("", "_blank");
  w.document.write(`<html><head><style>*{font-family:sans-serif;font-size:12px;}body{padding:20px;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #333;padding:6px 8px;}th{background:#f0f0f0;}.title{font-size:20px;font-weight:700;text-align:center;margin-bottom:16px;}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;}.info-box{border:1px solid #ccc;padding:8px;}.total-row{font-weight:700;background:#f8f8f8;}</style></head><body>${html}</body></html>`);
  w.document.close(); w.print();
};

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [tab, setTab] = useState("dashboard");
  // partners 테이블 하나로 통합. isMyCompany 필드로 구분
  const [partners, setPartners] = useState([]);
  const [scales, setScales] = useState([]);
  const [statements, setStatements] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState(null);

  const loadAll = async () => {
    try {
      const [pt, sc, st] = await Promise.all([
        dbGet("partners"), dbGet("scales"), dbGet("statements"),
      ]);
      setPartners(pt.map(toCamel));
      setScales(sc.map(toCamel));
      setStatements(st.map(toCamel));
    } catch (e) { showToast("DB 오류: " + e.message, "err"); }
    setLoaded(true);
  };

  useEffect(() => { loadAll(); }, []);

  const showToast = (msg, type = "ok") => { setToast({ msg, type }); setTimeout(() => setToast(null), 2800); };

  const myCompanies = partners.filter(p => p.isMyCompany);
  const extPartners = partners.filter(p => !p.isMyCompany);

  if (!loaded) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: C.bg }}>
      <div style={{ width: 36, height: 36, border: `3px solid ${C.border}`, borderTop: `3px solid ${C.green}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <p style={{ color: C.green, marginTop: 12, fontSize: 14 }}>연결 중...</p>
    </div>
  );

  const tabs = [
    { id: "dashboard", label: "홈" },
    { id: "companies", label: "사업자" },
    { id: "partners", label: "거래처" },
    { id: "scale", label: "계근표" },
    { id: "statement", label: "명세서" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: C.bg, fontFamily: "sans-serif", color: C.text }}>
      <header style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 16px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: C.textBright }}>RecycleERP</div>
        <div style={{ fontSize: 11, color: C.textDim }}>사업자 {myCompanies.length} · 거래처 {extPartners.length}</div>
      </header>

      <main style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
        {tab === "dashboard"  && <Dashboard mc={myCompanies} pt={extPartners} sc={scales} st={statements} setTab={setTab} />}
        {tab === "companies"  && <CompanyTab list={partners} toast={showToast} reload={loadAll} isMyCompany={true} />}
        {tab === "partners"   && <CompanyTab list={partners} toast={showToast} reload={loadAll} isMyCompany={false} />}
        {tab === "scale"      && <ScaleTab scales={scales} mc={myCompanies} pt={extPartners} toast={showToast} reload={loadAll} />}
        {tab === "statement"  && <StatementTab stmts={statements} mc={myCompanies} pt={extPartners} scales={scales} toast={showToast} reload={loadAll} />}
      </main>

      <nav style={{ background: C.surface, borderTop: `1px solid ${C.border}`, display: "flex", flexShrink: 0, paddingBottom: "env(safe-area-inset-bottom)" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, padding: "10px 4px 8px", border: "none", background: "transparent", color: tab === t.id ? C.green : C.textDim, fontWeight: tab === t.id ? 700 : 400, fontSize: 12, cursor: "pointer", borderTop: tab === t.id ? `2px solid ${C.green}` : "2px solid transparent" }}>
            {t.label}
          </button>
        ))}
      </nav>

      {toast && (
        <div style={{ position: "fixed", bottom: 72, left: "50%", transform: "translateX(-50%)", background: toast.type === "err" ? "#dc2626" : "#16a34a", color: "white", padding: "10px 20px", borderRadius: 20, fontWeight: 600, fontSize: 13, zIndex: 999, whiteSpace: "nowrap" }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function Dashboard({ mc, pt, sc, st, setTab }) {
  const m = new Date().toISOString().slice(0, 7);
  const mSc = sc.filter(s => s.date?.startsWith(m));
  const mSt = st.filter(s => s.date?.startsWith(m));
  const totalW = mSc.reduce((a, s) => a + Number(s.netWeight || 0), 0);
  const totalSales = mSt.filter(s => s.type === "매출").reduce((a, s) => a + Number(s.totalAmount || 0), 0);
  const totalPurchase = mSt.filter(s => s.type === "매입").reduce((a, s) => a + Number(s.totalAmount || 0), 0);
  const cards = [
    { label: "우리 사업자", value: mc.length + "개", tab: "companies", color: C.green },
    { label: "거래처", value: pt.length + "개", tab: "partners", color: C.blue },
    { label: "이달 계근", value: mSc.length + "건", tab: "scale", color: "#fb923c" },
    { label: "이달 순중량", value: comma(Math.round(totalW)) + "kg", tab: "scale", color: "#f472b6" },
    { label: "이달 매출", value: "₩" + comma(totalSales), tab: "statement", color: C.green },
    { label: "이달 매입", value: "₩" + comma(totalPurchase), tab: "statement", color: "#7c3aed" },
  ];
  const recent = [...sc].sort((a, b) => b.date?.localeCompare(a.date)).slice(0, 5);
  return (
    <div style={P.page}>
      <p style={{ fontSize: 13, color: C.textDim, marginBottom: 14 }}>{new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long" })} 현황</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
        {cards.map(c => (
          <button key={c.label} onClick={() => setTab(c.tab)} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 12px", textAlign: "left", cursor: "pointer" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 3 }}>{c.label}</div>
          </button>
        ))}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.textMid, marginBottom: 10 }}>최근 계근</div>
      {recent.length === 0 ? <Empty text="계근 내역 없음" /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {recent.map(s => (
            <div key={s.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: C.textDim }}>{fmt(s.date)}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.green }}>₩{comma(s.amount)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.textBright }}>{s.partnerName}</span>
                <span style={{ fontSize: 12, color: C.textDim }}>{s.item} {comma(s.netWeight)}kg</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  COMPANY TAB (우리 사업자 & 거래처 통합 컴포넌트)
// ═══════════════════════════════════════════════════════════════════════════════
function CompanyTab({ list, toast, reload, isMyCompany }) {
  const shown = list.filter(p => !!p.isMyCompany === isMyCompany);
  const empty = { id: "", name: "", bizNo: "", ceo: "", address: "", bizType: "", bizItem: "", tel: "", fax: "", bank: "", account: "", accountHolder: "", email: "", memo: "", photo: "", isMyCompany };
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);

  const filtered = shown.filter(p => !search || p.name?.includes(search) || p.bizNo?.includes(search) || p.ceo?.includes(search));
  const open = (item = null) => { setForm(item ? { ...item } : { ...empty, id: genId() }); setEditing(!!item); };
  const close = () => setForm(null);

  // ── 사진 업로드 (Supabase Storage) ──
  const handlePhoto = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      setForm(f => ({ ...f, photo: url }));
      toast("사진 업로드 완료!");
    } catch (err) { toast("업로드 실패: " + err.message, "err"); }
    finally { setUploading(false); }
  };

  // ── 사업자등록증 OCR ──
  const handleOCR = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setParsing(true);
    try {
      const base64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.onerror = rej; r.readAsDataURL(file); });
      const prompt = `이 사업자등록증에서 JSON만 추출: {"name":"상호명","bizNo":"사업자번호(000-00-00000)","ceo":"대표자","address":"주소","bizType":"업태","bizItem":"종목","tel":"전화번호"} 값없으면 빈문자열.`;
      const result = await callClaude(prompt, base64);
      const parsed = JSON.parse(result.replace(/```json|```/g, "").trim());
      setForm(f => ({ ...f, ...parsed }));
      toast("파싱 완료! 확인 후 저장하세요");
    } catch { toast("파싱 실패", "err"); }
    finally { setParsing(false); }
  };

  const submit = async () => {
    if (!form.name) { toast("상호명 필수", "err"); return; }
    setSaving(true);
    try {
      const row = toRow({ ...form, isMyCompany: isMyCompany });
      if (editing) await dbUpdate("partners", form.id, row);
      else await dbInsert("partners", row);
      await reload(); toast(editing ? "수정됨" : "등록됨"); close();
    } catch (e) { toast("저장 실패: " + e.message, "err"); }
    finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!confirm("삭제하시겠습니까?")) return;
    try { await dbDelete("partners", id); await reload(); toast("삭제됨"); }
    catch { toast("삭제 실패", "err"); }
  };

  const title = isMyCompany ? "우리 사업자" : "거래처";

  return (
    <div style={P.page}>
      <div style={P.header}>
        <div style={P.title}>{title} ({shown.length})</div>
        <div style={{ display: "flex", gap: 6 }}>
          {/* 사업자등록증 OCR */}
          <FileBtn label={parsing ? "파싱중..." : "등록증"} onChange={handleOCR} disabled={parsing} />
          <button style={B.primary} onClick={() => open()}>+ 추가</button>
        </div>
      </div>

      <input style={{ ...inp, marginBottom: 12 }} placeholder="상호명 / 사업자번호 / 대표자..."
        value={search} onChange={e => setSearch(e.target.value)} />

      {filtered.length === 0 ? <Empty text={`등록된 ${title} 없음`} /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(p => (
            <div key={p.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "12px 14px", display: "flex", gap: 10, alignItems: "center" }}
                onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                {p.photo
                  ? <img src={p.photo} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                  : <div style={{ width: 40, height: 40, borderRadius: 6, background: C.bg, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: C.textDim }}>사진</div>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.textBright, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: C.textDim, marginTop: 1 }}>{p.bizNo}{p.ceo ? ` · ${p.ceo}` : ""}</div>
                </div>
                <div style={{ fontSize: 12, color: C.textDim, flexShrink: 0 }}>{expanded === p.id ? "▲" : "▼"}</div>
              </div>
              {expanded === p.id && (
                <div style={{ borderTop: `1px solid ${C.border}`, padding: "10px 14px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 8px", marginBottom: 10 }}>
                    {[["전화", p.tel], ["팩스", p.fax], ["업태", p.bizType], ["종목", p.bizItem], ["은행", p.bank], ["계좌", p.account], ["예금주", p.accountHolder], ["이메일", p.email]].map(([k, v]) =>
                      v ? <div key={k} style={{ fontSize: 12, display: "flex", gap: 6 }}><span style={{ color: C.textDim, minWidth: 32 }}>{k}</span><span style={{ color: C.textMid }}>{v}</span></div> : null
                    )}
                    {p.address && <div style={{ fontSize: 12, display: "flex", gap: 6, gridColumn: "span 2" }}><span style={{ color: C.textDim, minWidth: 32 }}>주소</span><span style={{ color: C.textMid }}>{p.address}</span></div>}
                    {p.memo && <div style={{ fontSize: 12, display: "flex", gap: 6, gridColumn: "span 2" }}><span style={{ color: C.textDim, minWidth: 32 }}>메모</span><span style={{ color: C.textMid }}>{p.memo}</span></div>}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button style={B.sm} onClick={() => open(p)}>수정</button>
                    <button style={{ ...B.sm, ...B.danger }} onClick={() => del(p.id)}>삭제</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {form && (
        <Modal title={editing ? `${title} 수정` : `${title} 등록`} onClose={close} onSubmit={submit} saving={saving}>

          {/* ── 사진 업로드 ── */}
          <div style={{ marginBottom: 14, padding: 12, background: C.bg, borderRadius: 10, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 8 }}>로고 / 도장 이미지</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {form.photo
                ? <img src={form.photo} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                : <div style={{ width: 56, height: 56, borderRadius: 8, background: C.surface, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: C.textDim, flexShrink: 0 }}>사진없음</div>
              }
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {/* 핵심: input을 직접 보이게 + 스타일링 */}
                <label style={{ ...B.sm, cursor: "pointer", display: "inline-block", textAlign: "center" }}>
                  {uploading ? "업로드중..." : "갤러리에서 선택"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhoto}
                    disabled={uploading}
                    style={{ display: "block", width: "100%", marginTop: 4, fontSize: 12, color: C.textDim, cursor: "pointer" }}
                  />
                </label>
                {form.photo && <button style={{ ...B.sm, ...B.danger }} onClick={() => setForm(f => ({ ...f, photo: "" }))}>사진 삭제</button>}
              </div>
            </div>
          </div>

          {/* ── 등록증 OCR 버튼 ── */}
          <label style={{ ...B.secondary, display: "block", textAlign: "center", cursor: "pointer", marginBottom: 12 }}>
            {parsing ? "파싱중..." : "사업자등록증 사진으로 자동입력"}
            <input type="file" accept="image/*" onChange={handleOCR} disabled={parsing} style={{ display: "block", width: "100%", marginTop: 4, fontSize: 12, color: C.textDim, cursor: "pointer" }} />
          </label>

          <MF label="상호명 *" value={form.name} onChange={v => setForm({ ...form, name: v })} />
          <MF label="사업자번호" value={form.bizNo} onChange={v => setForm({ ...form, bizNo: v })} placeholder="000-00-00000" />
          <Row><MF label="대표자" value={form.ceo} onChange={v => setForm({ ...form, ceo: v })} /><MF label="전화번호" value={form.tel} onChange={v => setForm({ ...form, tel: v })} /></Row>
          <Row><MF label="업태" value={form.bizType} onChange={v => setForm({ ...form, bizType: v })} /><MF label="종목" value={form.bizItem} onChange={v => setForm({ ...form, bizItem: v })} /></Row>
          <Row><MF label="은행명" value={form.bank} onChange={v => setForm({ ...form, bank: v })} /><MF label="예금주" value={form.accountHolder} onChange={v => setForm({ ...form, accountHolder: v })} /></Row>
          <MF label="계좌번호" value={form.account} onChange={v => setForm({ ...form, account: v })} />
          {!isMyCompany && <MF label="이메일" value={form.email} onChange={v => setForm({ ...form, email: v })} />}
          <MF label="팩스" value={form.fax} onChange={v => setForm({ ...form, fax: v })} />
          <MF label="주소" value={form.address} onChange={v => setForm({ ...form, address: v })} />
          {!isMyCompany && <MF label="메모" value={form.memo} onChange={v => setForm({ ...form, memo: v })} />}
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SCALE
// ═══════════════════════════════════════════════════════════════════════════════
const ITEMS = ["구리", "전선", "황동", "알루미늄", "철", "스테인리스", "납", "아연", "기타"];

function ScaleTab({ scales, mc, pt, toast, reload }) {
  const empty = { id: "", date: today(), myCompanyId: "", partnerId: "", partnerName: "", vehicleNo: "", item: "구리", grossWeight: "", deduction: "", netWeight: "", unitPrice: "", amount: "", memo: "" };
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(false);
  const [filterMonth, setFilterMonth] = useState(today().slice(0, 7));
  const [expanded, setExpanded] = useState(null);
  const [saving, setSaving] = useState(false);

  const filtered = scales.filter(s => !filterMonth || s.date?.startsWith(filterMonth));
  const sorted = [...filtered].sort((a, b) => b.date?.localeCompare(a.date));
  const totalNet = filtered.reduce((a, s) => a + Number(s.netWeight || 0), 0);
  const totalAmt = filtered.reduce((a, s) => a + Number(s.amount || 0), 0);

  const calc = (f) => { const net = Math.max(0, Number(f.grossWeight || 0) - Number(f.deduction || 0)); return { ...f, netWeight: net, amount: Math.round(net * Number(f.unitPrice || 0)) }; };
  const setF = (patch) => setForm(prev => calc({ ...prev, ...patch }));
  const open = (item = null) => { setForm(item ? calc({ ...item }) : calc({ ...empty, id: genId() })); setEditing(!!item); };
  const close = () => setForm(null);

  const submit = async () => {
    if (!form.date || !form.partnerId) { toast("날짜·거래처 필수", "err"); return; }
    setSaving(true);
    try {
      const partner = pt.find(p => p.id === form.partnerId);
      const f = { ...form, partnerName: partner?.name || form.partnerName };
      if (editing) await dbUpdate("scales", f.id, toRow(f));
      else await dbInsert("scales", toRow(f));
      await reload(); toast(editing ? "수정됨" : "저장됨"); close();
    } catch (e) { toast("저장 실패", "err"); }
    finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!confirm("삭제?")) return;
    try { await dbDelete("scales", id); await reload(); toast("삭제됨"); }
    catch { toast("삭제 실패", "err"); }
  };

  const printScale = (s) => {
    const m = mc.find(c => c.id === s.myCompanyId) || {};
    const p = pt.find(x => x.id === s.partnerId) || {};
    printHtml(`<div class="title">계 근 표</div><div class="info-grid"><div class="info-box"><b>[공급자]</b><br/>${m.name || ""}<br/>사업자: ${m.bizNo || ""}<br/>대표: ${m.ceo || ""}</div><div class="info-box"><b>[공급받는자]</b><br/>${p.name || s.partnerName || ""}<br/>사업자: ${p.bizNo || ""}<br/>대표: ${p.ceo || ""}</div></div><table><tr><th>계근일자</th><td>${fmt(s.date)}</td><th>차량번호</th><td>${s.vehicleNo || ""}</td></tr><tr><th>품목</th><td colspan="3">${s.item}</td></tr><tr><th>총중량(kg)</th><td>${comma(s.grossWeight)}</td><th>공제(kg)</th><td>${comma(s.deduction)}</td></tr><tr><th>순중량(kg)</th><td><b>${comma(s.netWeight)}</b></td><th>단가(원/kg)</th><td>${comma(s.unitPrice)}</td></tr><tr><th>금액</th><td colspan="3"><b>₩ ${comma(s.amount)}</b></td></tr>${s.memo ? `<tr><th>메모</th><td colspan="3">${s.memo}</td></tr>` : ""}</table>`);
  };

  return (
    <div style={P.page}>
      <div style={P.header}>
        <div style={P.title}>계근표</div>
        <button style={B.primary} onClick={() => open()}>+ 입력</button>
      </div>
      <input type="month" style={{ ...inp, marginBottom: 12 }} value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
      {filtered.length > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", marginBottom: 12, display: "flex", justifyContent: "space-around" }}>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 11, color: C.textDim }}>건수</div><div style={{ fontSize: 15, fontWeight: 700, color: C.textBright }}>{filtered.length}건</div></div>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 11, color: C.textDim }}>순중량</div><div style={{ fontSize: 15, fontWeight: 700, color: C.green }}>{comma(Math.round(totalNet))}kg</div></div>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 11, color: C.textDim }}>합계</div><div style={{ fontSize: 15, fontWeight: 700, color: C.blue }}>₩{comma(totalAmt)}</div></div>
        </div>
      )}
      {sorted.length === 0 ? <Empty text="계근 내역 없음" /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sorted.map(s => (
            <div key={s.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "12px 14px" }} onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: C.textDim }}>{fmt(s.date)}{s.vehicleNo ? ` · ${s.vehicleNo}` : ""}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.green }}>₩{comma(s.amount)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.textBright }}>{s.partnerName}</span>
                  <span style={{ fontSize: 12, color: C.textDim }}>{s.item} {comma(s.netWeight)}kg</span>
                </div>
              </div>
              {expanded === s.id && (
                <div style={{ borderTop: `1px solid ${C.border}`, padding: "10px 14px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 8px", marginBottom: 10 }}>
                    {[["총중량", comma(s.grossWeight) + "kg"], ["공제", comma(s.deduction) + "kg"], ["순중량", comma(s.netWeight) + "kg"], ["단가", comma(s.unitPrice) + "원/kg"]].map(([k, v]) => (
                      <div key={k} style={{ fontSize: 12, display: "flex", gap: 6 }}><span style={{ color: C.textDim, minWidth: 36 }}>{k}</span><span style={{ color: C.textMid }}>{v}</span></div>
                    ))}
                    {s.memo && <div style={{ fontSize: 12, gridColumn: "span 2", color: C.textDim }}>메모: {s.memo}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button style={{ ...B.sm, background: "#eff6ff" }} onClick={() => printScale(s)}>출력</button>
                    <button style={B.sm} onClick={() => open(s)}>수정</button>
                    <button style={{ ...B.sm, ...B.danger }} onClick={() => del(s.id)}>삭제</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {form && (
        <Modal title={editing ? "계근 수정" : "계근 입력"} onClose={close} onSubmit={submit} saving={saving}>
          <MF label="계근일자 *" type="date" value={form.date} onChange={v => setF({ date: v })} />
          <MF label="우리 사업자" type="select" value={form.myCompanyId} onChange={v => setF({ myCompanyId: v })} options={[{ v: "", l: "선택" }, ...mc.map(c => ({ v: c.id, l: c.name }))]} />
          <MF label="거래처 *" type="select" value={form.partnerId} onChange={v => setF({ partnerId: v })} options={[{ v: "", l: "선택" }, ...pt.map(p => ({ v: p.id, l: p.name }))]} />
          <MF label="품목" type="select" value={form.item} onChange={v => setF({ item: v })} options={ITEMS.map(i => ({ v: i, l: i }))} />
          <MF label="차량번호" value={form.vehicleNo} onChange={v => setF({ vehicleNo: v })} placeholder="12가3456" />
          <Row><MF label="총중량(kg)" type="number" value={form.grossWeight} onChange={v => setF({ grossWeight: v })} /><MF label="공제(kg)" type="number" value={form.deduction} onChange={v => setF({ deduction: v })} /></Row>
          <Row><MF label="순중량(kg)" value={comma(form.netWeight)} readOnly /><MF label="단가(원/kg)" type="number" value={form.unitPrice} onChange={v => setF({ unitPrice: v })} /></Row>
          <div style={{ background: C.bg, borderRadius: 8, padding: 12, marginBottom: 8, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4 }}>계산 금액</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.green }}>₩ {comma(form.amount)}</div>
          </div>
          <MF label="메모" value={form.memo} onChange={v => setF({ memo: v })} />
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  STATEMENT
// ═══════════════════════════════════════════════════════════════════════════════
function StatementTab({ stmts, mc, pt, scales, toast, reload }) {
  const emptyItem = { id: genId(), item: "", qty: "", unit: "kg", unitPrice: "", amount: 0 };
  const emptyForm = { id: "", date: today(), type: "매출", myCompanyId: "", partnerId: "", partnerName: "", items: [{ ...emptyItem }], memo: "", supplyAmount: 0, tax: 0, totalAmount: 0 };
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(false);
  const [filterType, setFilterType] = useState("전체");
  const [filterMonth, setFilterMonth] = useState(today().slice(0, 7));
  const [expanded, setExpanded] = useState(null);
  const [saving, setSaving] = useState(false);

  const filtered = stmts.filter(s => (filterType === "전체" || s.type === filterType) && (!filterMonth || s.date?.startsWith(filterMonth)));
  const sorted = [...filtered].sort((a, b) => b.date?.localeCompare(a.date));
  const totalSales = filtered.filter(s => s.type === "매출").reduce((a, s) => a + Number(s.totalAmount || 0), 0);
  const totalPurchase = filtered.filter(s => s.type === "매입").reduce((a, s) => a + Number(s.totalAmount || 0), 0);

  const calcTotals = (items) => { const sup = items.reduce((a, i) => a + Number(i.amount || 0), 0); return { supplyAmount: sup, tax: Math.round(sup * 0.1), totalAmount: sup + Math.round(sup * 0.1) }; };
  const setF = (patch) => setForm(prev => { const next = { ...prev, ...patch }; return patch.items ? { ...next, ...calcTotals(patch.items) } : next; });
  const updateItem = (idx, patch) => {
    const items = form.items.map((it, i) => { if (i !== idx) return it; const n = { ...it, ...patch }; return { ...n, amount: Math.round(Number(n.qty || 0) * Number(n.unitPrice || 0)) }; });
    setF({ items });
  };
  const open = (stmt = null) => { setForm(stmt ? { ...stmt, items: [...stmt.items] } : { ...emptyForm, id: genId() }); setEditing(!!stmt); };
  const close = () => setForm(null);

  const submit = async () => {
    if (!form.partnerId) { toast("거래처 필수", "err"); return; }
    setSaving(true);
    try {
      const partner = pt.find(p => p.id === form.partnerId);
      const f = { ...form, partnerName: partner?.name || form.partnerName };
      if (editing) await dbUpdate("statements", f.id, toRow(f));
      else await dbInsert("statements", toRow(f));
      await reload(); toast("저장됨"); close();
    } catch { toast("저장 실패", "err"); }
    finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!confirm("삭제?")) return;
    try { await dbDelete("statements", id); await reload(); toast("삭제됨"); }
    catch { toast("삭제 실패", "err"); }
  };

  const printStmt = (s, persp) => {
    const m = mc.find(c => c.id === s.myCompanyId) || {};
    const p = pt.find(x => x.id === s.partnerId) || {};
    const sup = persp === "우리" ? (s.type === "매출" ? m : p) : (s.type === "매출" ? p : m);
    const rec = persp === "우리" ? (s.type === "매출" ? p : m) : (s.type === "매출" ? m : p);
    printHtml(`<div class="title">거 래 명 세 서</div><div class="info-grid"><div class="info-box"><b>[공급자]</b><br/>${sup.name || ""}<br/>사업자: ${sup.bizNo || ""}<br/>대표: ${sup.ceo || ""}</div><div class="info-box"><b>[공급받는자]</b><br/>${rec.name || ""}<br/>사업자: ${rec.bizNo || ""}<br/>대표: ${rec.ceo || ""}</div></div><p>작성일: ${fmt(s.date)} &nbsp; 구분: ${s.type}</p><table><thead><tr><th>품목</th><th>수량</th><th>단위</th><th>단가</th><th>공급가액</th></tr></thead><tbody>${s.items.map(i => `<tr><td>${i.item}</td><td>${comma(i.qty)}</td><td>${i.unit}</td><td>${comma(i.unitPrice)}</td><td>${comma(i.amount)}</td></tr>`).join("")}<tr class="total-row"><td colspan="4" style="text-align:right">공급가액</td><td>${comma(s.supplyAmount)}</td></tr><tr class="total-row"><td colspan="4" style="text-align:right">부가세(10%)</td><td>${comma(s.tax)}</td></tr><tr class="total-row"><td colspan="4" style="text-align:right"><b>합계</b></td><td><b>₩${comma(s.totalAmount)}</b></td></tr></tbody></table>${s.memo ? `<p>메모: ${s.memo}</p>` : ""}`);
  };

  return (
    <div style={P.page}>
      <div style={P.header}>
        <div style={P.title}>거래명세서</div>
        <button style={B.primary} onClick={() => open()}>+ 작성</button>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        <input type="month" style={{ ...inp, flex: 1 }} value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
        <div style={{ display: "flex", gap: 4 }}>
          {["전체", "매출", "매입"].map(t => (
            <button key={t} onClick={() => setFilterType(t)} style={{ ...B.sm, ...(filterType === t ? { background: C.green, color: C.bg, border: `1px solid ${C.green}` } : {}) }}>{t}</button>
          ))}
        </div>
      </div>
      {filtered.length > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", marginBottom: 12, display: "flex", justifyContent: "space-around" }}>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 11, color: C.textDim }}>매출</div><div style={{ fontSize: 14, fontWeight: 700, color: C.green }}>₩{comma(totalSales)}</div></div>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 11, color: C.textDim }}>매입</div><div style={{ fontSize: 14, fontWeight: 700, color: "#7c3aed" }}>₩{comma(totalPurchase)}</div></div>
        </div>
      )}
      {sorted.length === 0 ? <Empty text="명세서 없음" /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sorted.map(s => (
            <div key={s.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "12px 14px" }} onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: C.textDim }}>{fmt(s.date)}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.green }}>₩{comma(s.totalAmount)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.textBright }}>{s.partnerName}</span>
                  <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 4, background: s.type === "매출" ? "#dcfce7" : "#ede9fe", color: s.type === "매출" ? "#16a34a" : "#7c3aed" }}>{s.type}</span>
                </div>
              </div>
              {expanded === s.id && (
                <div style={{ borderTop: `1px solid ${C.border}`, padding: "10px 14px" }}>
                  <div style={{ marginBottom: 8 }}>
                    {s.items?.map((it, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0", borderBottom: `1px solid ${C.border}` }}>
                        <span style={{ color: C.textMid }}>{it.item} {comma(it.qty)}{it.unit}</span>
                        <span style={{ color: C.textBright }}>₩{comma(it.amount)}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "4px 0", color: C.textDim }}><span>공급가액</span><span>₩{comma(s.supplyAmount)}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "4px 0", color: C.textDim }}><span>부가세(10%)</span><span>₩{comma(s.tax)}</span></div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button style={{ ...B.sm, background: "#eff6ff" }} onClick={() => printStmt(s, "우리")}>우리출력</button>
                    <button style={{ ...B.sm, background: "#f0fdf4" }} onClick={() => printStmt(s, "상대")}>상대출력</button>
                    <button style={B.sm} onClick={() => open(s)}>수정</button>
                    <button style={{ ...B.sm, ...B.danger }} onClick={() => del(s.id)}>삭제</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {form && (
        <Modal title={editing ? "명세서 수정" : "명세서 작성"} onClose={close} onSubmit={submit} saving={saving}>
          <Row><MF label="작성일 *" type="date" value={form.date} onChange={v => setF({ date: v })} /><MF label="구분" type="select" value={form.type} onChange={v => setF({ type: v })} options={[{ v: "매출", l: "매출" }, { v: "매입", l: "매입" }]} /></Row>
          <MF label="우리 사업자" type="select" value={form.myCompanyId} onChange={v => setF({ myCompanyId: v })} options={[{ v: "", l: "선택" }, ...mc.map(c => ({ v: c.id, l: c.name }))]} />
          <MF label="거래처 *" type="select" value={form.partnerId} onChange={v => setF({ partnerId: v })} options={[{ v: "", l: "선택" }, ...pt.map(p => ({ v: p.id, l: p.name }))]} />
          {scales.length > 0 && (
            <MF label="계근표에서 불러오기" type="select" value="" onChange={v => {
              const s = scales.find(x => x.id === v); if (!s) return;
              setF({ items: [{ id: genId(), item: s.item, qty: String(s.netWeight), unit: "kg", unitPrice: String(s.unitPrice), amount: Number(s.amount || 0) }], date: s.date, partnerId: s.partnerId, myCompanyId: s.myCompanyId });
            }} options={[{ v: "", l: "-- 선택 --" }, ...[...scales].sort((a, b) => b.date?.localeCompare(a.date)).slice(0, 20).map(s => ({ v: s.id, l: `${fmt(s.date)} | ${s.partnerName} | ${s.item} ${comma(s.netWeight)}kg` }))]} />
          )}
          <div style={{ fontSize: 12, color: C.textDim, marginBottom: 6, fontWeight: 600 }}>품목</div>
          {form.items.map((it, idx) => (
            <div key={it.id} style={{ background: C.bg, borderRadius: 8, padding: 10, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: C.textDim }}>품목 {idx + 1}</span>
                {form.items.length > 1 && <button style={{ ...B.sm, ...B.danger, fontSize: 11, padding: "2px 8px" }} onClick={() => setF({ items: form.items.filter((_, i) => i !== idx) })}>삭제</button>}
              </div>
              <MF label="품명" value={it.item} onChange={v => updateItem(idx, { item: v })} placeholder="구리, 전선..." />
              <Row><MF label="수량" type="number" value={it.qty} onChange={v => updateItem(idx, { qty: v })} /><MF label="단위" type="select" value={it.unit} onChange={v => updateItem(idx, { unit: v })} options={["kg", "톤", "개", "묶음", "기타"].map(u => ({ v: u, l: u }))} /></Row>
              <Row><MF label="단가(원)" type="number" value={it.unitPrice} onChange={v => updateItem(idx, { unitPrice: v })} /><MF label="금액" value={"₩" + comma(it.amount)} readOnly /></Row>
            </div>
          ))}
          <button style={{ ...B.secondary, width: "100%", marginBottom: 10 }} onClick={() => setF({ items: [...form.items, { ...emptyItem, id: genId() }] })}>+ 품목 추가</button>
          <div style={{ background: C.bg, borderRadius: 8, padding: 12, marginBottom: 8 }}>
            {[["공급가액", form.supplyAmount], ["부가세(10%)", form.tax], ["합계금액", form.totalAmount]].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                <span style={{ fontSize: 12, color: C.textDim }}>{l}</span>
                <span style={{ fontSize: l === "합계금액" ? 15 : 13, fontWeight: l === "합계금액" ? 700 : 400, color: l === "합계금액" ? C.green : C.textMid }}>₩{comma(v)}</span>
              </div>
            ))}
          </div>
          <MF label="메모" value={form.memo} onChange={v => setF({ memo: v })} />
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SHARED
// ═══════════════════════════════════════════════════════════════════════════════
function Modal({ title, onClose, onSubmit, children, saving }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", flexDirection: "column", justifyContent: "flex-end", zIndex: 100 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: C.surface, borderRadius: "16px 16px 0 0", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 16px 12px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.textBright }}>{title}</div>
          <button style={{ background: "none", border: "none", color: C.textDim, fontSize: 20, cursor: "pointer", padding: "0 4px" }} onClick={onClose}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", WebkitOverflowScrolling: "touch" }}>{children}</div>
        <div style={{ display: "flex", gap: 8, padding: "12px 16px", borderTop: `1px solid ${C.border}`, paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}>
          <button style={{ ...B.secondary, flex: 1 }} onClick={onClose}>취소</button>
          <button style={{ ...B.primary, flex: 2, opacity: saving ? 0.6 : 1 }} onClick={onSubmit} disabled={saving}>{saving ? "저장중..." : "저장"}</button>
        </div>
      </div>
    </div>
  );
}

// 파일 버튼 — label + input 항상 같이 렌더링, input visible
function FileBtn({ label, onChange, disabled }) {
  return (
    <label style={{ ...B.secondary, cursor: "pointer", display: "inline-block" }}>
      {label}
      <input type="file" accept="image/*" onChange={onChange} disabled={disabled}
        style={{ display: "block", width: 0, height: 0, opacity: 0 }} />
    </label>
  );
}

function MF({ label, value, onChange, type = "text", placeholder, readOnly, options }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: "block", fontSize: 11, color: C.textDim, marginBottom: 4, fontWeight: 600 }}>{label}</label>
      {type === "select"
        ? <select style={inp} value={value || ""} onChange={onChange ? e => onChange(e.target.value) : undefined}>
          {options?.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
        : <input style={{ ...inp, ...(readOnly ? { color: C.textDim, background: C.bg } : {}) }}
          type={type} value={value || ""} placeholder={placeholder} readOnly={readOnly}
          onChange={onChange ? e => onChange(e.target.value) : undefined} />
      }
    </div>
  );
}

function Row({ children }) { return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{children}</div>; }
function Empty({ text }) { return <div style={{ textAlign: "center", padding: "48px 20px", color: C.textDim, fontSize: 13 }}>{text}</div>; }

const C = { bg: "#f5f6f8", surface: "#ffffff", border: "#e2e5ea", green: "#16a34a", blue: "#2563eb", text: "#1f2937", textBright: "#111827", textMid: "#374151", textDim: "#9ca3af" };
const inp = { background: "#ffffff", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", color: C.text, fontSize: 14, width: "100%", boxSizing: "border-box", outline: "none" };
const P = { page: { padding: "16px 14px 80px" }, header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }, title: { fontSize: 18, fontWeight: 700, color: "#111827" } };
const B = { primary: { background: C.green, color: "#ffffff", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }, secondary: { background: "#ffffff", color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }, sm: { background: "#ffffff", color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer" }, danger: { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" } };
