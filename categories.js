// The v2 taxonomy is used only to create the first set of rows for an account.
async function defaultCategoryRows(owner) {
  const records = [];
  async function add(kind, name, parent, order) {
    const key = JSON.stringify([owner,kind,parent,name]);
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key))).slice(0,16);
    bytes[6] = (bytes[6] & 15) | 128;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes,b => b.toString(16).padStart(2,'0')).join('');
    const id = hex.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/,'$1-$2-$3-$4-$5');
    records.push({id,user_id:owner,kind,name,parent_id:parent,sort_order:order,archived:false});
    return id;
  }
  for (const [kind,names] of Object.entries(categories)) {
    for (const [i,name] of names.entries()) {
      const root = await add(kind,name,null,i+1);
      if (kind === 'expense') {
        for (const [j,sub] of taxonomy[name].entries()) await add(kind,sub,root,j+1);
      }
    }
  }
  return records;
}

function orderedCategories(items) {
  return [...items].sort((a,b) => a.sort_order-b.sort_order || a.name.localeCompare(b.name,'it') || a.id.localeCompare(b.id));
}
function categoryChildren(kind,parent) {
  return orderedCategories(state.catalog.filter(c=>c.kind===kind && c.parent_id===parent && !c.archived));
}
function catalogSelect(el,rows,value,placeholder) {
  el.replaceChildren();
  if (placeholder) el.add(new Option(placeholder,''));
  for (const row of rows) el.add(new Option(row.name,row.id));
  if (value && [...el.options].some(o=>o.value===value)) el.value=value;
}
function setupCategoryPair(root,child,kind,part) {
  const oldId=part?.category_id;
  const linked=state.catalog.find(c=>c.id===oldId && c.kind===kind);
  const parent=linked?.parent_id ? state.catalog.find(c=>c.id===linked.parent_id) : linked;
  const roots=categoryChildren(kind,null);
  if (parent && !roots.some(r=>r.id===parent.id)) roots.push(parent);
  const matched=parent || roots.find(r=>r.name===part?.category);
  catalogSelect(root,roots,matched?.id);
  if (part?.category && !matched) {
    root.add(new Option(part.category,'legacy'));
    root.value='legacy';
  }
  function chooseChild(initial) {
    const children=categoryChildren(kind,root.value);
    if (initial && linked?.parent_id && !children.some(c=>c.id===linked.id)) children.push(linked);
    const selected=initial && (linked?.parent_id ? linked.id : children.find(r=>r.name===part?.subcategory)?.id);
    catalogSelect(child,children,selected,'Nessuna sottocategoria');
    if (initial && part?.subcategory && !selected) {
      child.add(new Option(part.subcategory,'legacy'));
      child.value='legacy';
    }
  }
  chooseChild(true);
  root.onchange=()=>chooseChild(false);
}
function readCategoryPair(root,child) {
  const category=root.selectedOptions[0]?.text || '';
  const subcategory=child.value ? child.selectedOptions[0].text : '';
  const id=child.value || root.value;
  return {category,subcategory,category_id:id==='legacy' ? null : id || null};
}

function categorySettings() {
  return `<details class="card settingcard"><summary>Categorie e sottocategorie</summary>
    <form id="categoryForm">
    <label class="fieldlabel" for="catKind">Tipo di movimento</label>
    <select class="field" id="catKind"><option value="expense">Uscita</option><option value="income">Entrata</option></select>
    <label class="fieldlabel" for="catParent">Gruppo</label><select class="field" id="catParent"></select>
    <label class="fieldlabel" for="catEdit">Categoria da modificare</label><select class="field" id="catEdit"></select>
    <label class="fieldlabel" for="catName">Nome</label><input class="field" id="catName" required maxlength="80">
    <label class="fieldlabel" for="catOrder">Ordine di visualizzazione</label><input class="field" id="catOrder" type="number" min="0" max="999999" required>
    <label><input type="checkbox" id="catArchived"> Archiviata</label>
    <button class="primary">Salva categoria</button></form></details>`;
}
function setupCategorySettings() {
  const form=$('#categoryForm');
  if (!form) return;
  function fillFields() {
    const row=state.catalog.find(c=>c.id===$('#catEdit').value);
    $('#catName').value=row?.name || '';
    const siblings=state.catalog.filter(c=>c.kind===$('#catKind').value && c.parent_id===($('#catParent').value||null));
    $('#catOrder').value=row?.sort_order ?? (Math.max(0,...siblings.map(c=>c.sort_order))+1);
    $('#catArchived').checked=!!row?.archived;
  }
  function listSiblings() {
    const kind=$('#catKind').value, parent=$('#catParent').value || null;
    const rows=orderedCategories(state.catalog.filter(c=>c.kind===kind && c.parent_id===parent));
    catalogSelect($('#catEdit'),rows.map(r=>({...r,name:r.name+(r.archived?' (archiviata)':'')})),null,'Crea nuova');
    fillFields();
  }
  function listParents() {
    catalogSelect($('#catParent'),categoryChildren($('#catKind').value,null),null,'Categorie principali');
    listSiblings();
  }
  listParents();
  $('#catKind').onchange=listParents;
  $('#catParent').onchange=listSiblings;
  $('#catEdit').onchange=fillFields;
  form.onsubmit=e=>{
    e.preventDefault();
    const id=$('#catEdit').value, old=state.catalog.find(c=>c.id===id);
    const kind=$('#catKind').value,parent_id=$('#catParent').value || null;
    const name=$('#catName').value.trim(), sort_order=Number($('#catOrder').value), archived=$('#catArchived').checked;
    if (!name || state.catalog.some(c=>c.kind===kind && c.parent_id===parent_id && c.id!==id && c.name.toLocaleLowerCase('it')===name.toLocaleLowerCase('it'))) {
      alert('Scegli un nome diverso da quelli già presenti nel gruppo.'); return;
    }
    submitChange((client,owner)=>{
      const table=client.from('finance_categories');
      const query=old ? table.update({name,sort_order,archived}).eq('user_id',owner).eq('id',id)
        .eq('name',old.name).eq('sort_order',old.sort_order).eq('archived',old.archived) :
        table.insert({user_id:owner,kind,parent_id,name,sort_order,archived});
      return query.select('id').maybeSingle();
    });
  };
}
