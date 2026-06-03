import React from "react";
import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";

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

const fmt = (d) => d ? new Date(d).toLocaleDateString("ko-KR") : "";
const today = () => new Date().toISOString().split("T")[0];
const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2,9)}-${Math.random().toString(36).slice(2,9)}`;
const comma = (n) => Number(n || 0).toLocaleString("ko-KR");
const toRow = (obj) => { const r = {}; Object.entries(obj).forEach(([k, v]) => { r[k.replace(/([A-Z])/g, "_$1").toLowerCase()] = v; }); return r; };
const toCamel = (obj) => { const r = {}; Object.entries(obj).forEach(([k, v]) => { r[k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = v; }); return r; };

// 계근표 출력 - 계량증명서 스타일
const printScale = (s, supplier, receiver) => {
  const w = window.open("", "_blank");
  w.document.write(`<html><head><style>
    *{font-family:'맑은 고딕',sans-serif;font-size:13px;margin:0;padding:0;}
    body{padding:30px;}
    h2{text-align:center;font-size:22px;letter-spacing:6px;margin-bottom:24px;}
    table{width:100%;border-collapse:collapse;}
    td{border:1px solid #333;padding:8px 12px;}
    .label{background:#f5f5f5;font-weight:600;width:120px;text-align:center;}
    .value{text-align:center;}
  </style></head><body>
  <h2>계 량 증 명 서</h2>
  <table>
    <tr><td class="label">일 자</td><td class="value">${fmt(s.date)}</td></tr>
    <tr><td class="label">차량번호</td><td class="value">${s.vehicleNo||""}</td></tr>
    <tr><td class="label">거 래 처</td><td class="value">${receiver?.name||s.partnerName||""}</td></tr>
    <tr><td class="label">품 명</td><td class="value">${s.item||""}</td></tr>
    <tr><td class="label">공차중량</td><td class="value">${comma(s.emptyWeight)} kg</td></tr>
    <tr><td class="label">총 중 량</td><td class="value">${comma(s.grossWeight)} kg</td></tr>
    <tr><td class="label">실 중 량</td><td class="value">${comma(s.netWeight)} kg</td></tr>
    <tr><td class="label">감 량</td><td class="value">${comma(s.deduction)} kg</td></tr>
    <tr><td class="label">계산중량</td><td class="value"><b>${comma(s.calcWeight)} kg</b></td></tr>
    <tr><td class="label">단 가</td><td class="value">${comma(s.unitPrice)} 원/kg</td></tr>
    <tr><td class="label">금 액</td><td class="value"><b>₩ ${comma(s.amount)}</b></td></tr>
    ${s.memo?`<tr><td class="label">비 고</td><td class="value">${s.memo}</td></tr>`:""}
    <tr>
      <td class="label">등록번호</td>
      <td class="value">${receiver?.bizNo||""}</td>
    </tr>
    <tr>
      <td class="label">상호(법인명)</td>
      <td colspan="1"><table style="width:100%;border:none;"><tr>
        <td style="border:none;width:50%;text-align:center;">${receiver?.name||s.partnerName||""}</td>
        <td style="border:none;border-left:1px solid #ccc;width:50%;text-align:center;">성명 ${receiver?.ceo||""}</td>
      </tr></table></td>
    </tr>
    <tr><td class="label">사업장주소</td><td class="value">${receiver?.address||""}</td></tr>
  </table>
  </body></html>`);
  w.document.close(); w.print();
};

// 거래명세서 출력
const printStmt = (s, sup, rec) => {
  const w = window.open("", "_blank");
  w.document.write(`<html><head><style>*{font-family:sans-serif;font-size:12px;}body{padding:20px;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #333;padding:6px 8px;}th{background:#f0f0f0;}.title{font-size:20px;font-weight:700;text-align:center;margin-bottom:16px;}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;}.info-box{border:1px solid #ccc;padding:8px;}.total-row{font-weight:700;background:#f8f8f8;}</style></head><body>
    <div class="title">거 래 명 세 서</div>
    <div class="info-grid">
      <div class="info-box"><b>[공급자]</b><br/>${sup?.name||""}<br/>사업자: ${sup?.bizNo||""}<br/>대표: ${sup?.ceo||""}<br/>${sup?.address||""}</div>
      <div class="info-box"><b>[공급받는자]</b><br/>${rec?.name||""}<br/>사업자: ${rec?.bizNo||""}<br/>대표: ${rec?.ceo||""}<br/>${rec?.address||""}</div>
    </div>
    <p>작성일: ${fmt(s.date)} &nbsp; 구분: ${s.type}</p>
    <table><thead><tr><th>품목</th><th>수량(kg)</th><th>단가</th><th>공급가액</th></tr></thead>
    <tbody>
      ${(s.items||[]).map(i=>`<tr><td>${i.item}</td><td>${comma(i.qty)}</td><td>${comma(i.unitPrice)}</td><td>${comma(i.amount)}</td></tr>`).join("")}
      <tr class="total-row"><td colspan="3" style="text-align:right">공급가액</td><td>${comma(s.supplyAmount)}</td></tr>
      <tr class="total-row"><td colspan="3" style="text-align:right">부가세(10%)</td><td>${comma(s.tax)}</td></tr>
      <tr class="total-row"><td colspan="3" style="text-align:right"><b>합계</b></td><td><b>₩${comma(s.totalAmount)}</b></td></tr>
    </tbody></table>
    ${s.memo?`<p style="margin-top:12px">메모: ${s.memo}</p>`:""}
  </body></html>`);
  w.document.close(); w.print();
};

const parseExcel = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(e.target.result, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const mapped = rows.map(r => ({
        id: genId(), name: String(r["상호명"]||"").trim(), bizNo: String(r["사업자번호"]||"").trim(),
        ceo: String(r["대표자"]||"").trim(), tel: String(r["전화번호"]||"").trim(),
        bizType: String(r["업태"]||"").trim(), bizItem: String(r["종목"]||"").trim(),
        address: String(r["주소"]||"").trim(), bank: String(r["은행"]||"").trim(),
        account: String(r["계좌번호"]||"").trim(), accountHolder: String(r["예금주"]||"").trim(),
        email: String(r["이메일"]||"").trim(), memo: String(r["메모"]||"").trim(),
        fax: "", photo: "", isMyCompany: false,
      })).filter(r => r.name);
      resolve(mapped);
    } catch (err) { reject(err); }
  };
  reader.onerror = reject;
  reader.readAsBinaryString(file);
});

const downloadTemplate = () => {
  const ws = XLSX.utils.aoa_to_sheet([["상호명","사업자번호","대표자","전화번호","업태","종목","주소","은행","계좌번호","예금주","이메일","메모"],["(주)예시","123-45-67890","홍길동","010-1234-5678","제조업","비철금속","서울시 강남구","국민은행","123456-78-901234","홍길동","",""]]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "거래처");
  XLSX.writeFile(wb, "거래처_양식.xlsx");
};

// ─── 품목 검색 컴포넌트 ───────────────────────────────────────────────────────
const DEFAULT_ITEMS = ["구리","전선","황동","알루미늄","철","스테인리스","납","아연","기타"];
const ITEMS_KEY = "erp_custom_items";

function ItemSearch({ value, onChange }) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [customItems, setCustomItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem(ITEMS_KEY) || "[]"); } catch { return []; }
  });
  const ref = useRef();

  const allItems = [...new Set([...DEFAULT_ITEMS, ...customItems])];
  const filtered = allItems.filter(i => i.includes(query));
  const showDirect = query && !allItems.includes(query);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (item) => {
    setQuery(item); onChange(item); setOpen(false);
  };

  const addCustom = () => {
    if (!query) return;
    const updated = [...new Set([...customItems, query])];
    setCustomItems(updated);
    localStorage.setItem(ITEMS_KEY, JSON.stringify(updated));
    onChange(query); setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: "relative", marginBottom: 10 }}>
      <label style={{ display:"block", fontSize:11, color:C.textDim, marginBottom:4, fontWeight:600 }}>품목</label>
      <input style={inp} value={query} placeholder="품목 검색 또는 직접 입력..."
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}/>
      {open && (
        <div style={{ position:"absolute", top:"100%", left:0, right:0, background:"#fff", border:`1px solid ${C.border}`, borderRadius:8, zIndex:200, maxHeight:200, overflowY:"auto", boxShadow:"0 4px 12px rgba(0,0,0,0.1)" }}>
          {filtered.map(i => (
            <div key={i} style={{ padding:"10px 14px", cursor:"pointer", fontSize:14, borderBottom:`1px solid ${C.border}` }}
              onMouseDown={() => select(i)}>{i}</div>
          ))}
          {showDirect && (
            <div style={{ padding:"10px 14px", cursor:"pointer", fontSize:14, color:C.green, fontWeight:600 }}
              onMouseDown={addCustom}>+ "{query}" 직접 추가 (다음부터 자동저장)</div>
          )}
          {filtered.length === 0 && !showDirect && (
            <div style={{ padding:"10px 14px", color:C.textDim, fontSize:13 }}>검색 결과 없음</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 거래처 검색 컴포넌트 ─────────────────────────────────────────────────────
function PartnerSearch({ value, onChange, partners, label = "거래처 *" }) {
  const [query, setQuery] = useState(() => partners.find(p => p.id === value)?.name || "");
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const p = partners.find(p => p.id === value);
    if (p) setQuery(p.name);
  }, [value, partners]);

  const filtered = partners.filter(p => p.name?.includes(query) || p.bizNo?.includes(query));

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position:"relative", marginBottom:10 }}>
      <label style={{ display:"block", fontSize:11, color:C.textDim, marginBottom:4, fontWeight:600 }}>{label}</label>
      <input style={inp} value={query} placeholder="상호명 또는 사업자번호 검색..."
        onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange(""); }}
        onFocus={() => setOpen(true)}/>
      {open && filtered.length > 0 && (
        <div style={{ position:"absolute", top:"100%", left:0, right:0, background:"#fff", border:`1px solid ${C.border}`, borderRadius:8, zIndex:200, maxHeight:200, overflowY:"auto", boxShadow:"0 4px 12px rgba(0,0,0,0.1)" }}>
          {filtered.map(p => (
            <div key={p.id} style={{ padding:"10px 14px", cursor:"pointer", borderBottom:`1px solid ${C.border}` }}
              onMouseDown={() => { setQuery(p.name); onChange(p.id); setOpen(false); }}>
              <div style={{ fontSize:14, fontWeight:600, color:C.textBright }}>{p.name}</div>
              <div style={{ fontSize:11, color:C.textDim }}>{p.bizNo}{p.ceo?` · ${p.ceo}`:""}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [partners, setPartners] = useState([]);
  const [scales, setScales] = useState([]);
  const [statements, setStatements] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState(null);

  const loadAll = async () => {
    try {
      const [pt, sc, st] = await Promise.all([dbGet("partners"), dbGet("scales"), dbGet("statements")]);
      setPartners(pt.map(toCamel)); setScales(sc.map(toCamel)); setStatements(st.map(toCamel));
    } catch (e) { showToast("DB 오류: " + e.message, "err"); }
    setLoaded(true);
  };

  useEffect(() => { loadAll(); }, []);
  const showToast = (msg, type = "ok") => { setToast({ msg, type }); setTimeout(() => setToast(null), 2800); };

  if (!loaded) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", background:C.bg }}>
      <div style={{ width:36, height:36, border:`3px solid ${C.border}`, borderTop:`3px solid ${C.green}`, borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
      <p style={{ color:C.green, marginTop:12, fontSize:14 }}>연결 중...</p>
    </div>
  );

  const tabs = [{ id:"dashboard", label:"홈" }, { id:"partners", label:"거래처" }, { id:"scale", label:"계근표" }, { id:"statement", label:"명세서" }];

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", background:C.bg, fontFamily:"sans-serif", color:C.text }}>
      <header style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"0 16px", height:52, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div style={{ fontWeight:700, fontSize:16, color:C.textBright }}>RecycleERP</div>
        <div style={{ fontSize:11, color:C.textDim }}>거래처 {partners.length} · 계근 {scales.length}</div>
      </header>
      <main style={{ flex:1, overflowY:"auto", WebkitOverflowScrolling:"touch" }}>
        {tab==="dashboard" && <Dashboard pt={partners} sc={scales} st={statements} setTab={setTab}/>}
        {tab==="partners"  && <PartnersTab list={partners} toast={showToast} reload={loadAll}/>}
        {tab==="scale"     && <ScaleTab scales={scales} partners={partners} toast={showToast} reload={loadAll} setTab={setTab} setStatements={setStatements}/>}
        {tab==="statement" && <StatementTab stmts={statements} partners={partners} scales={scales} toast={showToast} reload={loadAll}/>}
      </main>
      <nav style={{ background:C.surface, borderTop:`1px solid ${C.border}`, display:"flex", flexShrink:0, paddingBottom:"env(safe-area-inset-bottom)" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex:1, padding:"10px 4px 8px", border:"none", background:"transparent", color:tab===t.id?C.green:C.textDim, fontWeight:tab===t.id?700:400, fontSize:12, cursor:"pointer", borderTop:tab===t.id?`2px solid ${C.green}`:"2px solid transparent" }}>
            {t.label}
          </button>
        ))}
      </nav>
      {toast && <div style={{ position:"fixed", bottom:72, left:"50%", transform:"translateX(-50%)", background:toast.type==="err"?"#dc2626":"#16a34a", color:"white", padding:"10px 20px", borderRadius:20, fontWeight:600, fontSize:13, zIndex:999, whiteSpace:"nowrap" }}>{toast.msg}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function Dashboard({ pt, sc, st, setTab }) {
  const m = new Date().toISOString().slice(0,7);
  const mSc = sc.filter(s => s.date?.startsWith(m));
  const mSt = st.filter(s => s.date?.startsWith(m));
  const totalW = mSc.reduce((a,s) => a+Number(s.calcWeight||s.netWeight||0), 0);
  const totalSales = mSt.filter(s=>s.type==="매출").reduce((a,s)=>a+Number(s.totalAmount||0),0);
  const totalPurchase = mSt.filter(s=>s.type==="매입").reduce((a,s)=>a+Number(s.totalAmount||0),0);
  const cards = [
    { label:"거래처", value:pt.length+"개", tab:"partners", color:C.blue },
    { label:"이달 계근", value:mSc.length+"건", tab:"scale", color:"#fb923c" },
    { label:"이달 계산중량", value:comma(Math.round(totalW))+"kg", tab:"scale", color:"#db2777" },
    { label:"이달 매출", value:"₩"+comma(totalSales), tab:"statement", color:C.green },
    { label:"이달 매입", value:"₩"+comma(totalPurchase), tab:"statement", color:"#7c3aed" },
  ];
  const recent = [...sc].sort((a,b)=>b.date?.localeCompare(a.date)).slice(0,5);
  return (
    <div style={P.page}>
      <p style={{ fontSize:13, color:C.textDim, marginBottom:14 }}>{new Date().toLocaleDateString("ko-KR",{year:"numeric",month:"long"})} 현황</p>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:24 }}>
        {cards.map(c=>(
          <button key={c.label} onClick={()=>setTab(c.tab)} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 12px", textAlign:"left", cursor:"pointer" }}>
            <div style={{ fontSize:18, fontWeight:700, color:c.color }}>{c.value}</div>
            <div style={{ fontSize:11, color:C.textDim, marginTop:3 }}>{c.label}</div>
          </button>
        ))}
      </div>
      <div style={{ fontSize:13, fontWeight:600, color:C.textMid, marginBottom:10 }}>최근 계근</div>
      {recent.length===0 ? <Empty text="계근 내역 없음"/> : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {recent.map(s=>(
            <div key={s.id} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:"12px 14px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontSize:12, color:C.textDim }}>{fmt(s.date)}</span>
                <span style={{ fontSize:13, fontWeight:700, color:C.green }}>₩{comma(s.amount)}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:14, fontWeight:600, color:C.textBright }}>{s.partnerName}</span>
                <span style={{ fontSize:12, color:C.textDim }}>{s.item} {comma(s.calcWeight||s.netWeight)}kg</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PARTNERS TAB (통합 - 우리사업자/거래처 구분없이)
// ═══════════════════════════════════════════════════════════════════════════════
function PartnersTab({ list, toast, reload }) {
  const empty = { id:"", name:"", bizNo:"", ceo:"", address:"", bizType:"", bizItem:"", tel:"", fax:"", bank:"", account:"", accountHolder:"", email:"", memo:"", photo:"", isMyCompany:false };
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [preview, setPreview] = useState(null);
  const [filterMy, setFilterMy] = useState("전체");

  const shown = list.filter(p => filterMy==="전체" ? true : filterMy==="우리" ? p.isMyCompany : !p.isMyCompany);
  const filtered = shown.filter(p => !search || p.name?.includes(search) || p.bizNo?.includes(search) || p.ceo?.includes(search));

  const open = (item=null) => { setForm(item?{...item}:{...empty,id:genId()}); setEditing(!!item); };
  const close = () => setForm(null);

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try { const url = await uploadImage(file); setForm(f=>({...f,photo:url})); toast("사진 업로드 완료!"); }
    catch (err) { toast("업로드 실패: "+err.message, "err"); }
    finally { setUploading(false); }
  };

  const handleExcel = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = "";
    try { const rows = await parseExcel(file); if (!rows.length) { toast("데이터 없음","err"); return; } setPreview(rows); }
    catch { toast("엑셀 오류","err"); }
  };

  const importAll = async () => {
    if (!preview?.length) return;
    setImporting(true);
    let ok=0, fail=0;
    for (const row of preview) {
      try { await dbInsert("partners", toRow(row)); ok++; } catch { fail++; }
    }
    await reload(); setPreview(null);
    toast(`${ok}개 등록${fail>0?` (실패 ${fail}개)`:""}`);
    setImporting(false);
  };

  const submit = async () => {
    if (!form.name) { toast("상호명 필수","err"); return; }
    setSaving(true);
    try {
      const row = toRow({...form});
      if (editing) await dbUpdate("partners", form.id, row);
      else await dbInsert("partners", row);
      await reload(); toast(editing?"수정됨":"등록됨"); close();
    } catch (e) { toast("저장 실패: "+e.message,"err"); }
    finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!confirm("삭제?")) return;
    try { await dbDelete("partners", id); await reload(); toast("삭제됨"); }
    catch { toast("삭제 실패","err"); }
  };

  return (
    <div style={P.page}>
      <div style={P.header}>
        <div style={P.title}>거래처 ({shown.length})</div>
        <div style={{ display:"flex", gap:6 }}>
          <button style={B.sm} onClick={downloadTemplate}>양식</button>
          <label style={{ ...B.secondary, cursor:"pointer", fontSize:13, padding:"10px 14px" }}>
            엑셀
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleExcel} style={{ display:"none" }}/>
          </label>
          <button style={B.primary} onClick={()=>open()}>+ 추가</button>
        </div>
      </div>

      {/* 필터 */}
      <div style={{ display:"flex", gap:6, marginBottom:10 }}>
        {["전체","우리","거래처"].map(t=>(
          <button key={t} onClick={()=>setFilterMy(t)} style={{ ...B.sm,...(filterMy===t?{background:C.green,color:"#fff",border:`1px solid ${C.green}`}:{}) }}>{t}</button>
        ))}
      </div>

      {/* 엑셀 미리보기 */}
      {preview && (
        <div style={{ background:"#fffbeb", border:"1px solid #fbbf24", borderRadius:12, padding:14, marginBottom:14 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"#92400e", marginBottom:8 }}>{preview.length}개 거래처 발견. 등록하시겠습니까?</div>
          <div style={{ maxHeight:120, overflowY:"auto", marginBottom:10 }}>
            {preview.map((p,i)=><div key={i} style={{ fontSize:12, padding:"2px 0", color:"#78350f" }}>{p.name} {p.bizNo?`· ${p.bizNo}`:""}</div>)}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button style={{...B.primary,background:"#d97706"}} onClick={importAll} disabled={importing}>{importing?"등록중...":"전체 등록"}</button>
            <button style={B.secondary} onClick={()=>setPreview(null)}>취소</button>
          </div>
        </div>
      )}

      <input style={{ ...inp, marginBottom:12 }} placeholder="상호명 / 사업자번호 / 대표자..." value={search} onChange={e=>setSearch(e.target.value)}/>

      {filtered.length===0 ? <Empty text="거래처 없음"/> : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {filtered.map(p=>(
            <div key={p.id} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden" }}>
              <div style={{ padding:"12px 14px", display:"flex", gap:10, alignItems:"center" }} onClick={()=>setExpanded(expanded===p.id?null:p.id)}>
                {p.photo
                  ? <img src={p.photo} alt="" style={{ width:40, height:40, borderRadius:6, objectFit:"cover", flexShrink:0 }}/>
                  : <div style={{ width:40, height:40, borderRadius:6, background:C.bg, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:C.textDim }}>{p.isMyCompany?"우리":"거래"}</div>
                }
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:C.textBright, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</div>
                    {p.isMyCompany && <span style={{ fontSize:10, background:"#dcfce7", color:C.green, padding:"1px 6px", borderRadius:4, flexShrink:0 }}>우리</span>}
                  </div>
                  <div style={{ fontSize:12, color:C.textDim, marginTop:1 }}>{p.bizNo}{p.ceo?` · ${p.ceo}`:""}</div>
                </div>
                <div style={{ fontSize:12, color:C.textDim }}>{expanded===p.id?"▲":"▼"}</div>
              </div>
              {expanded===p.id && (
                <div style={{ borderTop:`1px solid ${C.border}`, padding:"10px 14px" }}>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"4px 8px", marginBottom:10 }}>
                    {[["전화",p.tel],["팩스",p.fax],["업태",p.bizType],["종목",p.bizItem],["은행",p.bank],["계좌",p.account],["예금주",p.accountHolder],["이메일",p.email]].map(([k,v])=>
                      v ? <div key={k} style={{ fontSize:12, display:"flex", gap:6 }}><span style={{ color:C.textDim, minWidth:32 }}>{k}</span><span style={{ color:C.textMid }}>{v}</span></div> : null
                    )}
                    {p.address && <div style={{ fontSize:12, display:"flex", gap:6, gridColumn:"span 2" }}><span style={{ color:C.textDim, minWidth:32 }}>주소</span><span style={{ color:C.textMid }}>{p.address}</span></div>}
                    {p.memo && <div style={{ fontSize:12, display:"flex", gap:6, gridColumn:"span 2" }}><span style={{ color:C.textDim, minWidth:32 }}>메모</span><span style={{ color:C.textMid }}>{p.memo}</span></div>}
                  </div>
                  <div style={{ display:"flex", gap:6 }}>
                    <button style={B.sm} onClick={()=>open(p)}>수정</button>
                    <button style={{...B.sm,...B.danger}} onClick={()=>del(p.id)}>삭제</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {form && (
        <Modal title={editing?"거래처 수정":"거래처 등록"} onClose={close} onSubmit={submit} saving={saving}>
          {/* 우리회사 여부 */}
          <div style={{ display:"flex", gap:8, marginBottom:14 }}>
            {[["거래처",false],["우리 사업자",true]].map(([l,v])=>(
              <button key={l} onClick={()=>setForm(f=>({...f,isMyCompany:v}))}
                style={{ ...B.sm, flex:1, ...(form.isMyCompany===v?{background:C.green,color:"#fff",border:`1px solid ${C.green}`}:{}) }}>{l}</button>
            ))}
          </div>
          {/* 사진 */}
          <div style={{ marginBottom:14, padding:12, background:C.bg, borderRadius:10, border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:11, color:C.textDim, marginBottom:8 }}>로고 / 도장</div>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              {form.photo ? <img src={form.photo} alt="" style={{ width:52, height:52, borderRadius:8, objectFit:"cover" }}/> : <div style={{ width:52, height:52, borderRadius:8, background:C.surface, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:C.textDim }}>사진없음</div>}
              <label style={{ ...B.sm, cursor:"pointer" }}>
                {uploading?"업로드중...":"사진 선택"}
                <input type="file" accept="image/*" onChange={handlePhoto} disabled={uploading} style={{ display:"block", width:"100%", marginTop:4, fontSize:12, cursor:"pointer" }}/>
              </label>
              {form.photo && <button style={{...B.sm,...B.danger}} onClick={()=>setForm(f=>({...f,photo:""}))}>삭제</button>}
            </div>
          </div>
          <MF label="상호명 *" value={form.name} onChange={v=>setForm({...form,name:v})}/>
          <MF label="사업자번호" value={form.bizNo} onChange={v=>setForm({...form,bizNo:v})} placeholder="000-00-00000"/>
          <Row><MF label="대표자" value={form.ceo} onChange={v=>setForm({...form,ceo:v})}/><MF label="전화번호" value={form.tel} onChange={v=>setForm({...form,tel:v})}/></Row>
          <Row><MF label="업태" value={form.bizType} onChange={v=>setForm({...form,bizType:v})}/><MF label="종목" value={form.bizItem} onChange={v=>setForm({...form,bizItem:v})}/></Row>
          <Row><MF label="은행명" value={form.bank} onChange={v=>setForm({...form,bank:v})}/><MF label="예금주" value={form.accountHolder} onChange={v=>setForm({...form,accountHolder:v})}/></Row>
          <MF label="계좌번호" value={form.account} onChange={v=>setForm({...form,account:v})}/>
          <MF label="이메일" value={form.email} onChange={v=>setForm({...form,email:v})}/>
          <MF label="팩스" value={form.fax} onChange={v=>setForm({...form,fax:v})}/>
          <MF label="주소" value={form.address} onChange={v=>setForm({...form,address:v})}/>
          <MF label="메모" value={form.memo} onChange={v=>setForm({...form,memo:v})}/>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SCALE TAB
// ═══════════════════════════════════════════════════════════════════════════════
function ScaleTab({ scales, partners, toast, reload, setTab }) {
  const empty = { id:"", date:today(), supplierId:"", partnerId:"", partnerName:"", vehicleNo:"", item:"", grossWeight:"", emptyWeight:"", netWeight:"", deduction:"", calcWeight:"", unitPrice:"", amount:"", memo:"" };
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(false);
  const [filterMonth, setFilterMonth] = useState(today().slice(0,7));
  const [filterPartner, setFilterPartner] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [saving, setSaving] = useState(false);

  const filtered = scales.filter(s =>
    (!filterMonth || s.date?.startsWith(filterMonth)) &&
    (!filterPartner || s.partnerName?.includes(filterPartner))
  );
  const sorted = [...filtered].sort((a,b)=>b.date?.localeCompare(a.date));
  const totalCalc = filtered.reduce((a,s)=>a+Number(s.calcWeight||s.netWeight||0),0);
  const totalAmt = filtered.reduce((a,s)=>a+Number(s.amount||0),0);

  const calc = (f) => {
    const net = Math.max(0, Number(f.grossWeight||0) - Number(f.emptyWeight||0));
    const calcW = Math.max(0, net - Number(f.deduction||0));
    return { ...f, netWeight: net, calcWeight: calcW, amount: Math.round(calcW * Number(f.unitPrice||0)) };
  };
  const setF = (patch) => setForm(prev => calc({...prev,...patch}));
  const open = (item=null) => { setForm(item ? calc({...item}) : calc({...empty, id:genId()})); setEditing(!!item); };
  const close = () => setForm(null);

  const submit = async () => {
    if (!form.date || !form.partnerId) { toast("날짜·거래처 필수","err"); return; }
    setSaving(true);
    try {
      const partner = partners.find(p=>p.id===form.partnerId);
      const f = {...form, partnerName: partner?.name||form.partnerName};
      const row = toRow(f);
      if (editing) await dbUpdate("scales", f.id, row);
      else await dbInsert("scales", row);
      await reload(); toast(editing?"수정됨":"저장됨"); close();
    } catch (e) { toast("저장 실패: "+e.message,"err"); }
    finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!confirm("삭제?")) return;
    try { await dbDelete("scales",id); await reload(); toast("삭제됨"); }
    catch { toast("삭제 실패","err"); }
  };

  // 명세서로 연동
  const toStatement = (s) => {
    const partner = partners.find(p=>p.id===s.partnerId);
    const supplier = partners.find(p=>p.id===s.supplierId);
    const item = { id:genId(), item:s.item, qty:String(s.calcWeight||s.netWeight), unit:"kg", unitPrice:String(s.unitPrice), amount:Number(s.amount||0) };
    const sup = s.supplyAmount || Number(s.amount||0);
    const tax = Math.round(sup*0.1);
    const stmt = {
      id: genId(), date: s.date, type:"매출",
      myCompanyId: s.supplierId, partnerId: s.partnerId,
      partnerName: partner?.name||s.partnerName,
      items: [item], supplyAmount: sup, tax, totalAmount: sup+tax,
      memo: `계근표 연동 (${fmt(s.date)} ${s.vehicleNo||""})`, scaleId: s.id,
    };
    return stmt;
  };

  const createStatement = async (s) => {
    try {
      const stmt = toStatement(s);
      await dbInsert("statements", toRow(stmt));
      await reload();
      toast("명세서 생성됨!");
    } catch (e) { toast("명세서 생성 실패","err"); }
  };

  const doPrintScale = (s) => {
    const supplier = partners.find(p=>p.id===s.supplierId)||{};
    const receiver = partners.find(p=>p.id===s.partnerId)||{};
    printScale(s, supplier, receiver);
  };

  return (
    <div style={P.page}>
      <div style={P.header}><div style={P.title}>계근표</div><button style={B.primary} onClick={()=>open()}>+ 입력</button></div>
      <div style={{ display:"flex", gap:8, marginBottom:12 }}>
        <input type="month" style={{ ...inp, flex:1 }} value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}/>
        <input style={{ ...inp, flex:1 }} placeholder="거래처 검색..." value={filterPartner} onChange={e=>setFilterPartner(e.target.value)}/>
      </div>
      {filtered.length>0 && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 14px", marginBottom:12, display:"flex", justifyContent:"space-around" }}>
          <div style={{ textAlign:"center" }}><div style={{ fontSize:11, color:C.textDim }}>건수</div><div style={{ fontSize:15, fontWeight:700, color:C.textBright }}>{filtered.length}건</div></div>
          <div style={{ textAlign:"center" }}><div style={{ fontSize:11, color:C.textDim }}>계산중량</div><div style={{ fontSize:15, fontWeight:700, color:C.green }}>{comma(Math.round(totalCalc))}kg</div></div>
          <div style={{ textAlign:"center" }}><div style={{ fontSize:11, color:C.textDim }}>합계</div><div style={{ fontSize:15, fontWeight:700, color:C.blue }}>₩{comma(totalAmt)}</div></div>
        </div>
      )}
      {sorted.length===0 ? <Empty text="계근 내역 없음"/> : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {sorted.map(s=>(
            <div key={s.id} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden" }}>
              <div style={{ padding:"12px 14px" }} onClick={()=>setExpanded(expanded===s.id?null:s.id)}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ fontSize:12, color:C.textDim }}>{fmt(s.date)}{s.vehicleNo?` · ${s.vehicleNo}`:""}</span>
                  <span style={{ fontSize:14, fontWeight:700, color:C.green }}>₩{comma(s.amount)}</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <span style={{ fontSize:14, fontWeight:600, color:C.textBright }}>{s.partnerName}</span>
                  <span style={{ fontSize:12, color:C.textDim }}>{s.item} {comma(s.calcWeight||s.netWeight)}kg</span>
                </div>
              </div>
              {expanded===s.id && (
                <div style={{ borderTop:`1px solid ${C.border}`, padding:"10px 14px" }}>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"4px 8px", marginBottom:10 }}>
                    {[["총중량",comma(s.grossWeight)+"kg"],["공차중량",comma(s.emptyWeight)+"kg"],["실중량",comma(s.netWeight)+"kg"],["감량",comma(s.deduction)+"kg"],["계산중량",comma(s.calcWeight)+"kg"],["단가",comma(s.unitPrice)+"원/kg"]].map(([k,v])=>(
                      <div key={k} style={{ fontSize:12, display:"flex", gap:6 }}><span style={{ color:C.textDim, minWidth:48 }}>{k}</span><span style={{ color:C.textMid }}>{v}</span></div>
                    ))}
                    {s.memo && <div style={{ fontSize:12, gridColumn:"span 2", color:C.textDim }}>메모: {s.memo}</div>}
                  </div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    <button style={{...B.sm,background:"#eff6ff"}} onClick={()=>doPrintScale(s)}>출력</button>
                    <button style={{...B.sm,background:"#f0fdf4"}} onClick={()=>createStatement(s)}>명세서 생성</button>
                    <button style={B.sm} onClick={()=>open(s)}>수정</button>
                    <button style={{...B.sm,...B.danger}} onClick={()=>del(s.id)}>삭제</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {form && (
        <Modal title={editing?"계근 수정":"계근 입력"} onClose={close} onSubmit={submit} saving={saving}>
          <MF label="계근일자 *" type="date" value={form.date} onChange={v=>setF({date:v})}/>
          <PartnerSearch value={form.supplierId} onChange={v=>setF({supplierId:v})} partners={partners} label="공급자 (우리 사업자)"/>
          <PartnerSearch value={form.partnerId} onChange={v=>setF({partnerId:v})} partners={partners} label="거래처 *"/>
          <ItemSearch value={form.item} onChange={v=>setF({item:v})}/>
          <MF label="차량번호" value={form.vehicleNo} onChange={v=>setF({vehicleNo:v})} placeholder="12가3456"/>
          <Row><MF label="총중량(kg)" type="number" value={form.grossWeight} onChange={v=>setF({grossWeight:v})}/><MF label="공차중량(kg)" type="number" value={form.emptyWeight} onChange={v=>setF({emptyWeight:v})}/></Row>
          <Row><MF label="실중량(kg)" value={comma(form.netWeight)} readOnly/><MF label="감량(kg)" type="number" value={form.deduction} onChange={v=>setF({deduction:v})}/></Row>
          <Row><MF label="계산중량(kg)" value={comma(form.calcWeight)} readOnly/><MF label="단가(원/kg)" type="number" value={form.unitPrice} onChange={v=>setF({unitPrice:v})}/></Row>
          <div style={{ background:C.bg, borderRadius:8, padding:12, marginBottom:8, textAlign:"center" }}>
            <div style={{ fontSize:11, color:C.textDim, marginBottom:4 }}>계산 금액</div>
            <div style={{ fontSize:22, fontWeight:700, color:C.green }}>₩ {comma(form.amount)}</div>
          </div>
          <MF label="메모" value={form.memo} onChange={v=>setF({memo:v})}/>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  STATEMENT TAB
// ═══════════════════════════════════════════════════════════════════════════════
function StatementTab({ stmts, partners, scales, toast, reload }) {
  const emptyItem = { id:genId(), item:"", qty:"", unit:"kg", unitPrice:"", amount:0 };
  const emptyForm = { id:"", date:today(), type:"매출", myCompanyId:"", partnerId:"", partnerName:"", items:[{...emptyItem}], memo:"", supplyAmount:0, tax:0, totalAmount:0 };
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(false);
  const [filterType, setFilterType] = useState("전체");
  const [filterMonth, setFilterMonth] = useState(today().slice(0,7));
  const [expanded, setExpanded] = useState(null);
  const [saving, setSaving] = useState(false);

  const filtered = stmts.filter(s=>(filterType==="전체"||s.type===filterType)&&(!filterMonth||s.date?.startsWith(filterMonth)));
  const sorted = [...filtered].sort((a,b)=>b.date?.localeCompare(a.date));
  const totalSales = filtered.filter(s=>s.type==="매출").reduce((a,s)=>a+Number(s.totalAmount||0),0);
  const totalPurchase = filtered.filter(s=>s.type==="매입").reduce((a,s)=>a+Number(s.totalAmount||0),0);

  const calcTotals = (items) => { const sup=items.reduce((a,i)=>a+Number(i.amount||0),0); return {supplyAmount:sup,tax:Math.round(sup*0.1),totalAmount:sup+Math.round(sup*0.1)}; };
  const setF = (patch) => setForm(prev=>{ const next={...prev,...patch}; return patch.items?{...next,...calcTotals(patch.items)}:next; });
  const updateItem = (idx,patch) => {
    const items = form.items.map((it,i)=>{ if(i!==idx) return it; const n={...it,...patch}; return {...n,amount:Math.round(Number(n.qty||0)*Number(n.unitPrice||0))}; });
    setF({items});
  };
  const open = (stmt=null) => { setForm(stmt?{...stmt,items:[...stmt.items]}:{...emptyForm,id:genId()}); setEditing(!!stmt); };
  const close = () => setForm(null);

  const submit = async () => {
    if (!form.partnerId) { toast("거래처 필수","err"); return; }
    setSaving(true);
    try {
      const partner = partners.find(p=>p.id===form.partnerId);
      const f = {...form,partnerName:partner?.name||form.partnerName};
      if (editing) await dbUpdate("statements",f.id,toRow(f));
      else await dbInsert("statements",toRow(f));
      await reload(); toast("저장됨"); close();
    } catch { toast("저장 실패","err"); }
    finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!confirm("삭제?")) return;
    try { await dbDelete("statements",id); await reload(); toast("삭제됨"); }
    catch { toast("삭제 실패","err"); }
  };

  const doPrintStmt = (s, persp) => {
    const mc = partners.find(p=>p.id===s.myCompanyId)||{};
    const pt = partners.find(p=>p.id===s.partnerId)||{};
    const sup = persp==="우리"?(s.type==="매출"?mc:pt):(s.type==="매출"?pt:mc);
    const rec = persp==="우리"?(s.type==="매출"?pt:mc):(s.type==="매출"?mc:pt);
    printStmt(s, sup, rec);
  };

  return (
    <div style={P.page}>
      <div style={P.header}><div style={P.title}>거래명세서</div><button style={B.primary} onClick={()=>open()}>+ 작성</button></div>
      <div style={{ display:"flex", gap:6, marginBottom:10, flexWrap:"wrap" }}>
        <input type="month" style={{ ...inp, flex:1 }} value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}/>
        <div style={{ display:"flex", gap:4 }}>
          {["전체","매출","매입"].map(t=>(
            <button key={t} onClick={()=>setFilterType(t)} style={{ ...B.sm,...(filterType===t?{background:C.green,color:"#fff",border:`1px solid ${C.green}`}:{}) }}>{t}</button>
          ))}
        </div>
      </div>
      {filtered.length>0 && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 14px", marginBottom:12, display:"flex", justifyContent:"space-around" }}>
          <div style={{ textAlign:"center" }}><div style={{ fontSize:11, color:C.textDim }}>매출</div><div style={{ fontSize:14, fontWeight:700, color:C.green }}>₩{comma(totalSales)}</div></div>
          <div style={{ textAlign:"center" }}><div style={{ fontSize:11, color:C.textDim }}>매입</div><div style={{ fontSize:14, fontWeight:700, color:"#7c3aed" }}>₩{comma(totalPurchase)}</div></div>
        </div>
      )}
      {sorted.length===0 ? <Empty text="명세서 없음"/> : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {sorted.map(s=>(
            <div key={s.id} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden" }}>
              <div style={{ padding:"12px 14px" }} onClick={()=>setExpanded(expanded===s.id?null:s.id)}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ fontSize:12, color:C.textDim }}>{fmt(s.date)}</span>
                  <span style={{ fontSize:14, fontWeight:700, color:C.green }}>₩{comma(s.totalAmount)}</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:14, fontWeight:600, color:C.textBright }}>{s.partnerName}</span>
                  <span style={{ fontSize:12, padding:"2px 8px", borderRadius:4, background:s.type==="매출"?"#dcfce7":"#ede9fe", color:s.type==="매출"?"#16a34a":"#7c3aed" }}>{s.type}</span>
                </div>
              </div>
              {expanded===s.id && (
                <div style={{ borderTop:`1px solid ${C.border}`, padding:"10px 14px" }}>
                  <div style={{ marginBottom:8 }}>
                    {s.items?.map((it,i)=>(
                      <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"3px 0", borderBottom:`1px solid ${C.border}` }}>
                        <span style={{ color:C.textMid }}>{it.item} {comma(it.qty)}{it.unit}</span>
                        <span style={{ color:C.textBright }}>₩{comma(it.amount)}</span>
                      </div>
                    ))}
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, padding:"4px 0", color:C.textDim }}><span>공급가액</span><span>₩{comma(s.supplyAmount)}</span></div>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, padding:"4px 0", color:C.textDim }}><span>부가세(10%)</span><span>₩{comma(s.tax)}</span></div>
                  </div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    <button style={{...B.sm,background:"#eff6ff"}} onClick={()=>doPrintStmt(s,"우리")}>우리출력</button>
                    <button style={{...B.sm,background:"#f0fdf4"}} onClick={()=>doPrintStmt(s,"상대")}>상대출력</button>
                    <button style={B.sm} onClick={()=>open(s)}>수정</button>
                    <button style={{...B.sm,...B.danger}} onClick={()=>del(s.id)}>삭제</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {form && (
        <Modal title={editing?"명세서 수정":"명세서 작성"} onClose={close} onSubmit={submit} saving={saving}>
          <Row>
            <MF label="작성일 *" type="date" value={form.date} onChange={v=>setF({date:v})}/>
            <MF label="구분" type="select" value={form.type} onChange={v=>setF({type:v})} options={[{v:"매출",l:"매출"},{v:"매입",l:"매입"}]}/>
          </Row>
          <PartnerSearch value={form.myCompanyId} onChange={v=>setF({myCompanyId:v})} partners={partners} label="공급자"/>
          <PartnerSearch value={form.partnerId} onChange={v=>setF({partnerId:v})} partners={partners} label="거래처 *"/>

          {/* 계근표 연동 */}
          {scales.length>0 && (
            <div style={{ marginBottom:12 }}>
              <label style={{ display:"block", fontSize:11, color:C.textDim, marginBottom:4, fontWeight:600 }}>계근표에서 불러오기</label>
              <select style={inp} onChange={e=>{
                const s=scales.find(x=>x.id===e.target.value); if(!s) return;
                setF({items:[{id:genId(),item:s.item,qty:String(s.calcWeight||s.netWeight),unit:"kg",unitPrice:String(s.unitPrice),amount:Number(s.amount||0)}],date:s.date,partnerId:s.partnerId,myCompanyId:s.supplierId});
              }}>
                <option value="">-- 선택 --</option>
                {[...scales].sort((a,b)=>b.date?.localeCompare(a.date)).slice(0,30).map(s=>(
                  <option key={s.id} value={s.id}>{fmt(s.date)} | {s.partnerName} | {s.item} {comma(s.calcWeight||s.netWeight)}kg</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ fontSize:12, color:C.textDim, marginBottom:6, fontWeight:600 }}>품목</div>
          {form.items.map((it,idx)=>(
            <div key={it.id} style={{ background:C.bg, borderRadius:8, padding:10, marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                <span style={{ fontSize:12, color:C.textDim }}>품목 {idx+1}</span>
                {form.items.length>1 && <button style={{...B.sm,...B.danger,fontSize:11,padding:"2px 8px"}} onClick={()=>setF({items:form.items.filter((_,i)=>i!==idx)})}>삭제</button>}
              </div>
              <MF label="품명" value={it.item} onChange={v=>updateItem(idx,{item:v})} placeholder="구리, 전선..."/>
              <Row><MF label="수량" type="number" value={it.qty} onChange={v=>updateItem(idx,{qty:v})}/><MF label="단위" type="select" value={it.unit} onChange={v=>updateItem(idx,{unit:v})} options={["kg","톤","개","묶음","기타"].map(u=>({v:u,l:u}))}/></Row>
              <Row><MF label="단가(원)" type="number" value={it.unitPrice} onChange={v=>updateItem(idx,{unitPrice:v})}/><MF label="금액" value={"₩"+comma(it.amount)} readOnly/></Row>
            </div>
          ))}
          <button style={{...B.secondary,width:"100%",marginBottom:10}} onClick={()=>setF({items:[...form.items,{...emptyItem,id:genId()}]})}>+ 품목 추가</button>
          <div style={{ background:C.bg, borderRadius:8, padding:12, marginBottom:8 }}>
            {[["공급가액",form.supplyAmount],["부가세(10%)",form.tax],["합계금액",form.totalAmount]].map(([l,v])=>(
              <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"3px 0" }}>
                <span style={{ fontSize:12, color:C.textDim }}>{l}</span>
                <span style={{ fontSize:l==="합계금액"?15:13, fontWeight:l==="합계금액"?700:400, color:l==="합계금액"?C.green:C.textMid }}>₩{comma(v)}</span>
              </div>
            ))}
          </div>
          <MF label="메모" value={form.memo} onChange={v=>setF({memo:v})}/>
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
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", flexDirection:"column", justifyContent:"flex-end", zIndex:100 }}
      onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:C.surface, borderRadius:"16px 16px 0 0", maxHeight:"92vh", display:"flex", flexDirection:"column" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"16px 16px 12px", borderBottom:`1px solid ${C.border}` }}>
          <div style={{ fontSize:15, fontWeight:700, color:C.textBright }}>{title}</div>
          <button style={{ background:"none", border:"none", color:C.textDim, fontSize:20, cursor:"pointer" }} onClick={onClose}>✕</button>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"12px 16px", WebkitOverflowScrolling:"touch" }}>{children}</div>
        <div style={{ display:"flex", gap:8, padding:"12px 16px", borderTop:`1px solid ${C.border}`, paddingBottom:"calc(12px + env(safe-area-inset-bottom))" }}>
          <button style={{...B.secondary,flex:1}} onClick={onClose}>취소</button>
          <button style={{...B.primary,flex:2,opacity:saving?0.6:1}} onClick={onSubmit} disabled={saving}>{saving?"저장중...":"저장"}</button>
        </div>
      </div>
    </div>
  );
}

function MF({ label, value, onChange, type="text", placeholder, readOnly, options }) {
  return (
    <div style={{ marginBottom:10 }}>
      <label style={{ display:"block", fontSize:11, color:C.textDim, marginBottom:4, fontWeight:600 }}>{label}</label>
      {type==="select"
        ? <select style={inp} value={value||""} onChange={onChange?e=>onChange(e.target.value):undefined}>
            {options?.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
        : <input style={{...inp,...(readOnly?{color:C.textDim,background:C.bg}:{})}}
            type={type} value={value||""} placeholder={placeholder} readOnly={readOnly}
            onChange={onChange?e=>onChange(e.target.value):undefined}/>
      }
    </div>
  );
}

function Row({ children }) { return <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>{children}</div>; }
function Empty({ text }) { return <div style={{ textAlign:"center", padding:"48px 20px", color:C.textDim, fontSize:13 }}>{text}</div>; }

const C = { bg:"#f5f6f8", surface:"#ffffff", border:"#e2e5ea", green:"#16a34a", blue:"#2563eb", text:"#1f2937", textBright:"#111827", textMid:"#374151", textDim:"#9ca3af" };
const inp = { background:"#ffffff", border:"1px solid #e2e5ea", borderRadius:8, padding:"10px 12px", color:"#1f2937", fontSize:14, width:"100%", boxSizing:"border-box", outline:"none" };
const P = { page:{ padding:"16px 14px 80px" }, header:{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }, title:{ fontSize:18, fontWeight:700, color:"#111827" } };
const B = { primary:{ background:"#16a34a", color:"#ffffff", border:"none", borderRadius:8, padding:"10px 16px", fontWeight:700, fontSize:13, cursor:"pointer" }, secondary:{ background:"#ffffff", color:"#6b7280", border:"1px solid #e2e5ea", borderRadius:8, padding:"10px 16px", fontWeight:600, fontSize:13, cursor:"pointer" }, sm:{ background:"#ffffff", color:"#6b7280", border:"1px solid #e2e5ea", borderRadius:6, padding:"6px 12px", fontSize:12, cursor:"pointer" }, danger:{ background:"#fef2f2", color:"#dc2626", border:"1px solid #fecaca" } };
