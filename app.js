const state = {
  mode:'MAIN', angle:'DEG', shift:false, expr:'', result:'0', ans:0,
  history:[], dist:'BINOMIAL', distFn:'PDF',
  fields:{ n:'10', p:'0.5', x:'5', mu:'0', sigma:'1', lower:'-1', upper:'1', area:'0.975' }
};

const $ = (id) => document.getElementById(id);

const keyDefs = [
  ['SHIFT','shift'], ['ALPHA','alpha'], ['MENU','menu'], ['EXIT','exit'], ['F1','soft'], ['F2','soft'], ['F3','soft'],
  ['▲','nav'], ['▼','nav'], ['◀','nav'], ['▶','nav'], ['EXE','exe'], ['AC/ON','ac'], ['DEL','del'],
  ['x⁻¹','inv'], ['x²','square'], ['√','sqrt'], ['log','log'], ['ln','ln'], ['sin','sin'], ['cos','cos'], ['tan','tan'],
  ['(','char'], [')','char'], ['S↔D','sd'], ['×','char'], ['÷','char'], ['−','char'],
  ['7','char'], ['8','char'], ['9','char'], ['4','char'], ['5','char'], ['6','char'], ['+','char'],
  ['1','char'], ['2','char'], ['3','char'], ['0','char'], ['.','char'], ['Ans','ans'], ['=','exe']
];

function fmt(value) {
  if (!Number.isFinite(value)) return 'Math ERROR';
  if (Math.abs(value) < 1e-14) return '0';
  if (Math.abs(value) >= 1e12 || (Math.abs(value) < 1e-9 && value !== 0)) return value.toExponential(10);
  return Number(value.toPrecision(12)).toString();
}

function toRad(x){ return state.angle === 'DEG' ? x * Math.PI / 180 : x; }
function fromRad(x){ return state.angle === 'DEG' ? x * 180 / Math.PI : x; }

function evaluateExpression(raw) {
  let s = raw
    .replaceAll('×','*').replaceAll('÷','/').replaceAll('−','-')
    .replace(/Ans/g, `(${state.ans})`)
    .replace(/\bpi\b|π/g, `(${Math.PI})`)
    .replace(/\be\b/g, `(${Math.E})`)
    .replace(/sqrt\(/g, 'SQRT(')
    .replace(/asin\(/g, 'ASIN(').replace(/acos\(/g, 'ACOS(').replace(/atan\(/g, 'ATAN(')
    .replace(/sin\(/g, 'SIN(').replace(/cos\(/g, 'COS(').replace(/tan\(/g, 'TAN(')
    .replace(/log\(/g, 'LOG(').replace(/ln\(/g, 'LN(')
    .replace(/\^/g, '**');

  const allowed = /^[0-9+\-*/().,\sA-Z_*]+$/;
  if (!allowed.test(s)) throw new Error('invalid characters');
  const fn = Function('SIN','COS','TAN','ASIN','ACOS','ATAN','LOG','LN','SQRT', `"use strict"; return (${s});`);
  return Number(fn(
    x=>Math.sin(toRad(x)), x=>Math.cos(toRad(x)), x=>Math.tan(toRad(x)),
    x=>fromRad(Math.asin(x)), x=>fromRad(Math.acos(x)), x=>fromRad(Math.atan(x)),
    x=>Math.log10(x), x=>Math.log(x), x=>Math.sqrt(x)
  ));
}

function runExpression(){
  if (!state.expr.trim()) return;
  try {
    const value = evaluateExpression(state.expr);
    state.result = fmt(value);
    if (Number.isFinite(value)) state.ans = value;
    state.history.unshift({expression:state.expr,result:state.result});
    state.history = state.history.slice(0,12);
  } catch { state.result = 'Syntax ERROR'; }
  render();
}

function press(label,type){
  if(type==='shift'){ state.shift=!state.shift; return render(); }
  if(type==='menu'){ state.mode = state.mode==='MAIN'?'STAT':'MAIN'; return render(); }
  if(type==='exit'){ if(state.mode==='STAT') state.mode='MAIN'; return render(); }
  if(type==='ac'){ state.expr=''; state.result='0'; state.shift=false; return render(); }
  if(type==='del'){ state.expr=state.expr.slice(0,-1); return render(); }
  if(type==='exe'){ if(state.mode==='STAT') calculateDistribution(); else runExpression(); state.shift=false; return; }
  if(type==='ans'){ state.expr+='Ans'; return render(); }
  if(type==='square'){ state.expr = state.expr ? `(${state.expr})^2` : ''; return render(); }
  if(type==='inv'){ state.expr = state.expr ? `1/(${state.expr})` : '1/('; return render(); }
  if(type==='sqrt'){ state.expr += 'sqrt('; return render(); }
  if(['sin','cos','tan'].includes(type)){ state.expr += `${state.shift?'a':''}${type}(`; state.shift=false; return render(); }
  if(type==='log'){ state.expr += state.shift ? '10^(' : 'log('; state.shift=false; return render(); }
  if(type==='ln'){ state.expr += state.shift ? 'e^(' : 'ln('; state.shift=false; return render(); }
  if(type==='char'){ state.expr += label; return render(); }
}

function factorial(n){ if(!Number.isInteger(n)||n<0)return NaN; let o=1;for(let i=2;i<=n;i++)o*=i;return o; }
function combination(n,r){ if(!Number.isInteger(n)||!Number.isInteger(r)||r<0||n<0||r>n)return 0;r=Math.min(r,n-r);let o=1;for(let i=1;i<=r;i++)o=(o*(n-r+i))/i;return o; }
function binomPdf(n,p,x){ if(!Number.isInteger(n)||n<0||p<0||p>1||!Number.isInteger(x))return NaN;if(x<0||x>n)return 0;return combination(n,x)*p**x*(1-p)**(n-x); }
function binomCdf(n,p,x){ if(!Number.isInteger(n)||n<0||p<0||p>1)return NaN;let k=Math.max(-1,Math.min(n,Math.floor(x))),s=0;for(let i=0;i<=k;i++)s+=binomPdf(n,p,i);return s; }
function erf(x){ const sign=x<0?-1:1;x=Math.abs(x);const a1=.254829592,a2=-.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=.3275911,t=1/(1+p*x);const y=1-(((((a5*t+a4)*t+a3)*t+a2)*t+a1)*t*Math.exp(-x*x));return sign*y; }
function normalPdf(x,mu=0,sigma=1){ if(!(sigma>0))return NaN;const z=(x-mu)/sigma;return Math.exp(-.5*z*z)/(sigma*Math.sqrt(2*Math.PI)); }
function normalCdf(x,mu=0,sigma=1){ if(!(sigma>0))return NaN;return .5*(1+erf((x-mu)/(sigma*Math.sqrt(2)))); }
function invNormal(prob,mu=0,sigma=1){
  if(!(prob>0&&prob<1)||!(sigma>0))return NaN;
  const a=[-39.69683028665376,220.9460984245205,-275.9285104469687,138.357751867269,-30.66479806614716,2.506628277459239],b=[-54.47609879822406,161.5858368580409,-155.6989798598866,66.80131188771972,-13.28068155288572],c=[-.007784894002430293,-.3223964580411365,-2.400758277161838,-2.549732539343734,4.374664141464968,2.938163982698783],d=[.007784695709041462,.3224671290700398,2.445134137142996,3.754408661907416],pl=.02425,ph=1-pl;let q,r,z;
  if(prob<pl){q=Math.sqrt(-2*Math.log(prob));z=(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}
  else if(prob>ph){q=Math.sqrt(-2*Math.log(1-prob));z=-(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);}
  else{q=prob-.5;r=q*q;z=(((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);}
  return mu+sigma*z;
}

function calculateDistribution(){
  const f=state.fields,n=Number(f.n),p=Number(f.p),x=Number(f.x),mu=Number(f.mu),sigma=Number(f.sigma);let value=NaN;
  if(state.dist==='BINOMIAL') value=state.distFn==='PDF'?binomPdf(n,p,x):binomCdf(n,p,x);
  else if(state.distFn==='PDF') value=normalPdf(x,mu,sigma);
  else if(state.distFn==='CDF') value=normalCdf(Number(f.upper),mu,sigma)-normalCdf(Number(f.lower),mu,sigma);
  else value=invNormal(Number(f.area),mu,sigma);
  state.result=fmt(value); render();
}

function renderFields(){
  const wrap=$('distFields');wrap.innerHTML='';
  const add=(name,label)=>{ const el=document.createElement('label');el.textContent=label;const input=document.createElement('input');input.value=state.fields[name];input.inputMode='decimal';input.oninput=e=>state.fields[name]=e.target.value;el.appendChild(input);wrap.appendChild(el); };
  if(state.dist==='BINOMIAL'){ add('n','NumTrial');add('p','p');add('x','x'); }
  else { if(state.distFn==='PDF')add('x','x'); if(state.distFn==='CDF'){add('lower','Lower');add('upper','Upper');} if(state.distFn==='INV')add('area','Area');add('mu','μ');add('sigma','σ'); }
}

function render(){
  $('modeLabel').innerHTML = state.mode==='MAIN'?'MAIN&nbsp;&nbsp;1':'STAT&nbsp;&nbsp;DIST';
  $('angleLabel').textContent=state.angle;$('angleStatus').textContent=state.angle;$('angleToggle').textContent=state.angle;
  $('expression').textContent=state.expr||'0';$('answer').textContent=state.result;
  $('mainScreen').classList.toggle('hidden',state.mode!=='MAIN');$('statScreen').classList.toggle('hidden',state.mode!=='STAT');$('statPanel').classList.toggle('hidden',state.mode!=='STAT');
  $('statTitle').textContent=`STAT > DIST > ${state.dist}`;$('statResult').textContent=state.result;
  $('binmTab').classList.toggle('active',state.dist==='BINOMIAL');$('normTab').classList.toggle('active',state.dist==='NORMAL');
  $('pdfTab').classList.toggle('active',state.distFn==='PDF');$('cdfTab').classList.toggle('active',state.distFn==='CDF');$('invTab').classList.toggle('active',state.distFn==='INV');$('invTab').classList.toggle('hidden',state.dist!=='NORMAL');
  document.querySelector('[data-key="SHIFT"]').classList.toggle('pressed',state.shift);
  renderFields();
  $('history').innerHTML='';$('emptyHistory').classList.toggle('hidden',state.history.length>0);
  state.history.forEach(h=>{const li=document.createElement('li'),code=document.createElement('code'),strong=document.createElement('strong');code.textContent=h.expression;strong.textContent=h.result;li.append(code,strong);$('history').appendChild(li);});
}

function buildKeys(){
  const keypad=$('keypad');
  keyDefs.forEach(([label,type],i)=>{const b=document.createElement('button');b.className=`key key-${type}`;b.dataset.key=label;b.textContent=label;
    if(['sin','cos','tan','log','ln'].includes(label)){const sm=document.createElement('small');sm.textContent={sin:'sin⁻¹',cos:'cos⁻¹',tan:'tan⁻¹',log:'10ˣ',ln:'eˣ'}[label];b.appendChild(sm);} b.onclick=()=>press(label,type);keypad.appendChild(b);});
}

$('angleToggle').onclick=()=>{state.angle=state.angle==='DEG'?'RAD':'DEG';render();};
$('binmTab').onclick=()=>{state.dist='BINOMIAL';state.distFn='PDF';render();};
$('normTab').onclick=()=>{state.dist='NORMAL';state.distFn='PDF';render();};
$('pdfTab').onclick=()=>{state.distFn='PDF';render();};$('cdfTab').onclick=()=>{state.distFn='CDF';render();};$('invTab').onclick=()=>{state.distFn='INV';render();};
$('calcDist').onclick=calculateDistribution;

document.addEventListener('keydown',e=>{if(e.target.tagName==='INPUT')return;if(/[0-9.()+\-*/]/.test(e.key)&&e.key.length===1){state.expr+=e.key.replace('*','×').replace('/','÷');render();}else if(e.key==='Enter')runExpression();else if(e.key==='Backspace'){state.expr=state.expr.slice(0,-1);render();}else if(e.key==='Escape'){state.expr='';state.result='0';render();}});

buildKeys();render();
