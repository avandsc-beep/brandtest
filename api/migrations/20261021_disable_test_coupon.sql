-- Impedir nuevos canjes sin alterar los créditos otorgados previamente.
update public.coupons set active = false where code = 'PRUEBA100';
