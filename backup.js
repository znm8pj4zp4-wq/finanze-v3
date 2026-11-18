function backupDocument() {
  return {version:2,exportedAt:new Date().toISOString(),budget:state.budget,
    transactions:state.transactions.map(t=>({id:t.legacy_id||t.id,type:t.type,date:t.date,
      amount:t.amount,category:t.category,subcategory:t.subcategory,
      splits:t.splits.map(({category,subcategory,amount})=>({category,subcategory,amount})),
      note:t.note,account:t.account||'Non specificato'})),
    assets:state.assets.map(a=>({id:a.legacy_id||a.id,kind:a.kind,name:a.name,value:a.value}))};
}
function normalizeBackup(data) {
  if (data?.version!==2 || !Array.isArray(data.transactions) || !Array.isArray(data.assets))
    throw Error('Seleziona un backup JSON di Finanze v2.');
  function label(value,max,required=true) {
    if(typeof value!=='string' || (required && !value.trim()) || value.length>max)
      throw Error('Un campo del backup manca o supera la lunghezza prevista.');
    return value;
  }
  function amount(v) {
    if(typeof v!=='number'||!Number.isFinite(v)) throw Error('Importo non valido.');
    return cents(String(v));
  }
  function choices(v,allowed) {
    if(!allowed.includes(v)) throw Error('Tipo di movimento o voce patrimoniale non valido.');
    return v;
  }
  function id(v,seen) {
    label(v,250);
    if(seen.has(v)) throw Error('Identificativo duplicato nel file.');
    seen.add(v); return v;
  }
  const txids=new Set(), assetids=new Set();
  const transactions=data.transactions.map(t=>{
    if(!/^\d{4}-\d{2}-\d{2}$/.test(t.date) || !Number.isFinite(Date.parse(t.date)) || isoDay(Date.parse(t.date))!==t.date)
      throw Error('Data non valida nel backup.');
    if(t.splits!=null && !Array.isArray(t.splits)) throw Error('Quote non valide.');
    const parts=(t.splits?.length?t.splits:[t]).map(s=>({category:label(s.category,80),
      subcategory:label(s.subcategory??'',80,false),amount_cents:amount(s.amount)}));
    const value=amount(t.amount);
    if(!value || parts.length>50 || parts.some(s=>s.amount_cents<=0) || parts.reduce((a,s)=>a+s.amount_cents,0)!==value)
      throw Error('Le quote del movimento non coincidono con il totale.');
    return {id:id(t.id,txids),kind:choices(t.type,['income','expense']),date:t.date,
      cents:value,parts,note:label(t.note??'',140,false),account:label(t.account??'Non specificato',250,false)};
  });
  const assets=data.assets.map(a=>({id:id(a.id,assetids),kind:choices(a.kind,['asset','liability']),
    name:label(a.name,70),cents:amount(a.value)}));
  return {transactions,assets,budget:amount(data.budget)};
}
function backupControls() {
  return `<label class="fieldlabel" for="backupInput">Importa un backup v2</label>
    <input id="backupInput" class="field" type="file" accept=".json,application/json">
    <button id="demoBackup" type="button" class="secondary">Scarica un backup di esempio</button>
    <div id="backupPreview" aria-live="polite"></div>
    ${state.latestImport?`<button class="secondary" id="undoImport">Annulla l’ultima importazione</button>`:''}`;
}
function setupBackup() {
  const input=$('#backupInput'),preview=$('#backupPreview');
  $('#demoBackup').onclick=()=>{
    const sample={version:2,exportedAt:new Date().toISOString(),budget:0,assets:[],
      transactions:[{id:'finanze-demo-'+month,type:'expense',date:month+'-01',amount:85,
        category:'Spesa',subcategory:'Supermercato',account:'Esempio',note:'Spesa dimostrativa',
        splits:[{category:'Spesa',subcategory:'Supermercato',amount:60},{category:'Casa',subcategory:'Prodotti per la casa',amount:25}]}]};
    download(JSON.stringify(sample,null,2),'finanze-esempio.json','application/json');
  };
  input.onchange=async()=>{
    const file=input.files[0],view=state;
    preview.replaceChildren(); if (!file)return;
    try {
      const doc=normalizeBackup(JSON.parse(await file.text()));
      if(view!==state || input.files[0]!==file)return;
      const sumOf=(items,kind)=>items.filter(x=>x.kind===kind).reduce((s,x)=>s+x.cents,0)/100;
      preview.innerHTML=`<p>${doc.transactions.length} movimenti · Entrate ${fmt(sumOf(doc.transactions,'income'))} · Uscite ${fmt(sumOf(doc.transactions,'expense'))}</p>
      <p>${doc.assets.length} voci patrimoniali · Attività ${fmt(sumOf(doc.assets,'asset'))} · Passività ${fmt(sumOf(doc.assets,'liability'))} · Budget ${fmt(doc.budget/100)}</p>
      <button class="primary" type="button">Conferma importazione</button>`;
      preview.querySelector('button').onclick=()=>{
        if(!confirm('Aggiungere questi dati al tuo account? Verrà scaricata una copia dei dati attuali.'))return;
        download(JSON.stringify(backupDocument(),null,2),'finanze-prima-importazione-'+today()+'.json','application/json');
        submitChange(client=>client.rpc('finance_import_v2',{doc}));
      };
    } catch(error){ preview.textContent=error.message; }
  };
  const undo=$('#undoImport');
  if(undo)undo.onclick=()=>{
    if(!confirm('Rimuovere le voci aggiunte dall’ultima importazione e ripristinare il budget precedente?'))return;
    const batch=state.latestImport;
    submitChange(client=>client.rpc('finance_undo_import',{batch}));
  };
}
