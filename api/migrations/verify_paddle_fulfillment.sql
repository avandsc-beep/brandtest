-- Prueba transaccional: todo cambio de compra/saldo se revierte al terminar.
begin;
do $$
declare
  v_user uuid;
  v_before int;
  v_after int;
  v_result boolean;
begin
  select id, credits into v_user, v_before from public.users order by id limit 1 for update;
  if v_user is null then raise exception 'Se necesita un usuario para verificar'; end if;

  v_result := public.fulfill_paddle_purchase(v_user, 'credit_package', null, 499, 'txn_codexverify20261021success', 20);
  select credits into v_after from public.users where id = v_user;
  if not v_result or v_after <> v_before + 20 then raise exception 'Falló acreditación'; end if;

  v_result := public.fulfill_paddle_purchase(v_user, 'credit_package', null, 499, 'txn_codexverify20261021success', 20);
  select credits into v_after from public.users where id = v_user;
  if v_result or v_after <> v_before + 20 then raise exception 'Falló idempotencia'; end if;

  -- Forzar un fallo DESPUÉS del insert para verificar que se revierte la compra.
  update public.users set credits = 2147483647 where id = v_user;
  begin
    perform public.fulfill_paddle_purchase(v_user, 'credit_package', null, 499, 'txn_codexverify20261021failure', 20);
    raise exception 'Se esperaba un error de desbordamiento';
  exception when numeric_value_out_of_range then null;
  end;
  if exists (select 1 from public.purchases where paddle_transaction_id = 'txn_codexverify20261021failure') then
    raise exception 'La compra no se revirtió al fallar los créditos';
  end if;
  update public.users set credits = v_before where id = v_user;
  v_result := public.fulfill_paddle_purchase(v_user, 'credit_package', null, 499, 'txn_codexverify20261021failure', 20);
  select credits into v_after from public.users where id = v_user;
  if not v_result or v_after <> v_before + 20 then raise exception 'Falló reintento tras error'; end if;

  if has_function_privilege('anon', 'public.fulfill_paddle_purchase(uuid,text,text,integer,text,integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.fulfill_paddle_purchase(uuid,text,text,integer,text,integer)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.fulfill_paddle_purchase(uuid,text,text,integer,text,integer)', 'EXECUTE') then
    raise exception 'Permisos de acreditación incorrectos';
  end if;
end;
$$;
rollback;
select 'OK: acreditación, duplicados, rollback, reintento y permisos; cambios de prueba revertidos' as resultado;
