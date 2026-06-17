import { useState, useEffect, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend
} from "recharts";

// ── Persistent Storage ────────────────────────────────────────────────────────
const STORE_KEY = "wetttracker_v1";
function loadData() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}
function saveData(data) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch {}
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) =>
  (n < 0 ? "-" : "") +
  Math.abs(n).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " €";
const fmtShort = (n) =>
  (n < 0 ? "-" : "") + Math.abs(n).toFixed(2).replace(".", ",") + " €";
const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().slice(0, 10);

function addDays(d, n) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function startOf(horizon) {
  const now = new Date();
  if (horizon === "Tag") { const d = new Date(now); d.setHours(0,0,0,0); return d; }
  if (horizon === "Woche") return addDays(now, -7);
  if (horizon === "Monat") return addDays(now, -30);
  if (horizon === "3M") return addDays(now, -90);
  if (horizon === "6M") return addDays(now, -180);
  return addDays(now, -365);
}

const HORIZONS = ["Tag", "Woche", "Monat", "3M", "6M", "Jahr"];

// ── Default State ─────────────────────────────────────────────────────────────
const DEFAULT = {
  anbieter: [],          // {id, name, farbe}
  transaktionen: [],     // {id, anbieterId, art:"ein"|"aus", betrag, datum, notiz}
  wetten: [],            // {id, anbieterId, einsatz, quote, datum, status:"offen"|"gewonnen"|"verloren", steuer}
  steuer: false,
};

// ── Farben ────────────────────────────────────────────────────────────────────
const FARBEN = ["#34d399","#60a5fa","#f472b6","#fb923c","#a78bfa","#facc15","#38bdf8","#f87171"];
const BADGE = { gewonnen:"#34d399", verloren:"#f87171", offen:"#94a3b8" };

// ── Modal ─────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{background:"#1e293b",border:"1px solid #334155",borderRadius:12,padding:24,minWidth:340,maxWidth:480,width:"90%",maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <span style={{fontWeight:700,fontSize:16,color:"#f1f5f9"}}>{title}</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#94a3b8",fontSize:20,cursor:"pointer",lineHeight:1}}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Input Styles ──────────────────────────────────────────────────────────────
const inp = {
  background:"#0f172a",border:"1px solid #334155",borderRadius:6,
  color:"#f1f5f9",padding:"8px 12px",width:"100%",fontSize:14,boxSizing:"border-box",
  outline:"none",fontFamily:"inherit"
};
const btn = (variant="primary") => ({
  padding:"8px 16px", borderRadius:6, border:"none", cursor:"pointer", fontSize:13,
  fontWeight:600, fontFamily:"inherit",
  ...(variant === "primary" ? {background:"#34d399",color:"#0f172a"}
    : variant === "danger" ? {background:"#f87171",color:"#fff"}
    : variant === "ghost" ? {background:"transparent",color:"#94a3b8",border:"1px solid #334155"}
    : {background:"#334155",color:"#f1f5f9"})
});

// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState(() => loadData() || DEFAULT);
  const [tab, setTab] = useState(0);

  useEffect(() => saveData(data), [data]);

  const upd = (patch) => setData(d => ({...d, ...patch}));

  // Guthaben pro Anbieter
  const guthaben = useMemo(() => {
    const g = {};
    data.anbieter.forEach(a => { g[a.id] = 0; });
    data.transaktionen.forEach(t => {
      if (t.art === "ein") g[t.anbieterId] = (g[t.anbieterId]||0) + t.betrag;
      else g[t.anbieterId] = (g[t.anbieterId]||0) - t.betrag;
    });
    // Wetten abziehen (Einsatz) und Gewinne gutschreiben
    data.wetten.forEach(w => {
      if (w.status !== "offen") {
        const steuerFaktor = (data.steuer || w.steuer) ? 0.05 : 0;
        if (w.status === "gewonnen") {
          const bruttoGewinn = w.einsatz * w.quote;
          const nettoGewinn = bruttoGewinn - bruttoGewinn * steuerFaktor;
          g[w.anbieterId] = (g[w.anbieterId]||0) + nettoGewinn - w.einsatz;
        } else {
          g[w.anbieterId] = (g[w.anbieterId]||0) - w.einsatz;
        }
      }
    });
    return g;
  }, [data]);

  return (
    <div style={{minHeight:"100vh",background:"#0f172a",color:"#f1f5f9",fontFamily:"'Inter',system-ui,sans-serif"}}>
      {/* Header */}
      <div style={{background:"#1e293b",borderBottom:"1px solid #334155",padding:"0 24px",display:"flex",alignItems:"center",gap:32,position:"sticky",top:0,zIndex:50}}>
        <div style={{padding:"16px 0",display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:20}}>🎰</span>
          <span style={{fontWeight:800,fontSize:16,letterSpacing:"-.3px",color:"#f1f5f9"}}>WettTracker</span>
        </div>
        <div style={{display:"flex",gap:4}}>
          {["📥 Ein-/Auszahlungen","🎲 Wetten","📈 Statistiken"].map((t,i) => (
            <button key={i} onClick={() => setTab(i)} style={{
              padding:"6px 16px",border:"none",borderRadius:6,cursor:"pointer",fontSize:13,fontWeight:600,
              background: tab===i ? "#34d399" : "transparent",
              color: tab===i ? "#0f172a" : "#94a3b8",
              transition:"all .15s"
            }}>{t}</button>
          ))}
        </div>
        {/* Steuer Toggle */}
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:12,color:"#94a3b8"}}>5% Wettsteuer</span>
          <button onClick={() => upd({steuer: !data.steuer})} style={{
            width:44,height:24,borderRadius:12,border:"none",cursor:"pointer",position:"relative",
            background: data.steuer ? "#34d399" : "#334155",transition:"background .2s"
          }}>
            <span style={{
              position:"absolute",top:3,left: data.steuer ? 22 : 3,width:18,height:18,
              borderRadius:"50%",background:"#fff",transition:"left .2s"
            }}/>
          </button>
          <span style={{fontSize:11,color: data.steuer ? "#34d399" : "#64748b", fontWeight:600}}>
            {data.steuer ? "AN" : "AUS"}
          </span>
        </div>
      </div>

      <div style={{padding:24,maxWidth:1100,margin:"0 auto"}}>
        {tab === 0 && <TabEinAus data={data} upd={upd} guthaben={guthaben} />}
        {tab === 1 && <TabWetten data={data} upd={upd} guthaben={guthaben} />}
        {tab === 2 && <TabStatistiken data={data} guthaben={guthaben} />}
      </div>
    </div>
  );
}

// ─── Tab 1: Ein-/Auszahlungen ────────────────────────────────────────────────
function TabEinAus({ data, upd, guthaben }) {
  const [modal, setModal] = useState(null); // "anbieter"|"tx"|null
  const [editAnbieter, setEditAnbieter] = useState(null);
  const [editTx, setEditTx] = useState(null);
  const [selAnbieter, setSelAnbieter] = useState(null);

  const [form, setForm] = useState({name:"",farbe:FARBEN[0]});
  const [txForm, setTxForm] = useState({anbieterId:"",art:"ein",betrag:"",datum:today(),notiz:""});

  const openAnbieter = (a=null) => {
    setEditAnbieter(a);
    setForm(a ? {name:a.name,farbe:a.farbe} : {name:"",farbe:FARBEN[data.anbieter.length % FARBEN.length]});
    setModal("anbieter");
  };
  const saveAnbieter = () => {
    if (!form.name.trim()) return;
    if (editAnbieter) {
      upd({anbieter: data.anbieter.map(a => a.id===editAnbieter.id ? {...a,...form} : a)});
    } else {
      upd({anbieter: [...data.anbieter, {id:uid(),...form}]});
    }
    setModal(null);
  };
  const delAnbieter = (id) => {
    if (!confirm("Anbieter löschen? Alle zugehörigen Daten bleiben erhalten.")) return;
    upd({anbieter: data.anbieter.filter(a=>a.id!==id)});
  };

  const openTx = (tx=null, anbieterId=null) => {
    setEditTx(tx);
    setTxForm(tx ? {anbieterId:tx.anbieterId,art:tx.art,betrag:String(tx.betrag),datum:tx.datum,notiz:tx.notiz||""}
                 : {anbieterId:anbieterId||data.anbieter[0]?.id||"",art:"ein",betrag:"",datum:today(),notiz:""});
    setModal("tx");
  };
  const saveTx = () => {
    const b = parseFloat(String(txForm.betrag).replace(",","."));
    if (!txForm.anbieterId || isNaN(b) || b<=0) return;
    const entry = {...txForm, betrag:b, id: editTx?.id||uid()};
    if (editTx) upd({transaktionen: data.transaktionen.map(t=>t.id===editTx.id?entry:t)});
    else upd({transaktionen:[...data.transaktionen, entry]});
    setModal(null);
  };
  const delTx = (id) => upd({transaktionen: data.transaktionen.filter(t=>t.id!==id)});

  const txFiltered = selAnbieter
    ? data.transaktionen.filter(t=>t.anbieterId===selAnbieter)
    : data.transaktionen;
  const sorted = [...txFiltered].sort((a,b)=>b.datum.localeCompare(a.datum));

  const totalEin = txFiltered.filter(t=>t.art==="ein").reduce((s,t)=>s+t.betrag,0);
  const totalAus = txFiltered.filter(t=>t.art==="aus").reduce((s,t)=>s+t.betrag,0);

  return (
    <div>
      {/* Anbieter Cards */}
      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:24,alignItems:"stretch"}}>
        {data.anbieter.map(a => (
          <div key={a.id} onClick={()=>setSelAnbieter(selAnbieter===a.id?null:a.id)}
            style={{background:"#1e293b",border:`2px solid ${selAnbieter===a.id?a.farbe:"#334155"}`,
              borderRadius:10,padding:"14px 18px",cursor:"pointer",minWidth:160,
              transition:"border-color .15s",position:"relative"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
              <span style={{width:10,height:10,borderRadius:"50%",background:a.farbe,display:"inline-block"}}/>
              <span style={{fontWeight:700,fontSize:14}}>{a.name}</span>
            </div>
            <div style={{fontSize:22,fontWeight:800,color:guthaben[a.id]>=0?"#34d399":"#f87171",fontVariantNumeric:"tabular-nums"}}>
              {fmtShort(guthaben[a.id]||0)}
            </div>
            <div style={{display:"flex",gap:6,marginTop:10}}>
              <button onClick={e=>{e.stopPropagation();openTx(null,a.id)}} style={btn("primary")}>+ Buchung</button>
              <button onClick={e=>{e.stopPropagation();openAnbieter(a)}} style={btn("secondary")}>✎</button>
              <button onClick={e=>{e.stopPropagation();delAnbieter(a.id)}} style={btn("danger")}>✕</button>
            </div>
          </div>
        ))}
        <div onClick={()=>openAnbieter()} style={{background:"#1e293b",border:"2px dashed #334155",borderRadius:10,
          padding:"14px 18px",cursor:"pointer",minWidth:140,display:"flex",flexDirection:"column",
          alignItems:"center",justifyContent:"center",gap:6,color:"#64748b",transition:"border-color .15s"}}
          onMouseEnter={e=>e.currentTarget.style.borderColor="#94a3b8"}
          onMouseLeave={e=>e.currentTarget.style.borderColor="#334155"}>
          <span style={{fontSize:28}}>+</span>
          <span style={{fontSize:13}}>Anbieter</span>
        </div>
      </div>

      {/* Summen */}
      {data.anbieter.length > 0 && (
        <div style={{display:"flex",gap:16,marginBottom:20,flexWrap:"wrap"}}>
          {[
            {label:"Eingezahlt", val:totalEin, color:"#34d399"},
            {label:"Ausgezahlt", val:totalAus, color:"#60a5fa"},
            {label:"Saldo", val:totalEin-totalAus, color: totalEin-totalAus>=0?"#34d399":"#f87171"},
          ].map(s=>(
            <div key={s.label} style={{background:"#1e293b",borderRadius:8,padding:"12px 20px",flex:1,minWidth:120}}>
              <div style={{fontSize:11,color:"#64748b",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>{s.label}</div>
              <div style={{fontSize:20,fontWeight:800,color:s.color}}>{fmtShort(s.val)}</div>
            </div>
          ))}
          {selAnbieter && (
            <button onClick={()=>setSelAnbieter(null)} style={{...btn("ghost"),alignSelf:"center"}}>Filter aufheben</button>
          )}
        </div>
      )}

      {/* Transaktionen Tabelle */}
      <div style={{background:"#1e293b",borderRadius:10,overflow:"hidden",border:"1px solid #334155"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 18px",borderBottom:"1px solid #334155"}}>
          <span style={{fontWeight:700,fontSize:15}}>Transaktionen {selAnbieter ? `— ${data.anbieter.find(a=>a.id===selAnbieter)?.name}` : ""}</span>
          <button onClick={()=>openTx()} style={btn("primary")} disabled={data.anbieter.length===0}>+ Buchung</button>
        </div>
        {sorted.length === 0 ? (
          <div style={{padding:40,textAlign:"center",color:"#64748b"}}>Noch keine Transaktionen</div>
        ) : (
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead>
              <tr style={{color:"#64748b",textAlign:"left"}}>
                {["Datum","Anbieter","Art","Betrag","Notiz",""].map(h=>(
                  <th key={h} style={{padding:"10px 18px",fontWeight:600,borderBottom:"1px solid #334155"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(t => {
                const a = data.anbieter.find(x=>x.id===t.anbieterId);
                return (
                  <tr key={t.id} style={{borderBottom:"1px solid #1e293b"}}
                    onMouseEnter={e=>e.currentTarget.style.background="#0f172a"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{padding:"10px 18px",color:"#94a3b8"}}>{t.datum}</td>
                    <td style={{padding:"10px 18px"}}>
                      <span style={{display:"inline-flex",alignItems:"center",gap:6}}>
                        <span style={{width:8,height:8,borderRadius:"50%",background:a?.farbe||"#64748b"}}/>
                        {a?.name||"?"}
                      </span>
                    </td>
                    <td style={{padding:"10px 18px"}}>
                      <span style={{padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700,
                        background:t.art==="ein"?"#064e3b":"#7f1d1d",color:t.art==="ein"?"#34d399":"#f87171"}}>
                        {t.art==="ein"?"Einzahlung":"Auszahlung"}
                      </span>
                    </td>
                    <td style={{padding:"10px 18px",fontWeight:700,color:t.art==="ein"?"#34d399":"#f87171",fontVariantNumeric:"tabular-nums"}}>
                      {t.art==="ein"?"+":"-"}{fmtShort(t.betrag)}
                    </td>
                    <td style={{padding:"10px 18px",color:"#94a3b8",maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.notiz||"—"}</td>
                    <td style={{padding:"10px 18px"}}>
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={()=>openTx(t)} style={{...btn("ghost"),padding:"4px 10px"}}>✎</button>
                        <button onClick={()=>delTx(t.id)} style={{...btn("danger"),padding:"4px 10px"}}>✕</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {modal==="anbieter" && (
        <Modal title={editAnbieter?"Anbieter bearbeiten":"Anbieter hinzufügen"} onClose={()=>setModal(null)}>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div>
              <label style={{fontSize:12,color:"#94a3b8",display:"block",marginBottom:4}}>Name</label>
              <input style={inp} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="z.B. Tipico" />
            </div>
            <div>
              <label style={{fontSize:12,color:"#94a3b8",display:"block",marginBottom:8}}>Farbe</label>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {FARBEN.map(f=>(
                  <div key={f} onClick={()=>setForm({...form,farbe:f})}
                    style={{width:28,height:28,borderRadius:"50%",background:f,cursor:"pointer",
                      boxShadow:form.farbe===f?"0 0 0 3px #fff, 0 0 0 5px "+f:"none",transition:"box-shadow .15s"}}/>
                ))}
              </div>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}>
              <button onClick={()=>setModal(null)} style={btn("ghost")}>Abbrechen</button>
              <button onClick={saveAnbieter} style={btn("primary")}>Speichern</button>
            </div>
          </div>
        </Modal>
      )}
      {modal==="tx" && (
        <Modal title={editTx?"Buchung bearbeiten":"Neue Buchung"} onClose={()=>setModal(null)}>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div>
              <label style={{fontSize:12,color:"#94a3b8",display:"block",marginBottom:4}}>Anbieter</label>
              <select style={inp} value={txForm.anbieterId} onChange={e=>setTxForm({...txForm,anbieterId:e.target.value})}>
                {data.anbieter.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div>
                <label style={{fontSize:12,color:"#94a3b8",display:"block",marginBottom:4}}>Art</label>
                <select style={inp} value={txForm.art} onChange={e=>setTxForm({...txForm,art:e.target.value})}>
                  <option value="ein">Einzahlung</option>
                  <option value="aus">Auszahlung</option>
                </select>
              </div>
              <div>
                <label style={{fontSize:12,color:"#94a3b8",display:"block",marginBottom:4}}>Betrag (€)</label>
                <input style={inp} type="number" step="0.01" min="0" value={txForm.betrag} onChange={e=>setTxForm({...txForm,betrag:e.target.value})} placeholder="0.00" />
              </div>
            </div>
            <div>
              <label style={{fontSize:12,color:"#94a3b8",display:"block",marginBottom:4}}>Datum</label>
              <input style={inp} type="date" value={txForm.datum} onChange={e=>setTxForm({...txForm,datum:e.target.value})} />
            </div>
            <div>
              <label style={{fontSize:12,color:"#94a3b8",display:"block",marginBottom:4}}>Notiz (optional)</label>
              <input style={inp} value={txForm.notiz} onChange={e=>setTxForm({...txForm,notiz:e.target.value})} placeholder="z.B. Bonus" />
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}>
              <button onClick={()=>setModal(null)} style={btn("ghost")}>Abbrechen</button>
              <button onClick={saveTx} style={btn("primary")}>Speichern</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Tab 2: Wetten ───────────────────────────────────────────────────────────
function TabWetten({ data, upd, guthaben }) {
  const [modal, setModal] = useState(false);
  const [editWette, setEditWette] = useState(null);
  const [form, setForm] = useState({anbieterId:"",einsatz:"",quote:"",datum:today(),notiz:""});
  const [filterStatus, setFilterStatus] = useState("alle");

  const steuerFaktor = data.steuer ? 0.05 : 0;

  const openModal = (w=null) => {
    setEditWette(w);
    setForm(w ? {anbieterId:w.anbieterId,einsatz:String(w.einsatz),quote:String(w.quote),datum:w.datum,notiz:w.notiz||""}
               : {anbieterId:data.anbieter[0]?.id||"",einsatz:"",quote:"",datum:today(),notiz:""});
    setModal(true);
  };
  const saveWette = () => {
    const e = parseFloat(String(form.einsatz).replace(",","."));
    const q = parseFloat(String(form.quote).replace(",","."));
    if (!form.anbieterId||isNaN(e)||e<=0||isNaN(q)||q<=1) return;
    const entry = {...form,einsatz:e,quote:q,id:editWette?.id||uid(),status:editWette?.status||"offen",steuer:data.steuer};
    if (editWette) upd({wetten: data.wetten.map(w=>w.id===editWette.id?entry:w)});
    else upd({wetten:[...data.wetten,entry]});
    setModal(false);
  };
  const setStatus = (id, status) => upd({wetten: data.wetten.map(w=>w.id===id?{...w,status,steuer:data.steuer}:w)});
  const delWette = (id) => upd({wetten: data.wetten.filter(w=>w.id!==id)});

  const wettCalc = (w) => {
    const sf = (data.steuer || w.steuer) ? 0.05 : 0;
    const brutto = w.einsatz * w.quote;
    const netto = brutto - brutto * sf;
    const profit = netto - w.einsatz;
    return {brutto, netto, profit};
  };

  const filtered = data.wetten
    .filter(w => filterStatus==="alle" || w.status===filterStatus)
    .sort((a,b)=>b.datum.localeCompare(a.datum));

  const stats = {
    gesamt: data.wetten.length,
    gewonnen: data.wetten.filter(w=>w.status==="gewonnen").length,
    verloren: data.wetten.filter(w=>w.status==="verloren").length,
    offen: data.wetten.filter(w=>w.status==="offen").length,
    profit: data.wetten.filter(w=>w.status!=="offen").reduce((s,w)=>{
      const sf = (data.steuer||w.steuer)?0.05:0;
      if(w.status==="gewonnen") return s + (w.einsatz*w.quote*(1-sf)) - w.einsatz;
      return s - w.einsatz;
    },0),
  };
  const hitrate = stats.gesamt-stats.offen > 0 ? (stats.gewonnen/(stats.gesamt-stats.offen)*100).toFixed(1) : null;

  return (
    <div>
      {/* Stats Row */}
      <div style={{display:"flex",gap:12,marginBottom:24,flexWrap:"wrap"}}>
        {[
          {label:"Wetten gesamt", val: stats.gesamt, color:"#f1f5f9"},
          {label:"Gewonnen", val: stats.gewonnen, color:"#34d399"},
          {label:"Verloren", val: stats.verloren, color:"#f87171"},
          {label:"Offen", val: stats.offen, color:"#94a3b8"},
          {label:"Trefferquote", val: hitrate ? hitrate+"%" : "—", color: hitrate>50?"#34d399":"#f87171"},
          {label:"Profit", val: fmtShort(stats.profit), color: stats.profit>=0?"#34d399":"#f87171"},
        ].map(s=>(
          <div key={s.label} style={{background:"#1e293b",borderRadius:8,padding:"12px 16px",flex:1,minWidth:100}}>
            <div style={{fontSize:11,color:"#64748b",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>{s.label}</div>
            <div style={{fontSize:20,fontWeight:800,color:s.color}}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Filter + Add */}
      <div style={{display:"flex",gap:8,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
        {["alle","offen","gewonnen","verloren"].map(f=>(
          <button key={f} onClick={()=>setFilterStatus(f)} style={{
            ...btn(filterStatus===f?"primary":"ghost"),
            textTransform:"capitalize"
          }}>{f}</button>
        ))}
        <button onClick={()=>openModal()} style={{...btn("primary"),marginLeft:"auto"}} disabled={data.anbieter.length===0}>
          + Neue Wette
        </button>
      </div>

      {/* Wetten Tabelle */}
      <div style={{background:"#1e293b",borderRadius:10,overflow:"hidden",border:"1px solid #334155"}}>
        {filtered.length === 0 ? (
          <div style={{padding:40,textAlign:"center",color:"#64748b"}}>
            {data.anbieter.length===0 ? "Zuerst einen Anbieter anlegen" : "Keine Wetten gefunden"}
          </div>
        ) : (
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead>
              <tr style={{color:"#64748b",textAlign:"left"}}>
                {["Datum","Anbieter","Einsatz","Quote","Pot. Gewinn","Status","Steuer",""].map(h=>(
                  <th key={h} style={{padding:"10px 16px",fontWeight:600,borderBottom:"1px solid #334155",whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(w => {
                const a = data.anbieter.find(x=>x.id===w.anbieterId);
                const {netto, profit} = wettCalc(w);
                const sf = (data.steuer||w.steuer)?0.05:0;
                return (
                  <tr key={w.id} style={{borderBottom:"1px solid #0f172a"}}
                    onMouseEnter={e=>e.currentTarget.style.background="#0f172a"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{padding:"10px 16px",color:"#94a3b8",whiteSpace:"nowrap"}}>{w.datum}</td>
                    <td style={{padding:"10px 16px"}}>
                      <span style={{display:"inline-flex",alignItems:"center",gap:6}}>
                        <span style={{width:8,height:8,borderRadius:"50%",background:a?.farbe||"#64748b"}}/>
                        {a?.name||"?"}
                      </span>
                    </td>
                    <td style={{padding:"10px 16px",fontVariantNumeric:"tabular-nums"}}>{fmtShort(w.einsatz)}</td>
                    <td style={{padding:"10px 16px",fontVariantNumeric:"tabular-nums",color:"#60a5fa",fontWeight:600}}>{w.quote.toFixed(2)}</td>
                    <td style={{padding:"10px 16px",fontVariantNumeric:"tabular-nums",color:"#a78bfa"}}>
                      {fmtShort(netto)}
                      <span style={{fontSize:11,color:"#64748b",marginLeft:4}}>
                        ({profit>=0?"+":""}{fmtShort(profit)})
                      </span>
                    </td>
                    <td style={{padding:"10px 16px"}}>
                      <span style={{padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700,
                        background:w.status==="gewonnen"?"#064e3b":w.status==="verloren"?"#7f1d1d":"#1e293b",
                        color:BADGE[w.status],border:"1px solid "+BADGE[w.status]}}>
                        {w.status.charAt(0).toUpperCase()+w.status.slice(1)}
                      </span>
                    </td>
                    <td style={{padding:"10px 16px",fontSize:11,color:"#64748b"}}>
                      {sf>0?"5%":"—"}
                    </td>
                    <td style={{padding:"10px 16px"}}>
                      <div style={{display:"flex",gap:4,flexWrap:"nowrap"}}>
                        {w.status==="offen" && <>
                          <button onClick={()=>setStatus(w.id,"gewonnen")} style={{...btn("primary"),padding:"4px 8px",fontSize:11}}>✓ Gewonnen</button>
                          <button onClick={()=>setStatus(w.id,"verloren")} style={{...btn("danger"),padding:"4px 8px",fontSize:11}}>✕ Verloren</button>
                        </>}
                        {w.status!=="offen" && (
                          <button onClick={()=>setStatus(w.id,"offen")} style={{...btn("ghost"),padding:"4px 8px",fontSize:11}}>↩ Rückgängig</button>
                        )}
                        <button onClick={()=>openModal(w)} style={{...btn("ghost"),padding:"4px 8px"}}>✎</button>
                        <button onClick={()=>delWette(w.id)} style={{...btn("danger"),padding:"4px 8px"}}>✕</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <Modal title={editWette?"Wette bearbeiten":"Neue Wette"} onClose={()=>setModal(false)}>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div>
              <label style={{fontSize:12,color:"#94a3b8",display:"block",marginBottom:4}}>Anbieter</label>
              <select style={inp} value={form.anbieterId} onChange={e=>setForm({...form,anbieterId:e.target.value})}>
                {data.anbieter.map(a=><option key={a.id} value={a.id}>{a.name} ({fmtShort(guthaben[a.id]||0)})</option>)}
              </select>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div>
                <label style={{fontSize:12,color:"#94a3b8",display:"block",marginBottom:4}}>Einsatz (€)</label>
                <input style={inp} type="number" step="0.01" min="0" value={form.einsatz} onChange={e=>setForm({...form,einsatz:e.target.value})} placeholder="0.00" />
              </div>
              <div>
                <label style={{fontSize:12,color:"#94a3b8",display:"block",marginBottom:4}}>Quote</label>
                <input style={inp} type="number" step="0.01" min="1.01" value={form.quote} onChange={e=>setForm({...form,quote:e.target.value})} placeholder="z.B. 2.50" />
              </div>
            </div>
            {form.einsatz && form.quote && (
              <div style={{background:"#0f172a",borderRadius:8,padding:"10px 14px",fontSize:13}}>
                <div style={{color:"#64748b",marginBottom:4}}>Vorschau</div>
                {(() => {
                  const e = parseFloat(String(form.einsatz).replace(",","."))||0;
                  const q = parseFloat(String(form.quote).replace(",","."))||0;
                  const brutto = e*q;
                  const sf = data.steuer ? 0.05 : 0;
                  const netto = brutto - brutto*sf;
                  return <>
                    <div>Bruttogewinn: <b style={{color:"#a78bfa"}}>{fmtShort(brutto)}</b></div>
                    {sf>0 && <div style={{color:"#f87171"}}>- 5% Steuer: -{fmtShort(brutto*sf)}</div>}
                    <div>Nettogewinn: <b style={{color:"#34d399"}}>{fmtShort(netto)}</b></div>
                    <div style={{color:"#64748b"}}>Profit: {fmtShort(netto-e)}</div>
                  </>;
                })()}
              </div>
            )}
            <div>
              <label style={{fontSize:12,color:"#94a3b8",display:"block",marginBottom:4}}>Datum</label>
              <input style={inp} type="date" value={form.datum} onChange={e=>setForm({...form,datum:e.target.value})} />
            </div>
            <div>
              <label style={{fontSize:12,color:"#94a3b8",display:"block",marginBottom:4}}>Notiz (optional)</label>
              <input style={inp} value={form.notiz} onChange={e=>setForm({...form,notiz:e.target.value})} placeholder="z.B. Bayern vs Dortmund" />
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}>
              <button onClick={()=>setModal(false)} style={btn("ghost")}>Abbrechen</button>
              <button onClick={saveWette} style={btn("primary")}>Speichern</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Tab 3: Statistiken ──────────────────────────────────────────────────────
function TabStatistiken({ data, guthaben }) {
  const [horizon, setHorizon] = useState("Monat");

  const start = startOf(horizon);

  // Alle relevanten Daten sammeln
  const chartData = useMemo(() => {
    const cutoff = start.toISOString().slice(0,10);

    // Alle Datenpunkte sammeln
    const events = [];

    // Transaktionen
    data.transaktionen.forEach(t => {
      events.push({datum: t.datum, type:"tx", data: t});
    });
    // Abgeschlossene Wetten
    data.wetten.filter(w=>w.status!=="offen").forEach(w => {
      events.push({datum: w.datum, type:"wette", data: w});
    });

    events.sort((a,b)=>a.datum.localeCompare(b.datum));

    // Kumulierte Werte berechnen (alle Zeit, dann im Zeitfenster anzeigen)
    let einAusCumul = 0; // Netto Ein-/Auszahlungen
    let wettenCumul = 0; // Interner Wetten-Profit
    let gesamtCumul = 0; // Ein-/Aus + Wetten-Profit

    // Alle Events vor cutoff akkumulieren als Baseline
    const preEvents = events.filter(e=>e.datum < cutoff);
    preEvents.forEach(e => {
      if (e.type==="tx") {
        const delta = e.data.art==="ein" ? e.data.betrag : -e.data.betrag;
        einAusCumul += delta;
      } else {
        const w = e.data;
        const sf = (data.steuer||w.steuer)?0.05:0;
        if (w.status==="gewonnen") {
          const p = w.einsatz*w.quote*(1-sf) - w.einsatz;
          wettenCumul += p;
          gesamtCumul += p;
        } else {
          wettenCumul -= w.einsatz;
          gesamtCumul -= w.einsatz;
        }
      }
    });
    // Einzahlungen vor cutoff auch in gesamt
    preEvents.filter(e=>e.type==="tx").forEach(e=>{
      const delta = e.data.art==="ein" ? e.data.betrag : -e.data.betrag;
      gesamtCumul += delta;
    });
    // Reset: gesamt ist kombination
    // Neuberechnung sauber:
    let cumTx = 0, cumWetten = 0;
    preEvents.forEach(e=>{
      if(e.type==="tx") cumTx += e.data.art==="ein" ? e.data.betrag : -e.data.betrag;
      else {
        const w=e.data, sf=(data.steuer||w.steuer)?0.05:0;
        cumWetten += w.status==="gewonnen" ? w.einsatz*w.quote*(1-sf)-w.einsatz : -w.einsatz;
      }
    });

    // Jetzt im Zeitfenster
    const inEvents = events.filter(e=>e.datum >= cutoff);
    
    // Tagesauflösung für kurze Horizonte
    const days = Math.round((new Date()-start)/86400000);
    
    // Datenpunkte per Tag
    const byDay = {};
    inEvents.forEach(e => {
      if(!byDay[e.datum]) byDay[e.datum] = [];
      byDay[e.datum].push(e);
    });

    // Alle Tage im Bereich
    const result = [];
    // Startpunkt
    result.push({
      datum: cutoff,
      einAus: cumTx,
      wetten: cumWetten,
      gesamt: cumTx + cumWetten,
    });

    // Iteriere durch Tage
    const allDays = [...new Set(Object.keys(byDay))].sort();
    let runTx = cumTx, runWetten = cumWetten;
    allDays.forEach(d => {
      byDay[d].forEach(e=>{
        if(e.type==="tx") runTx += e.data.art==="ein" ? e.data.betrag : -e.data.betrag;
        else {
          const w=e.data, sf=(data.steuer||w.steuer)?0.05:0;
          runWetten += w.status==="gewonnen" ? w.einsatz*w.quote*(1-sf)-w.einsatz : -w.einsatz;
        }
      });
      result.push({datum:d, einAus:runTx, wetten:runWetten, gesamt:runTx+runWetten});
    });

    // Heutigen Punkt hinzufügen falls nicht vorhanden
    const todayStr = today();
    if(result.length===0||result[result.length-1].datum !== todayStr) {
      const last = result[result.length-1] || {einAus:0,wetten:0,gesamt:0};
      result.push({datum:todayStr, einAus:last.einAus, wetten:last.wetten, gesamt:last.gesamt});
    }

    // Gesamt inkludiert auch aktuell beim Anbieter verbliebenes Geld
    const totalGuthaben = Object.values(guthaben).reduce((s,v)=>s+v,0);
    
    // Format für Recharts
    return result.map((p,i) => ({
      ...p,
      label: formatLabel(p.datum, horizon),
    }));
  }, [data, horizon, guthaben]);

  // Aktuelles Guthaben bei allen Anbietern
  const totalGuthaben = Object.values(guthaben).reduce((s,v)=>s+v,0);
  const totalEin = data.transaktionen.filter(t=>t.art==="ein").reduce((s,t)=>s+t.betrag,0);
  const totalAus = data.transaktionen.filter(t=>t.art==="aus").reduce((s,t)=>s+t.betrag,0);
  const totalWettenProfit = data.wetten.filter(w=>w.status!=="offen").reduce((s,w)=>{
    const sf=(data.steuer||w.steuer)?0.05:0;
    return s + (w.status==="gewonnen" ? w.einsatz*w.quote*(1-sf)-w.einsatz : -w.einsatz);
  },0);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{background:"#1e293b",border:"1px solid #334155",borderRadius:8,padding:"10px 14px",fontSize:12}}>
        <div style={{color:"#94a3b8",marginBottom:6}}>{label}</div>
        {payload.map(p=>(
          <div key={p.name} style={{color:p.color,marginBottom:2}}>
            {p.name}: <b>{fmtShort(p.value)}</b>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      {/* KPIs */}
      <div style={{display:"flex",gap:12,marginBottom:24,flexWrap:"wrap"}}>
        {[
          {label:"Eingezahlt gesamt", val:fmtShort(totalEin), color:"#34d399"},
          {label:"Ausgezahlt gesamt", val:fmtShort(totalAus), color:"#60a5fa"},
          {label:"Guthaben bei Anbietern", val:fmtShort(totalGuthaben), color:"#a78bfa"},
          {label:"Wetten-Profit", val:fmtShort(totalWettenProfit), color:totalWettenProfit>=0?"#34d399":"#f87171"},
          {label:"Gesamtbilanz", val:fmtShort(totalAus-totalEin+totalGuthaben), color:(totalAus-totalEin+totalGuthaben)>=0?"#34d399":"#f87171"},
        ].map(s=>(
          <div key={s.label} style={{background:"#1e293b",borderRadius:8,padding:"12px 16px",flex:1,minWidth:120}}>
            <div style={{fontSize:11,color:"#64748b",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>{s.label}</div>
            <div style={{fontSize:18,fontWeight:800,color:s.color}}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Zeithorizont */}
      <div style={{display:"flex",gap:6,marginBottom:20}}>
        {HORIZONS.map(h=>(
          <button key={h} onClick={()=>setHorizon(h)} style={{
            ...btn(horizon===h?"primary":"ghost"),
            padding:"6px 14px",fontSize:12
          }}>{h}</button>
        ))}
      </div>

      {/* Charts */}
      {[
        {key:"wetten", label:"Interner Wetten-Profit", color:"#34d399", desc:"Profit aus Wetten (Gewinn−Einsatz)"},
        {key:"einAus", label:"Ein-/Auszahlungen (Saldo)", color:"#60a5fa", desc:"Kumulierter Saldo der Ein- und Auszahlungen"},
        {key:"gesamt", label:"Gesamtbilanz", color:"#a78bfa", desc:"Ein-/Auszahlungssaldo + Wetten-Profit"},
      ].map(curve => (
        <div key={curve.key} style={{background:"#1e293b",borderRadius:10,padding:"20px 20px 8px",marginBottom:20,border:"1px solid #334155"}}>
          <div style={{marginBottom:4}}>
            <div style={{fontWeight:700,fontSize:15,color:curve.color}}>{curve.label}</div>
            <div style={{fontSize:12,color:"#64748b"}}>{curve.desc}</div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{top:10,right:10,left:10,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false}/>
              <XAxis dataKey="label" tick={{fill:"#64748b",fontSize:11}} tickLine={false} axisLine={false}
                interval={Math.max(0,Math.floor(chartData.length/6)-1)} />
              <YAxis tick={{fill:"#64748b",fontSize:11}} tickLine={false} axisLine={false}
                tickFormatter={v=>v.toFixed(0)+"€"} width={55}/>
              <Tooltip content={<CustomTooltip/>}/>
              <ReferenceLine y={0} stroke="#334155" strokeDasharray="4 2"/>
              <Line type="monotone" dataKey={curve.key} name={curve.label}
                stroke={curve.color} strokeWidth={2.5} dot={false}
                activeDot={{r:5,fill:curve.color}}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      ))}

      {/* Alle 3 Kurven kombiniert */}
      <div style={{background:"#1e293b",borderRadius:10,padding:"20px 20px 8px",border:"1px solid #334155"}}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>Vergleich — alle Kurven</div>
        <div style={{fontSize:12,color:"#64748b",marginBottom:12}}>Alle drei Metriken im Überblick</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{top:10,right:10,left:10,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#0f172a" vertical={false}/>
            <XAxis dataKey="label" tick={{fill:"#64748b",fontSize:11}} tickLine={false} axisLine={false}
              interval={Math.max(0,Math.floor(chartData.length/6)-1)}/>
            <YAxis tick={{fill:"#64748b",fontSize:11}} tickLine={false} axisLine={false}
              tickFormatter={v=>v.toFixed(0)+"€"} width={55}/>
            <Tooltip content={({active,payload,label})=>{
              if(!active||!payload?.length) return null;
              return <div style={{background:"#0f172a",border:"1px solid #334155",borderRadius:8,padding:"10px 14px",fontSize:12}}>
                <div style={{color:"#94a3b8",marginBottom:6}}>{label}</div>
                {payload.map(p=><div key={p.name} style={{color:p.color,marginBottom:2}}>{p.name}: <b>{fmtShort(p.value)}</b></div>)}
              </div>;
            }}/>
            <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize:12,color:"#94a3b8",paddingTop:8}}/>
            <ReferenceLine y={0} stroke="#334155" strokeDasharray="4 2"/>
            <Line type="monotone" dataKey="wetten" name="Wetten-Profit" stroke="#34d399" strokeWidth={2} dot={false} activeDot={{r:4}}/>
            <Line type="monotone" dataKey="einAus" name="Ein-/Auszahlungen" stroke="#60a5fa" strokeWidth={2} dot={false} activeDot={{r:4}}/>
            <Line type="monotone" dataKey="gesamt" name="Gesamtbilanz" stroke="#a78bfa" strokeWidth={2.5} dot={false} activeDot={{r:4}}/>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function formatLabel(datum, horizon) {
  const d = new Date(datum+"T12:00:00");
  if (horizon === "Tag") return d.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"});
  if (horizon === "Woche") return d.toLocaleDateString("de-DE",{weekday:"short",day:"numeric"});
  if (horizon === "Monat") return d.toLocaleDateString("de-DE",{day:"numeric",month:"short"});
  if (horizon === "3M" || horizon === "6M") return d.toLocaleDateString("de-DE",{day:"numeric",month:"short"});
  return d.toLocaleDateString("de-DE",{month:"short",year:"2-digit"});
}
