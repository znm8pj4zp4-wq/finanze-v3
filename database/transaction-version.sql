BEGIN;
CREATE OR REPLACE FUNCTION public.finance_save_transaction_versioned(
  p_id uuid, p_transaction_date date, p_kind text, p_amount_cents bigint,
  p_description text, p_allocations jsonb, p_expected_version timestamptz
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  actual_version timestamptz;
BEGIN
  IF auth.uid() IS NULL OR p_id IS NULL THEN
    RAISE EXCEPTION 'Accedi per salvare il movimento.';
  END IF;
  -- Serialize submissions bearing the same client-generated identifier.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
  SELECT updated_at INTO actual_version FROM public.finance_transactions
    WHERE id = p_id AND user_id = auth.uid() FOR UPDATE;
  IF (FOUND AND p_expected_version IS NULL)
     OR actual_version IS DISTINCT FROM p_expected_version THEN
    RAISE EXCEPTION 'Il movimento è già stato salvato, modificato o eliminato. Aggiorna i dati prima di riprovare.';
  END IF;
  RETURN public.finance_save_transaction(p_id, p_transaction_date, p_kind,
    p_amount_cents, p_description, p_allocations, NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.finance_save_transaction_versioned(uuid,date,text,bigint,text,jsonb,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_save_transaction_versioned(uuid,date,text,bigint,text,jsonb,timestamptz) TO authenticated;
COMMIT;
