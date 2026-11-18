BEGIN;
ALTER TABLE public.finance_transactions ADD COLUMN IF NOT EXISTS account_label text;
CREATE TABLE IF NOT EXISTS public.finance_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content jsonb NOT NULL, added_tx uuid[] NOT NULL, added_assets uuid[] NOT NULL,
  prior_budget bigint, new_budget bigint NOT NULL, budget_changed boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.finance_imports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS finance_import_owner ON public.finance_imports;
CREATE POLICY finance_import_owner ON public.finance_imports TO authenticated
  USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());
REVOKE ALL ON public.finance_imports FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,DELETE ON public.finance_imports TO authenticated;

CREATE OR REPLACE FUNCTION public.finance_import_v2(doc jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
  u uuid:=auth.uid(); receipt uuid; x jsonb; a jsonb; ref uuid; ids uuid[]:='{}'; assets uuid[]:='{}';
  old_budget bigint; new_budget bigint; budget_change boolean; parts jsonb;
BEGIN
  IF u IS NULL OR jsonb_typeof(doc->'transactions') IS DISTINCT FROM 'array'
    OR jsonb_typeof(doc->'assets') IS DISTINCT FROM 'array' OR NOT doc ? 'budget'
    OR (doc->>'budget') !~ '^[0-9]+$' OR doc->>'budget' IS NULL THEN
    RAISE EXCEPTION 'Backup non valido';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(u::text, 21));
  SELECT id INTO receipt FROM public.finance_imports WHERE user_id=u AND content=doc LIMIT 1;
  IF FOUND THEN RETURN receipt; END IF;
  new_budget:=(doc->>'budget')::bigint;
  SELECT monthly_budget_cents INTO old_budget FROM public.finance_settings WHERE user_id=u FOR UPDATE;
  IF old_budget IS NULL THEN
    INSERT INTO public.finance_settings(user_id,monthly_budget_cents) VALUES(u,0) ON CONFLICT DO NOTHING;
    SELECT monthly_budget_cents INTO old_budget FROM public.finance_settings WHERE user_id=u FOR UPDATE;
  END IF;
  IF old_budget>0 AND new_budget>0 AND old_budget<>new_budget THEN
    RAISE EXCEPTION 'Il budget nel cloud è diverso. Nessuna modifica eseguita.';
  END IF;
  budget_change:=old_budget=0 AND new_budget>0;
  FOR x IN SELECT value FROM jsonb_array_elements(doc->'transactions') LOOP
    IF coalesce(length(x->>'id'),0)=0 THEN RAISE EXCEPTION 'Movimento senza identificativo'; END IF;
    IF EXISTS(SELECT 1 FROM public.finance_transactions WHERE user_id=u AND (legacy_id=x->>'id' OR id::text=x->>'id')) THEN
      RAISE EXCEPTION 'Il backup contiene un movimento già presente. Importazione annullata.';
    END IF;
    parts:='[]'::jsonb;
    FOR a IN SELECT value FROM jsonb_array_elements(x->'parts') LOOP
      SELECT coalesce(child.id, CASE WHEN coalesce(a->>'subcategory','')='' THEN root.id END) INTO ref
        FROM public.finance_categories root LEFT JOIN public.finance_categories child
          ON child.user_id=u AND child.parent_id=root.id AND child.name=a->>'subcategory' AND child.kind=root.kind
        WHERE root.user_id=u AND root.parent_id IS NULL AND root.kind=x->>'kind' AND root.name=a->>'category'
        ORDER BY root.archived,child.archived,root.id,child.id LIMIT 1;
      parts:=parts || jsonb_build_array(a || jsonb_build_object('category_id',ref));
    END LOOP;
    ref:=public.finance_save_transaction(NULL,(x->>'date')::date,x->>'kind',(x->>'cents')::bigint,x->>'note',parts,x->>'id');
    UPDATE public.finance_transactions SET account_label=x->>'account' WHERE id=ref AND user_id=u;
    ids:=array_append(ids,ref);
  END LOOP;
  FOR x IN SELECT value FROM jsonb_array_elements(doc->'assets') LOOP
    IF coalesce(length(x->>'id'),0)=0 OR EXISTS(SELECT 1 FROM public.finance_assets WHERE user_id=u AND (legacy_id=x->>'id' OR id::text=x->>'id')) THEN
      RAISE EXCEPTION 'Identificativo patrimoniale mancante o già presente.';
    END IF;
    INSERT INTO public.finance_assets(user_id,name,kind,value_cents,legacy_id)
      VALUES(u,x->>'name',x->>'kind',(x->>'cents')::bigint,x->>'id') RETURNING id INTO ref;
    assets:=array_append(assets,ref);
  END LOOP;
  IF budget_change THEN UPDATE public.finance_settings SET monthly_budget_cents=new_budget,updated_at=now() WHERE user_id=u; END IF;
  INSERT INTO public.finance_imports(user_id,content,added_tx,added_assets,prior_budget,new_budget,budget_changed)
    VALUES(u,doc,ids,assets,old_budget,new_budget,budget_change) RETURNING id INTO receipt;
  RETURN receipt;
END;
$$;
CREATE OR REPLACE FUNCTION public.finance_undo_import(batch uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); r public.finance_imports%ROWTYPE; changed integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(u::text, 21));
  SELECT * INTO STRICT r FROM public.finance_imports WHERE id=batch AND user_id=u;
  IF EXISTS(SELECT 1 FROM public.finance_imports WHERE user_id=u AND created_at>r.created_at) THEN RAISE EXCEPTION 'Annulla prima l’importazione più recente.'; END IF;
  DELETE FROM public.finance_transactions WHERE user_id=u AND id=ANY(r.added_tx) AND updated_at=r.created_at;
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed<>cardinality(r.added_tx) THEN RAISE EXCEPTION 'Un movimento è cambiato. Annullamento interrotto.'; END IF;
  DELETE FROM public.finance_assets WHERE user_id=u AND id=ANY(r.added_assets) AND updated_at=r.created_at;
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed<>cardinality(r.added_assets) THEN RAISE EXCEPTION 'Il patrimonio è cambiato. Annullamento interrotto.'; END IF;
  IF r.budget_changed THEN
    UPDATE public.finance_settings SET monthly_budget_cents=r.prior_budget,updated_at=now()
      WHERE user_id=u AND monthly_budget_cents=r.new_budget;
    IF NOT FOUND THEN RAISE EXCEPTION 'Il budget è cambiato. Annullamento interrotto.'; END IF;
  END IF;
  DELETE FROM public.finance_imports WHERE user_id=u AND id=batch;
  RETURN batch;
END;
$$;
REVOKE ALL ON FUNCTION public.finance_import_v2(jsonb), public.finance_undo_import(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finance_import_v2(jsonb), public.finance_undo_import(uuid) TO authenticated;
COMMIT;
