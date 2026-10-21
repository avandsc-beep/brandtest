-- Ejecutar en Supabase antes de desplegar el webhook actualizado.
-- Una compra y su acreditación se confirman o revierten juntas.
create or replace function public.fulfill_paddle_purchase(
  p_user_id uuid,
  p_kind text,
  p_package_id text,
  p_amount_cents int,
  p_transaction_id text,
  p_credits int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase_id bigint;
begin
  if p_credits is null or p_credits <= 0
     or p_transaction_id is null or p_transaction_id !~ '^txn_[a-z0-9]+$'
     or p_amount_cents is null or p_amount_cents < 0 then
    raise exception 'Compra inválida';
  end if;

  insert into public.purchases (
    user_id, kind, package_id, amount_cents, paddle_transaction_id, status
  ) values (
    p_user_id, p_kind, p_package_id, p_amount_cents, p_transaction_id, 'completed'
  )
  on conflict (paddle_transaction_id) do nothing
  returning id into v_purchase_id;

  if v_purchase_id is null then
    return false;
  end if;

  update public.users set credits = credits + p_credits where id = p_user_id;
  if not found then
    raise exception 'Usuario sin cuenta de créditos';
  end if;
  return true;
end;
$$;

revoke all on function public.fulfill_paddle_purchase(uuid, text, text, int, text, int) from public, anon, authenticated;
grant execute on function public.fulfill_paddle_purchase(uuid, text, text, int, text, int) to service_role;
