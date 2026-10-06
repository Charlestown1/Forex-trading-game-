"use strict";
/* ===== Constants & state ===== */
const $=id=>document.getElementById(id),PIP=1e-4,KEY="fxsim_v1";
const DIFF={easy:{v:.6,f:0,hold:45},normal:{v:1,f:.01,hold:30},hard:{v:1.6,f:.04,hold:20}};
const REG={sbear:{d:-3e-5,l:"🔴 STRONG BEARISH TREND"},bear:{d:-1.2e-5,l:"🔴 BEARISH"},range:{d:0,l:"⚪ RANGING"},bull:{d:1.2e-5,l:"🟢 BULLISH"},sbull:{d:3e-5,l:"🟢 STRONG BULLISH TREND"}};
const NEWS=["UK CPI","UK GDP","FOMC Interest Rate Decision","US Non-Farm Payrolls","BoE Rate Decision","UK Retail Sales"];
let S,rt; // S = saved state, rt = runtime-only state
const fresh=()=>({bal:1000,price:1.35,trades:[],hist:[],nid:1,diff:S?S.diff:"normal",sound:S?S.sound:true,candles:[],clock:0,running:true});
const money=v=>(v<0?"-":"")+"$"+Math.abs(v).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const sgn=v=>(v>0?"+":"")+money(v),f5=v=>v.toFixed(5);
const dur=s=>{s=Math.max(0,Math.round(s));return Math.floor(s/60)+"m "+String(s%60).padStart(2,"0")+"s"};
const spread=()=>(rt.newsEnd>S.clock?3:1.2)*PIP,bid=()=>S.price,ask=()=>S.price+spread();

/* ===== Sound & toasts ===== */
let ac;function beep(f,d=.08,ty="sine"){if(!S.sound)return;try{ac=ac||new AudioContext();const o=ac.createOscillator(),g=ac.createGain();o.type=ty;o.frequency.value=f;g.gain.value=.04;o.connect(g);g.connect(ac.destination);o.start();g.gain.exponentialRampToValueAtTime(1e-4,ac.currentTime+d);o.stop(ac.currentTime+d)}catch(e){}}
function toast(msg,snd){const d=document.createElement("div");d.className="toast";d.textContent=msg;$("toasts").appendChild(d);setTimeout(()=>d.remove(),2800);if(snd)beep(snd)}

/* ===== Game lifecycle ===== */
function initializeGame(){
 loadGame();rt={regime:"range",mom:0,tickN:0,cur:null,newsEnd:0,spike:0,next:null,log:[],blown:false,zoom:70,mx:null,my:null};
 if(!S.candles.length)seedCandles();else rt.cur=null;
 scheduleNews();$("diff").value=S.diff;$("lots").value="0.10";
 updateStatistics();render();drawChart();
 setInterval(tick,400);setInterval(saveGame,3000);window.addEventListener("beforeunload",saveGame);
}
function seedCandles(){let p=S.price;for(let i=0;i<80;i++){const o=p,n=[];for(let k=0;k<5;k++){p=Math.min(1.4,Math.max(1.3,p+(Math.random()-.5)*5e-4+(1.35-p)*.002));n.push(p)}
 S.candles.push({o,h:Math.max(o,...n),l:Math.min(o,...n),c:p,t:Date.now()-(80-i)*2000})}S.price=p}
function saveGame(){try{localStorage.setItem(KEY,JSON.stringify({...S,candles:S.candles.slice(-150)}))}catch(e){}}
function loadGame(){S=null;try{const d=JSON.parse(localStorage.getItem(KEY));if(d&&isFinite(d.bal)&&isFinite(d.price)&&Array.isArray(d.trades)&&Array.isArray(d.hist)&&Array.isArray(d.candles))S={...fresh.call(null),...d}}catch(e){}
 if(!S){S=null;S=fresh()}}
function resetGame(){if(!confirm("Reset the game? Balance returns to $1,000 and all trades and history are erased."))return;hardReset()}
function hardReset(){localStorage.removeItem(KEY);S=fresh();rt.cur=null;rt.blown=false;rt.newsEnd=0;rt.log=[];seedCandles();scheduleNews();$("blown").style.display="none";updateStatistics();render();drawChart();saveGame();toast("Game reset")}

/* ===== Price engine ===== */
function generatePrice(){
 const d=DIFF[S.diff],news=rt.newsEnd>S.clock;
 let vol=(1.2e-4+Math.random()*1.2e-4)*d.v;
 let step=REG[rt.regime].d*d.v+.6*rt.mom+(1.35-S.price)*.002;           // trend + momentum + mean reversion
 let noise=(Math.random()+Math.random()+Math.random()-1.5)*2*vol;
 if(Math.random()<.012){noise+=(Math.random()<.5?-1:1)*vol*6;rt.spike=S.clock+4}  // volatility spike
 if(Math.random()<d.f*.15)rt.mom=-rt.mom*3;                              // fakeout (hard mode)
 if(news){const a=rt.next.amt*.5;noise+=(Math.random()-.5)*2*a;step+=rt.next.dir*rt.next.amt*.25}
 step+=noise;rt.mom=.8*rt.mom+.2*step;
 S.price=Math.min(1.42,Math.max(1.28,S.price+step));
}
function generateCandle(){ // aggregate ticks into OHLC candles (5 ticks = 1 candle ≈ 2s)
 if(!rt.cur){rt.cur={o:S.price,h:S.price,l:S.price,c:S.price,t:Date.now()};S.candles.push(rt.cur);rt.tickN=0}
 const c=rt.cur;c.c=S.price;c.h=Math.max(c.h,S.price);c.l=Math.min(c.l,S.price);
 if(++rt.tickN>=5){rt.cur=null;if(S.candles.length>400)S.candles.shift();
  if(--rt.hold<=0||rt.hold!==rt.hold){const k=Object.keys(REG),w=S.diff==="easy"?[2,2,1,2,2]:[1,2,2,2,1];let x=Math.random()*8,i=0;while((x-=w[i])>0&&i<4)i++;rt.regime=k[i];rt.hold=DIFF[S.diff].hold*(.6+Math.random())}}
}
function tick(){
 if(!S.running||rt.blown)return;
 S.clock+=.4;handleNews();generatePrice();generateCandle();checkTrades();render();drawChart();
}

/* ===== News ===== */
function scheduleNews(){rt.next={name:NEWS[Math.floor(Math.random()*NEWS.length)],at:S.clock+45+Math.random()*45,dir:[-1,0,1][Math.floor(Math.random()*3)],amt:5e-4+Math.random()*15e-4,warned:false,fired:false}}
function generateNews(){const n=rt.next;n.fired=true;rt.newsEnd=S.clock+6;
 const t=n.dir>0?"🟢 BULLISH NEWS":n.dir<0?"🔴 BEARISH NEWS":"⚪ NEUTRAL NEWS";
 rt.log.unshift(`${t}: ${n.name}`);rt.log=rt.log.slice(0,6);toast(`HIGH IMPACT NEWS: ${n.name} ${t}`,330)}
function handleNews(){const n=rt.next;
 if(!n.warned&&S.clock>=n.at-30){n.warned=true;toast("HIGH IMPACT NEWS IN 30 SECONDS: "+n.name,440)}
 if(!n.fired&&S.clock>=n.at)generateNews();
 if(n.fired&&S.clock>=rt.newsEnd)scheduleNews()}

/* ===== Trading ===== */
function calculatePnL(t,exit){const pips=(t.dir==="BUY"?exit-t.entry:t.entry-exit)/PIP;return Math.round(pips*t.lots*10*100)/100}
const exitPx=t=>t.dir==="BUY"?bid():ask();
const floating=()=>S.trades.reduce((s,t)=>s+calculatePnL(t,exitPx(t)),0);
const usedMargin=()=>S.trades.reduce((s,t)=>s+t.lots*1e5*t.entry/100,0);
function readOrder(){const lots=parseFloat($("lots").value),sl=parseFloat($("sl").value),tp=parseFloat($("tp").value);
 if(!(lots>0)){toast("Lot size must be greater than 0",200);return null}
 if(lots>50){toast("Lot size too large",200);return null}
 if($("sl").value!==""&&!(sl>0)||$("tp").value!==""&&!(tp>0)){toast("SL/TP must be positive pips",200);return null}
 return{lots:Math.round(lots*100)/100,sl:sl>0?sl:null,tp:tp>0?tp:null}}
function openTrade(dir){
 if(rt.blown)return;if(!S.running){toast("Market is paused — start it to trade",200);return}
 const o=readOrder();if(!o)return;const entry=dir==="BUY"?ask():bid(),m=o.lots*1e5*entry/100;
 if(m>equity()-usedMargin()){toast("INSUFFICIENT MARGIN",200);return}
 const k=dir==="BUY"?1:-1;
 S.trades.push({id:S.nid++,dir,lots:o.lots,entry,sl:o.sl?entry-k*o.sl*PIP:null,tp:o.tp?entry+k*o.tp*PIP:null,t0:S.clock});
 toast(`${dir} ORDER OPENED @ ${f5(entry)}`,660);saveGame();render()}
const executeBuy=()=>openTrade("BUY"),executeSell=()=>openTrade("SELL");
function checkStopLoss(t){if(t.sl===null)return false;return t.dir==="BUY"?bid()<=t.sl:ask()>=t.sl}
function checkTakeProfit(t){if(t.tp===null)return false;return t.dir==="BUY"?bid()>=t.tp:ask()<=t.tp}
function checkTrades(){[...S.trades].forEach(t=>{ // SL checked first (conservative)
 if(checkStopLoss(t))closeTrade(t.id,"STOP LOSS",t.sl);else if(checkTakeProfit(t))closeTrade(t.id,"TAKE PROFIT",t.tp)});
 if(S.trades.length&&equity()<=0){[...S.trades].forEach(t=>closeTrade(t.id,"STOP OUT"))}
 if(!S.trades.length&&S.bal<=0.005){S.bal=0;rt.blown=true;$("blown").style.display="grid"}}
function closeTrade(id,reason,px){
 const i=S.trades.findIndex(t=>t.id===id);if(i<0)return;const t=S.trades[i];
 const exit=px!==undefined?px:exitPx(t),pl=calculatePnL(t,exit);
 S.trades.splice(i,1);S.bal=Math.max(0,Math.round((S.bal+pl)*100)/100);
 S.hist.push({id:t.id,dir:t.dir,lots:t.lots,entry:t.entry,exit,pl,reason,dur:S.clock-t.t0});
 toast(reason==="TAKE PROFIT"?`TAKE PROFIT HIT ${sgn(pl)}`:reason==="STOP LOSS"?`STOP LOSS HIT ${sgn(pl)}`:`${reason}: ${sgn(pl)}`,reason==="TAKE PROFIT"?880:reason==="STOP LOSS"?180:520);
 updateStatistics();saveGame()}
const equity=()=>S.bal+floating();

/* ===== UI ===== */
function updateAccount(){const fl=floating(),eq=S.bal+fl,um=usedMargin();
 $("hp").textContent=f5(S.price);$("hb").textContent=money(S.bal);$("he").textContent=money(eq);
 $("hf").textContent=sgn(fl);$("hf").className=fl>0?"g":fl<0?"r":"";$("hm").textContent=money(Math.max(0,eq-um));
 $("um").textContent=money(um);$("bid").textContent=f5(bid());$("ask").textContent=f5(ask());
 $("spr").textContent=(spread()/PIP).toFixed(1)+" pips";$("pv").textContent=money(parseFloat($("lots").value)>0?$("lots").value*10:0);
 $("mkt").textContent=S.running?"MARKET OPEN":"MARKET PAUSED";$("mkt").style.color=S.running?"var(--g)":"var(--r)";
 $("run").textContent=S.running?"PAUSE MARKET":"START MARKET";$("snd").textContent=S.sound?"🔊 Sound ON":"🔇 Sound OFF";
 $("cond").textContent=(rt.newsEnd>S.clock||rt.spike>S.clock)?"⚡ HIGH VOLATILITY":REG[rt.regime].l}
function render(){updateAccount();
 $("pos").innerHTML=S.trades.length?S.trades.map(t=>{const p=calculatePnL(t,exitPx(t));
  return `<tr><td>GBP/USD</td><td class="${t.dir==="BUY"?"g":"r"}">${t.dir}</td><td>${t.lots.toFixed(2)}</td><td>${f5(t.entry)}</td><td>${f5(exitPx(t))}</td><td>${t.sl?f5(t.sl):"-"}</td><td>${t.tp?f5(t.tp):"-"}</td><td>${dur(S.clock-t.t0)}</td><td class="${p>=0?"g":"r"}">${sgn(p)}</td><td><button class="btn" data-close="${t.id}">Close</button></td></tr>`}).join(""):`<tr><td colspan="10">No open positions. Choose lots, SL and TP, then tap BUY or SELL.</td></tr>`;
 const n=rt.next;$("nextNews").textContent=n.fired?"⚡ "+n.name+" is moving the market":`Next: ${n.name} in ${dur(n.at-S.clock)}`;
 $("newsLog").innerHTML=rt.log.map(x=>`<div>${x}</div>`).join("")}
function updateStatistics(){const h=S.hist,w=h.filter(x=>x.pl>0),l=h.filter(x=>x.pl<0),sum=a=>a.reduce((s,x)=>s+x.pl,0),pls=h.map(x=>x.pl);
 const net=sum(h),cells=[["Balance",money(S.bal)],["Equity",money(equity())],["Total trades",h.length],["Winning",w.length],["Losing",l.length],["Win rate",h.length?Math.round(w.length/h.length*100)+"%":"0%"],["Total profit",sgn(sum(w))],["Total loss",sgn(sum(l))],["Net P/L",sgn(net)],["Best trade",h.length?sgn(Math.max(...pls)):"$0.00"],["Worst trade",h.length?sgn(Math.min(...pls)):"$0.00"]];
 $("stats").innerHTML=cells.map(c=>`<div class="st"><span>${c[0]}</span><b>${c[1]}</b></div>`).join("");
 $("hist").innerHTML=h.length?[...h].reverse().slice(0,50).map(x=>`<tr><td>#${x.id}</td><td class="${x.dir==="BUY"?"g":"r"}">${x.dir}</td><td>${x.lots.toFixed(2)}</td><td>${f5(x.entry)}</td><td>${f5(x.exit)}</td><td class="${x.pl>=0?"g":"r"}">${sgn(x.pl)}</td><td>${x.reason}</td><td>${dur(x.dur)}</td></tr>`).join(""):`<tr><td colspan="8">No closed trades yet.</td></tr>`}
function updateRisk(){const b=+$("rb").value,p=+$("rp").value,s=+$("rs").value,amt=b*p/100;
 $("ra").textContent=money(amt>0?amt:0);$("rm").textContent=money(amt>0?amt:0);
 $("rl").textContent=(b>0&&p>0&&s>0)?(Math.floor(amt/(s*10)*100)/100).toFixed(2)+" lots":"enter valid values"}

/* ===== Chart (canvas candlesticks) ===== */
function updateChart(){drawChart()}
function drawChart(){
 const cv=$("cv"),dpr=window.devicePixelRatio||1,W=cv.clientWidth,H=cv.clientHeight;if(!W||!H)return;
 if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr)}
 const x=cv.getContext("2d");x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);
 const R=58,B=20,pw=W-R,ph=H-B,n=Math.min(rt.zoom,S.candles.length),cs=S.candles.slice(-n);if(!cs.length)return;
 let hi=Math.max(...cs.map(c=>c.h),ask()),lo=Math.min(...cs.map(c=>c.l),bid());const pad=(hi-lo)*.1||PIP*5;hi+=pad;lo-=pad;
 const Y=p=>ph-(p-lo)/(hi-lo)*ph,cw=pw/rt.zoom;
 x.font="11px system-ui";x.fillStyle="#8b93a3";x.strokeStyle="#242933";x.lineWidth=1;
 for(let i=0;i<=5;i++){const p=lo+(hi-lo)*i/5,y=Y(p);x.beginPath();x.moveTo(0,y);x.lineTo(pw,y);x.stroke();x.fillText(f5(p),pw+4,y+4)}
 cs.forEach((c,i)=>{const cx=pw-(cs.length-i)*cw+cw/2,up=c.c>=c.o,col=up?"#22c07a":"#ef4b5b";
  x.strokeStyle=col;x.fillStyle=col;x.beginPath();x.moveTo(cx,Y(c.h));x.lineTo(cx,Y(c.l));x.stroke();
  x.fillRect(cx-Math.max(1,cw*.35),Math.min(Y(c.o),Y(c.c)),Math.max(2,cw*.7),Math.max(1,Math.abs(Y(c.o)-Y(c.c))));
  if(i%Math.ceil(70/cw)===0){x.fillStyle="#8b93a3";x.fillText(new Date(c.t).toLocaleTimeString([],{minute:"2-digit",second:"2-digit"}),cx-14,H-5)}});
 S.trades.forEach(t=>{[["entry","#f0b429"],["sl","#ef4b5b"],["tp","#22c07a"]].forEach(([k,col])=>{if(t[k]===null)return;x.strokeStyle=col;x.setLineDash([2,4]);x.beginPath();x.moveTo(0,Y(t[k]));x.lineTo(pw,Y(t[k]));x.stroke();x.setLineDash([])})});
 const cy=Y(S.price);x.strokeStyle="#f0b429";x.setLineDash([5,4]);x.beginPath();x.moveTo(0,cy);x.lineTo(pw,cy);x.stroke();x.setLineDash([]);
 x.fillStyle="#f0b429";x.fillRect(pw,cy-9,R,18);x.fillStyle="#000";x.fillText(f5(S.price),pw+4,cy+4);
 if(rt.mx!==null&&rt.mx<pw&&rt.my<ph){x.strokeStyle="#8b93a399";x.setLineDash([3,3]);x.beginPath();x.moveTo(rt.mx,0);x.lineTo(rt.mx,ph);x.moveTo(0,rt.my);x.lineTo(pw,rt.my);x.stroke();x.setLineDash([]);
  x.fillStyle="#2b303a";x.fillRect(pw,rt.my-9,R,18);x.fillStyle="#fff";x.fillText(f5(lo+(ph-rt.my)/ph*(hi-lo)),pw+4,rt.my+4)}
}

/* ===== Events ===== */
$("buy").onclick=executeBuy;$("sell").onclick=executeSell;
$("pos").onclick=e=>{const id=e.target.dataset.close;if(id){closeTrade(+id,"MANUAL CLOSE");render()}};
$("run").onclick=()=>{S.running=!S.running;saveGame();render()};
$("snd").onclick=()=>{S.sound=!S.sound;saveGame();render();beep(600)};
$("diff").onchange=e=>{S.diff=e.target.value;saveGame();toast("Difficulty: "+S.diff.toUpperCase())};
$("zi").onclick=()=>{rt.zoom=Math.max(20,rt.zoom-10);drawChart()};$("zo").onclick=()=>{rt.zoom=Math.min(150,rt.zoom+10);drawChart()};
$("reset").onclick=resetGame;$("restart").onclick=hardReset;
$("lots").oninput=updateAccount;["rb","rp","rs"].forEach(i=>$(i).oninput=updateRisk);
["lots"].forEach(()=>{});
[0.01,0.02,0.05,0.10,0.50,1.00].forEach(v=>{const b=document.createElement("button");b.className="btn";b.textContent=v.toFixed(2);b.onclick=()=>{$("lots").value=v.toFixed(2);updateAccount()};$("chips").appendChild(b)});
const cv=$("cv");["pointermove","pointerdown"].forEach(ev=>cv.addEventListener(ev,e=>{const r=cv.getBoundingClientRect();rt.mx=e.clientX-r.left;rt.my=e.clientY-r.top;drawChart()}));
cv.addEventListener("pointerleave",()=>{rt.mx=null;drawChart()});
window.addEventListener("resize",drawChart);
document.addEventListener("click",e=>{if(e.target.closest(".btn,.big"))beep(500,.04)});
initializeGame();updateRisk();
