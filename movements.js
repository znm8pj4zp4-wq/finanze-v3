const taxonomy={Casa:['Affitto','Bollette','Condominio','Arredamento','Manutenzione','Prodotti per la casa','Altro'],Spesa:['Supermercato','Alimentari','Prodotti per la casa','Altro'],Trasporti:['Carburante','Assicurazione','Bollo','Tagliandi','Riparazioni','Pedaggi','Parcheggi','Accessori','Altro'],Ristoranti:['Ristoranti','Bar e caffè','Delivery','Pasti al lavoro','Altro'],Viaggi:['Voli','Alloggi','Noleggi','Ristorazione','Escursioni','Immersioni','Trasporti locali','Altro'],Shopping:['Abbigliamento','Elettronica','Fotografia','Hobby','Regali','Varie','Altro'],Salute:['Farmacia','Visite','Fisioterapia','Sport','Cura personale','Altro'],Abbonamenti:['Telefonia e internet','Streaming','App','Carte e servizi','Altro'],Tasse:['Imposte','Commissioni','Altro'],Altro:['Varie','Imprevisti']};
const categories={expense:Object.keys(taxonomy),income:['Stipendio','Extra','Rimborsi','Interessi','Regali','Altro']};
function splitLine(part={}) {
  const row=document.createElement('div');
  row.className='splitrow';
  row.innerHTML='<select class="field splitcat" aria-label="Categoria quota"></select><select class="field splitsub" aria-label="Sottocategoria quota"></select><div class="between"><input class="field splitamount" aria-label="Importo quota" inputmode="decimal" placeholder="Importo €"><button type="button" class="danger splitremove" aria-label="Rimuovi quota">×</button></div>';
  $('#splitRows').append(row);
  setupCategoryPair(row.querySelector('.splitcat'),row.querySelector('.splitsub'),'expense',part);
  row.querySelector('.splitamount').value=part.amount ?? '';
  row.querySelector('.splitamount').oninput=splitBalance;
  row.querySelector('.splitremove').onclick=()=>{row.remove();splitBalance();};
  splitBalance();
}
function splitBalance(){const a=num($('#txamount').value||0),v=[...document.querySelectorAll('.splitamount')].reduce((n,x)=>n+(Number.isFinite(num(x.value||0))?Math.round(num(x.value||0)*100):0),0);$('#splitBalance').textContent=$('#splitToggle').checked?`Totale quote: ${fmt(v/100)} / ${fmt(a)} · Differenza: ${fmt((Math.round(a*100)-v)/100)}`:''}
function toggleSplit(){const active=$('#splitToggle').checked&&$('#txForm').elements.type.value==='expense';$('#splitRows').style.display=active?'block':'none';$('#addSplit').style.display=active?'block':'none';$('#splitArea').style.display=$('#txForm').elements.type.value==='expense'?'block':'none';$('#txsubcategory').style.display=active?'none':'block';if(active&&!$('#splitRows').children.length){splitLine({...readCategoryPair($('#txcategory'),$('#txsubcategory')),amount:$('#txamount').value});splitLine()}splitBalance()}

function setType(type,selected){$('#txForm').elements.type.value=type;document.querySelectorAll('.segment').forEach(b=>b.classList.toggle('active',b.dataset.type===type));setupCategoryPair($('#txcategory'),$('#txsubcategory'),type,selected);toggleSplit()}
function txOpen(id){const f=$('#txForm');f.reset();const t=state.transactions.find(x=>x.id===id);$('#txDialogTitle').textContent=t?'Modifica movimento':'Nuovo movimento';f.elements.txid.value=t?.id||ident();setType(t?.type||'expense',t?.splits?.[0]);f.elements.amount.value=t?String(t.amount).replace('.',','):'';f.elements.date.value=t?.date||today();$('#splitRows').innerHTML='';$('#splitToggle').checked=!!(t?.splits?.length>1);if ($('#splitToggle').checked) t.splits.forEach(splitLine);toggleSplit();f.elements.note.value=t?.note||'';$('#txDeleteBox').style.display=t?'flex':'none';$('#txDialog').showModal()}
function assetOpen(id){const f=$('#assetForm');f.reset();const a=state.assets.find(x=>x.id===id);$('#assetDialogTitle').textContent=a?'Modifica voce':'Nuova voce patrimoniale';f.elements.assetid.value=a?.id||ident();f.elements.name.value=a?.name||'';f.elements.value.value=a?String(a.value).replace('.',','):'';f.elements.kind.value=a?.kind||'asset';$('#assetDeleteBox').style.display=a?'flex':'none';$('#assetDialog').showModal()}

function cents(input) {
  const value = String(input).trim();
  const match = /^(\d+)(?:[,.](\d{1,2}))?$/.exec(value);
  if (!match) throw Error('Inserisci un importo con al massimo due decimali.');
  const result = Number(match[1] + (match[2] || '').padEnd(2, '0'));
  if (!Number.isSafeInteger(result) || result > 100000000000000)
    throw Error('Importo troppo elevato.');
  return result;
}

function transactionPayload(form) {
  const f = form.elements;
  const total = cents(f.amount.value);
  const old = state.transactions.find(t => t.id === f.txid.value);
  const split = f.type.value === 'expense' && $('#splitToggle').checked;
  const parts = split ? [...document.querySelectorAll('.splitrow')].map(row => ({
    amount_cents: cents(row.querySelector('.splitamount').value),
    ...readCategoryPair(row.querySelector('.splitcat'),row.querySelector('.splitsub'))
  })) : [{amount_cents: total, ...readCategoryPair(f.category,f.subcategory)}];
  if (total <= 0 || parts.length > 50 || (split && parts.length < 2) ||
      parts.some(p => !p.category || p.amount_cents <= 0) ||
      parts.reduce((sum,p) => sum + p.amount_cents, 0) !== total)
    throw Error('Le quote devono essere positive e sommare esattamente al totale. Per dividere una spesa inserisci da 2 a 50 quote.');
  return {p_id: f.txid.value, p_amount_cents: total, p_kind: f.type.value,
    p_description: f.note.value.trim(), p_transaction_date: f.date.value,
    p_allocations: parts, p_expected_version: old?.version ?? null};
}

function editItem(target) {
  const row = target.closest('[data-edit-tx],[data-edit-asset]');
  if (row?.dataset.editTx) txOpen(row.dataset.editTx);
  else if (row?.dataset.editAsset) assetOpen(row.dataset.editAsset);
}
$('#app').addEventListener('click', e => editItem(e.target));
$('#app').addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-edit-tx],[data-edit-asset]')) {
    e.preventDefault();
    editItem(e.target);
  }
});
$('#addFab').onclick = () => tab === 'wealth' ? assetOpen() : txOpen();
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());
document.querySelectorAll('.segment').forEach(b => b.onclick = () => setType(b.dataset.type));

$('#splitToggle').onchange = toggleSplit;
$('#addSplit').onclick = () => splitLine();
$('#txamount').oninput = splitBalance;

let saving = false;
document.querySelectorAll('dialog').forEach(d => d.addEventListener('cancel', e => {
  if (saving) e.preventDefault();
}));
async function submitChange(change, date) {
  if (saving || !state) return;
  saving = true;
  const view = state;
  const controls = [...document.querySelectorAll('#workspace button:not(:disabled), dialog input:not(:disabled), dialog select:not(:disabled)')];
  controls.forEach(el => el.disabled = true);
  try {
    await window.financeWrite(change);
    if (state !== view) return;
    if (date) month = date.slice(0,7);
    controls.forEach(el => el.disabled = false);
    await window.refreshAfterSave();
  } catch (error) {
    if (state === view) alert(error.message || 'Salvataggio non confermato. Verifica la connessione e riprova.');
  } finally {
    controls.forEach(el => el.disabled = false);
    saving = false;
  }
}
$('#txForm').onsubmit = e => {
  e.preventDefault();
  try {
    const payload = transactionPayload(e.target);
    submitChange(client => client.rpc('finance_save_transaction_versioned',payload), payload.p_transaction_date);
  } catch (error) { alert(error.message); }
};
function deleteRow(table, row, version) {
  if (!row || !confirm('Confermi l’eliminazione di questa voce?')) return;
  submitChange((client,owner) => client.from(table).delete()
    .eq('user_id',owner).eq('id',row.id).eq('updated_at',version).select('id').maybeSingle());
}
$('#txDelete').onclick = () => {
  const row = state.transactions.find(t => t.id === $('#txForm').elements.txid.value);
  deleteRow('finance_transactions',row,row?.version);
};
$('#assetDelete').onclick = () => {
  const row = state.assets.find(a => a.id === $('#assetForm').elements.assetid.value);
  deleteRow('finance_assets',row,row?.updated_at);
};
$('#assetForm').onsubmit = e => {
  e.preventDefault();
  const f = e.target.elements;
  try {
    const item = {id:f.assetid.value, name:f.name.value.trim(), kind:f.kind.value, value_cents:cents(f.value.value)};
    if (!item.name) throw Error('Inserisci un nome.');
    const old = state.assets.find(a => a.id === item.id);
    submitChange((client,owner) => {
      const table = client.from('finance_assets');
      const query = old ? table.update({...item,updated_at:new Date().toISOString()})
        .eq('id',item.id).eq('user_id',owner).eq('updated_at',old.updated_at) :
        table.insert({...item,user_id:owner});
      return query.select('id').maybeSingle();
    });
  } catch (error) { alert(error.message); }
};
$('#app').addEventListener('submit',e => {
  if (!['budgetForm','themeForm'].includes(e.target.id)) return;
  e.preventDefault();
  try {
    const values = e.target.id === 'budgetForm' ? {monthly_budget_cents:cents($('#budget').value)} : {theme:$('#themeChoice').value};
    const old = state.settings;
    submitChange((client,owner) => {
      const table = client.from('finance_settings');
      const change = old ? table.update({...values,updated_at:new Date().toISOString()})
        .eq('user_id',owner).eq('updated_at',old.updated_at) : table.insert({user_id:owner,...values});
      return change.select('user_id').maybeSingle();
    });
  } catch (error) { alert(error.message); }
});
