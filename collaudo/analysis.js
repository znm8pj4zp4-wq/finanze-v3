let analysisRange=null;
function analysisPanel() {
  return `<details class="card settingcard" id="analysis"><summary>Analisi per periodo</summary>
    <form id="period"><label class="fieldlabel" for="rangeType">Confronta con il periodo precedente</label>
    <select class="field" id="rangeType"><option value="month">Mese</option><option value="year">Anno</option><option value="custom">Intervallo personalizzato</option></select>
    <label class="fieldlabel" for="fromDate">Dal</label><input class="field" type="date" id="fromDate" required>
    <label class="fieldlabel" for="toDate">Al</label><input class="field" type="date" id="toDate" required>
    <button class="primary">Applica</button></form><div id="analysisResult"></div></details>`;
}
function isoDay(ms) {return new Date(ms).toISOString().slice(0,10);}
function rangeFor(mode) {
  const [y,m]=month.split('-').map(Number);
  return mode==='year' ? [y+'-01-01',y+'-12-31'] : [month+'-01',isoDay(Date.UTC(y,m,0))];
}
function setupAnalysis() {
  const form=$('#period'); if (!form) return;
  const mode=$('#rangeType'),from=$('#fromDate'),to=$('#toDate');
  const preset=()=>{[from.value,to.value]=rangeFor(mode.value);};
  preset();
  if (analysisRange && analysisRange.month===month) {
    mode.value=analysisRange.mode;from.value=analysisRange.from;to.value=analysisRange.to;
    $('#analysis').open=true;
  }
  mode.onchange=()=>{if(mode.value!=='custom') preset();};
  from.oninput=to.oninput=()=>{mode.value='custom';};
  function show() {
    if (!from.value || !to.value || from.value>to.value) {alert('Controlla le date del periodo.');return;}
    const first=Date.parse(from.value),last=Date.parse(to.value),day=86400000;
    const year=Number(from.value.slice(0,4)),mo=Number(from.value.slice(5,7));
    const prevStart=mode.value==='year'?Date.UTC(year-1,0,1):mode.value==='month'?Date.UTC(year,mo-2,1):first-(last-first+day);
    const within=(a,b)=>state.transactions.filter(t=>t.date>=a && t.date<=b);
    const items=within(from.value,to.value),prev=within(isoDay(prevStart),isoDay(first-day));
    const curr=totals(items),prior=totals(prev),groups=new Map();
    for(const t of items.filter(t=>t.type==='expense')) for(const p of t.splits) {
      const g=groups.get(p.category)||{cents:0,ids:new Set(),subs:new Map()};
      const cents=Math.round(p.amount*100);
      g.cents+=cents;g.ids.add(t.id);
      const name=p.subcategory||'Senza sottocategoria';
      g.subs.set(name,(g.subs.get(name)||0)+cents);groups.set(p.category,g);
    }
    const ordered=[...groups].sort((a,b)=>b[1].cents-a[1].cents);
    const total=ordered.reduce((a,[,g])=>a+g.cents,0);
    let end=0;
    const stops=ordered.map(([,g],i)=>{const start=end;end+=100*g.cents/total;return colors[i%colors.length]+' '+start+'% '+end+'%';});
    const byDate=new Map();
    for(const t of items) byDate.set(t.date,(byDate.get(t.date)||0)+(t.type==='expense'?-1:1)*Math.round(t.amount*100));
    let balance=0;
    const points=[[first,0],...[...byDate].sort(([a],[b])=>a.localeCompare(b)).map(([d,n])=>[Date.parse(d),balance+=n]),[last,balance]];
    const values=points.map(p=>p[1]),min=values.reduce((a,b)=>Math.min(a,b),0),max=values.reduce((a,b)=>Math.max(a,b),0);
    const line=points.map(([d,n])=>[2+296*(d-first)/Math.max(day,last-first),68-64*(n-min)/Math.max(1,max-min)].join(',')).join(' ');
    const result=$('#analysisResult');
    result.innerHTML=`<p>Confronto con ${isoDay(prevStart)} – ${isoDay(first-day)}</p>
      <table><thead><tr><th></th><th>Periodo</th><th>Precedente</th></tr></thead><tbody>
      ${[['income','Entrate'],['expense','Uscite']].map(([k,n])=>`<tr><th>${n}</th><td>${fmt(curr[k])}</td><td>${fmt(prior[k])}</td></tr>`).join('')}</tbody></table>
      <h3>Saldo cumulato nel periodo</h3><svg viewBox="0 0 300 72" width="100%" role="img" aria-label="Saldo cumulato finale ${fmt(balance/100)}"><polyline points="${line}" fill="none" stroke="#159b84" stroke-width="2"/></svg>
      <p>Minimo ${fmt(min/100)} · Massimo ${fmt(max/100)}</p><h3>Spese per categoria</h3>
      ${total?`<div role="img" aria-label="Ripartizione delle uscite" style="margin:auto;width:9rem;height:9rem;border-radius:50%;background:conic-gradient(${stops.join(',')});mask-image:radial-gradient(circle,transparent 46%,black 47%)"></div>`:empty('','Nessuna spesa nel periodo.')}
      ${ordered.map(([name,g],i)=>`<button class="secondary" data-group="${i}" style="width:100%;margin-top:.5rem;border-left:5px solid ${colors[i%colors.length]}">${safe(name)} · ${fmt(g.cents/100)} · ${Math.round(g.cents/total*100)}%</button>`).join('')}
      <section id="groupDetail" aria-live="polite"></section>`;
    result.onclick=e=>{
      const btn=e.target.closest('[data-group]');if(!btn)return;
      const [name,g]=ordered[Number(btn.dataset.group)];
      $('#groupDetail').innerHTML=`<h3>${safe(name)}</h3>${[...g.subs].map(([s,v])=>`<p>${safe(s)} · ${fmt(v/100)}</p>`).join('')}<h3>Movimenti associati</h3>${sortedTx(items.filter(t=>g.ids.has(t.id))).map(txView).join('')}`;
    };
  }
  form.onsubmit=e=>{e.preventDefault();analysisRange={month,mode:mode.value,from:from.value,to:to.value};show();};
  $('#analysis').ontoggle=e=>{if(e.target.open)show();};
}
