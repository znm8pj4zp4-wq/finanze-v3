BEGIN;
CREATE OR REPLACE FUNCTION public.finance_check_category() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF TG_OP='UPDATE' AND (NEW.kind IS DISTINCT FROM OLD.kind OR NEW.parent_id IS DISTINCT FROM OLD.parent_id OR NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
    RAISE EXCEPTION 'Crea una nuova categoria per cambiare gruppo o tipo.';
  END IF;
  IF NEW.parent_id IS NOT NULL AND (NEW.id=NEW.parent_id OR NOT EXISTS(
    SELECT 1 FROM public.finance_categories c WHERE c.id=NEW.parent_id AND c.user_id=NEW.user_id
    AND c.kind=NEW.kind AND c.parent_id IS NULL)) THEN RAISE EXCEPTION 'Gruppo non compatibile.'; END IF;
  RETURN NULL;
END;
$$;
CREATE OR REPLACE FUNCTION public.finance_check_movement_total() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE ids uuid[]; target uuid; cents bigint; movement_kind text;
BEGIN
  IF TG_TABLE_NAME='finance_transactions' THEN ids:=ARRAY[NEW.id];
  ELSIF TG_OP='DELETE' THEN ids:=ARRAY[OLD.transaction_id];
  ELSIF TG_OP='UPDATE' THEN ids:=ARRAY[OLD.transaction_id,NEW.transaction_id];
  ELSE ids:=ARRAY[NEW.transaction_id]; END IF;
  FOREACH target IN ARRAY ids LOOP
    SELECT t.amount_cents,t.kind INTO cents,movement_kind FROM public.finance_transactions t WHERE t.id=target FOR UPDATE;
    IF FOUND AND ((SELECT coalesce(sum(a.amount_cents),0) FROM public.finance_allocations a WHERE a.transaction_id=target)<>cents OR EXISTS(
      SELECT 1 FROM public.finance_allocations a JOIN public.finance_categories c ON a.category_id=c.id
      WHERE a.transaction_id=target AND c.kind<>movement_kind)) THEN
      RAISE EXCEPTION 'Verifica il totale delle quote e il tipo di categoria.';
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;
CREATE OR REPLACE TRIGGER finance_category_shape AFTER INSERT OR UPDATE ON public.finance_categories
  FOR EACH ROW EXECUTE FUNCTION public.finance_check_category();
DROP TRIGGER IF EXISTS finance_total_at_commit ON public.finance_transactions;
CREATE CONSTRAINT TRIGGER finance_total_at_commit AFTER INSERT OR UPDATE ON public.finance_transactions
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.finance_check_movement_total();
DROP TRIGGER IF EXISTS finance_parts_at_commit ON public.finance_allocations;
CREATE CONSTRAINT TRIGGER finance_parts_at_commit AFTER INSERT OR UPDATE OR DELETE ON public.finance_allocations
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.finance_check_movement_total();
REVOKE ALL ON FUNCTION public.finance_check_category(), public.finance_check_movement_total() FROM PUBLIC,anon,authenticated;
COMMIT;
