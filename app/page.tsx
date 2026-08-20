"use client";

import { useMemo, useState } from "react";

type Mode = "MAIN" | "STAT";
type Angle = "DEG" | "RAD";
type Dist = "BINOMIAL" | "NORMAL";
type DistFn = "PDF" | "CDF" | "INV";
type HistoryItem = { expression: string; result: string };
type Fields = {
  n: string; p: string; x: string; mu: string; sigma: string;
  lower: string; upper: string; area: string;
};

type KeyType =
  | "shift" | "alpha" | "menu" | "exit" | "soft" | "nav" | "exe"
  | "ac" | "del" | "inv" | "square" | "sqrt" | "log" | "ln"
  | "sin" | "cos" | "tan" | "char" | "sd" | "ans";

const keyDefs: [string, KeyType][] = [
  ["SHIFT","shift"], ["ALPHA","alpha"], ["MENU","menu"], ["EXIT","exit"], ["F1","soft"], ["F2","soft"], ["F3","soft"],
  ["▲","nav"], ["▼","nav"], ["◀","nav"], ["▶","nav"], ["EXE","exe"], ["AC/ON","ac"], ["DEL","del"],
  ["x⁻¹","inv"], ["x²","square"], ["√","sqrt"], ["log","log"], ["ln","ln"], ["sin","sin"], ["cos","cos"], ["tan","tan"],
  ["(","char"], [")","char"], ["S↔D","sd"], ["×","char"], ["÷","char"], ["−","char"],
  ["7","char"], ["8","char"], ["9","char"], ["4","char"], ["5","char"], ["6","char"], ["+","char"],
  ["1","char"], ["2","char"], ["3","char"], ["0","char"], [".","char"], ["Ans","ans"], ["=","exe"]
];

function fmt(value: number) {
  if (!Number.isFinite(value)) return "Math ERROR";
  if (Math.abs(value) < 1e-14) return "0";
  if (Math.abs(value) >= 1e12 || (Math.abs(value) < 1e-9 && value !== 0)) return value.toExponential(10);
  return Number(value.toPrecision(12)).toString();
}

function autoCloseParentheses(raw: string) {
  let balance = 0;
  for (const ch of raw) {
    if (ch === "(") balance++;
    else if (ch === ")") balance--;
    if (balance < 0) return raw;
  }
  return raw + ")".repeat(balance);
}

function factorial(n: number) {
  if (!Number.isInteger(n) || n < 0) return NaN;
  let out = 1;
  for (let i = 2; i <= n; i++) out *= i;
  return out;
}

function combination(n: number, r: number) {
  if (!Number.isInteger(n) || !Number.isInteger(r) || r < 0 || n < 0 || r > n) return 0;
  r = Math.min(r, n-r);
  let out = 1;
  for (let i = 1; i <= r; i++) out = (out * (n-r+i)) / i;
  return out;
}

function binomPdf(n: number, p: number, x: number) {
  if (!Number.isInteger(n) || n < 0 || p < 0 || p > 1 || !Number.isInteger(x)) return NaN;
  if (x < 0 || x > n) return 0;
  return combination(n,x) * p**x * (1-p)**(n-x);
}

function binomCdf(n: number, p: number, x: number) {
  if (!Number.isInteger(n) || n < 0 || p < 0 || p > 1) return NaN;
  const k = Math.max(-1, Math.min(n, Math.floor(x)));
  let sum = 0;
  for (let i = 0; i <= k; i++) sum += binomPdf(n,p,i);
  return sum;
}

function erf(x: number) {
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const a1=.254829592,a2=-.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=.3275911;
  const t=1/(1+p*x);
  const y=1-(((((a5*t+a4)*t+a3)*t+a2)*t+a1)*t*Math.exp(-x*x));
  return sign*y;
}

function normalPdf(x: number, mu=0, sigma=1) {
  if (!(sigma > 0)) return NaN;
  const z=(x-mu)/sigma;
  return Math.exp(-.5*z*z)/(sigma*Math.sqrt(2*Math.PI));
}

function normalCdf(x: number, mu=0, sigma=1) {
  if (!(sigma > 0)) return NaN;
  return .5*(1+erf((x-mu)/(sigma*Math.sqrt(2))));
}

function invNormal(prob: number,mu=0,sigma=1) {
  if (!(prob>0&&prob<1) || !(sigma>0)) return NaN;
  const a=[-39.69683028665376,220.9460984245205,-275.9285104469687,138.357751867269,-30.66479806614716,2.506628277459239];
  const b=[-54.47609879822406,161.5858368580409,-155.6989798598866,66.80131188771972,-13.28068155288572];
  const c=[-.007784894002430293,-.3223964580411365,-2.400758277161838,-2.549732539343734,4.374664141464968,2.938163982698783];
  const d=[.007784695709041462,.3224671290700398,2.445134137142996,3.754408661907416];
  const pl=.02425, ph=1-pl;
  let q: number, r: number, z: number;
  if (prob<pl) { q=Math.sqrt(-2*Math.log(prob)); z=(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
  else if (prob>ph) { q=Math.sqrt(-2*Math.log(1-prob)); z=-(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
  else { q=prob-.5; r=q*q; z=(((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1); }
  return mu+sigma*z;
}

export default function Home() {
  const [mode,setMode] = useState<Mode>("MAIN");
  const [angle,setAngle] = useState<Angle>("DEG");
  const [shift,setShift] = useState(false);
  const [expr,setExpr] = useState("");
  const [result,setResult] = useState("0");
  const [ans,setAns] = useState(0);
  const [history,setHistory] = useState<HistoryItem[]>([]);
  const [dist,setDist] = useState<Dist>("BINOMIAL");
  const [distFn,setDistFn] = useState<DistFn>("PDF");
  const [fields,setFields] = useState<Fields>({ n:"10", p:"0.5", x:"5", mu:"0", sigma:"1", lower:"-1", upper:"1", area:"0.975" });

  const modeLabel = mode === "MAIN" ? "MAIN  1" : "STAT  DIST";

  function toRad(x:number){ return angle === "DEG" ? x * Math.PI / 180 : x; }
  function fromRad(x:number){ return angle === "DEG" ? x * 180 / Math.PI : x; }

  function evaluateExpression(raw:string) {
    raw = autoCloseParentheses(raw);
    let s = raw
      .replaceAll("×","*").replaceAll("÷","/").replaceAll("−","-")
      .replace(/Ans/g, `(${ans})`)
      .replace(/\bpi\b|π/g, `(${Math.PI})`)
      .replace(/\be\b/g, `(${Math.E})`)
      .replace(/sqrt\(/g, "SQRT(")
      .replace(/asin\(/g, "ASIN(").replace(/acos\(/g, "ACOS(").replace(/atan\(/g, "ATAN(")
      .replace(/sin\(/g, "SIN(").replace(/cos\(/g, "COS(").replace(/tan\(/g, "TAN(")
      .replace(/log\(/g, "LOG(").replace(/ln\(/g, "LN(")
      .replace(/\^/g, "**");

    const allowed = /^[0-9+\-*/().,\sA-Z_*]+$/;
    if (!allowed.test(s)) throw new Error("invalid characters");
    const fn = Function("SIN","COS","TAN","ASIN","ACOS","ATAN","LOG","LN","SQRT", `"use strict"; return (${s});`);
    return Number(fn(
      (x:number)=>Math.sin(toRad(x)), (x:number)=>Math.cos(toRad(x)), (x:number)=>Math.tan(toRad(x)),
      (x:number)=>fromRad(Math.asin(x)), (x:number)=>fromRad(Math.acos(x)), (x:number)=>fromRad(Math.atan(x)),
      (x:number)=>Math.log10(x), (x:number)=>Math.log(x), (x:number)=>Math.sqrt(x)
    ));
  }

  function runExpression() {
    if (!expr.trim()) return;
    try {
      const value=evaluateExpression(expr);
      const next=fmt(value);
      setResult(next);
      if (Number.isFinite(value)) setAns(value);
      setHistory(prev=>[{expression:expr,result:next},...prev].slice(0,12));
    } catch { setResult("Syntax ERROR"); }
  }

  function calculateDistribution() {
    const n=Number(fields.n),p=Number(fields.p),x=Number(fields.x),mu=Number(fields.mu),sigma=Number(fields.sigma);
    let value=NaN;
    if (dist === "BINOMIAL") value = distFn === "PDF" ? binomPdf(n,p,x) : binomCdf(n,p,x);
    else if (distFn === "PDF") value=normalPdf(x,mu,sigma);
    else if (distFn === "CDF") value=normalCdf(Number(fields.upper),mu,sigma)-normalCdf(Number(fields.lower),mu,sigma);
    else value=invNormal(Number(fields.area),mu,sigma);
    setResult(fmt(value));
  }

  function press(label:string,type:KeyType) {
    if(type === "shift") { setShift(v=>!v); return; }
    if(type === "menu") { setMode(m=>m === "MAIN" ? "STAT" : "MAIN"); return; }
    if(type === "exit") { if(mode === "STAT") setMode("MAIN"); return; }
    if(type === "ac") { setExpr(""); setResult("0"); setShift(false); return; }
    if(type === "del") { setExpr(v=>v.slice(0,-1)); return; }
    if(type === "exe") { mode === "STAT" ? calculateDistribution() : runExpression(); setShift(false); return; }
    if(type === "ans") { setExpr(v=>v+"Ans"); return; }
    if(type === "square") { setExpr(v=>v ? `(${v})^2` : ""); return; }
    if(type === "inv") { setExpr(v=>v ? `1/(${v})` : "1/("); return; }
    if(type === "sqrt") { setExpr(v=>v+"sqrt("); return; }
    if(["sin","cos","tan"].includes(type)) { setExpr(v=>v+`${shift?"a":""}${type}(`); setShift(false); return; }
    if(type === "log") { setExpr(v=>v+(shift ? "10^(" : "log(")); setShift(false); return; }
    if(type === "ln") { setExpr(v=>v+(shift ? "e^(" : "ln(")); setShift(false); return; }
    if(type === "char") { setExpr(v=>v+label); }
  }

  const fieldList = useMemo(() => {
    if (dist === "BINOMIAL") return [["n","NumTrial"],["p","p"],["x","x"]] as [keyof Fields,string][];
    const arr:[keyof Fields,string][]=[];
    if(distFn === "PDF") arr.push(["x","x"]);
    if(distFn === "CDF") arr.push(["lower","Lower"],["upper","Upper"]);
    if(distFn === "INV") arr.push(["area","Area"]);
    arr.push(["mu","μ"],["sigma","σ"]);
    return arr;
  },[dist,distFn]);

  return (
    <main className="page-shell">
      <section className="calculator">
        <header className="brand-row">
          <div><strong>GDC TRAINER</strong><span>GRAPHING CALCULATOR</span></div>
          <button className="theme-dot" aria-label="Theme">☀︎</button>
        </header>

        <section className="screen">
          <div className="screen-top"><span>{modeLabel}</span><span><b>{angle}</b>&nbsp;&nbsp;MATH</span></div>
          {mode === "MAIN" ? (
            <div>
              <div className="expression">{expr || "0"}</div>
              <div className="answer">{result}</div>
              <div className="status">◀▶ RUN&nbsp;&nbsp; {angle}&nbsp;&nbsp; MATH</div>
            </div>
          ) : (
            <div className="stat-screen">
              <div className="stat-title">STAT &gt; DIST &gt; {dist}</div>
              <div className="stat-result">{result}</div>
              <div className="status">F1:DIST&nbsp;&nbsp; F6:CALC</div>
            </div>
          )}
        </section>

        {mode === "STAT" && (
          <section className="stat-panel">
            <div className="stat-tabs">
              <button className="active">DIST</button>
              <button className={dist === "BINOMIAL" ? "active" : ""} onClick={()=>{setDist("BINOMIAL");setDistFn("PDF")}}>BINM</button>
              <button className={dist === "NORMAL" ? "active" : ""} onClick={()=>{setDist("NORMAL");setDistFn("PDF")}}>NORM</button>
            </div>
            <div className="dist-tabs">
              <button className={distFn === "PDF" ? "active" : ""} onClick={()=>setDistFn("PDF")}>PDF</button>
              <button className={distFn === "CDF" ? "active" : ""} onClick={()=>setDistFn("CDF")}>CDF</button>
              {dist === "NORMAL" && <button className={distFn === "INV" ? "active" : ""} onClick={()=>setDistFn("INV")}>InvN</button>}
            </div>
            <div className="field-grid">
              {fieldList.map(([name,label])=>(
                <label key={name}>{label}
                  <input inputMode="decimal" value={fields[name]} onChange={e=>setFields(f=>({...f,[name]:e.target.value}))}/>
                </label>
              ))}
            </div>
            <button className="calc-dist" onClick={calculateDistribution}>CALC / EXE</button>
          </section>
        )}

        <section className="keypad">
          {keyDefs.map(([label,type],i)=>{
            const shifted:Record<string,string>={sin:"sin⁻¹",cos:"cos⁻¹",tan:"tan⁻¹",log:"10ˣ",ln:"eˣ"};
            return <button key={`${label}-${i}`} className={`key key-${type} ${label === "SHIFT" && shift ? "pressed" : ""}`} onClick={()=>press(label,type)}>
              {shifted[label] && <small>{shifted[label]}</small>}{label}
            </button>;
          })}
        </section>
      </section>

      <aside className="side-panel">
        <h1>GDC Trainer</h1>
        <p>Practicá la interfaz de una calculadora gráfica desde el navegador.</p>
        <div className="mode-box"><b>Angle</b><button onClick={()=>setAngle(a=>a === "DEG" ? "RAD" : "DEG")}>{angle}</button></div>
        <h2>Historial</h2>
        {history.length === 0 ? <p className="muted">Sin cálculos todavía.</p> : (
          <ol className="history">{history.map((h,i)=><li key={i}><code>{h.expression}</code><strong>{h.result}</strong></li>)}</ol>
        )}
      </aside>
    </main>
  );
}
