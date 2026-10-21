begin;
update public.plans set paddle_price_id = 'pri_01m5fbp7bfw2a2517x3zeebymy', monthly_price_cents = 699, credits_included = 30, active = true where id = 'estudiante';
update public.plans set paddle_price_id = 'pri_01m5fbrg5w71sb30g7vr1ftfy9', monthly_price_cents = 1999, credits_included = 150, active = true where id = 'profesional';
update public.plans set paddle_price_id = 'pri_01m5fbsvjp3f3abexetmqgaghd', monthly_price_cents = 7900, credits_included = 600, active = true where id = 'empresa';
update public.credit_packages set paddle_price_id = 'pri_01m5fbtnamj8j3gjvx41nczax5', price_cents = 499, credits = 20, active = true where id = 'pequeno';
update public.credit_packages set paddle_price_id = 'pri_01m5fbvhvnpsdtt4petnfhwzr2', price_cents = 1299, credits = 60, active = true where id = 'mediano';
update public.credit_packages set paddle_price_id = 'pri_01m5fby4hrm1gawj3867t74n8r', price_cents = 3499, credits = 200, active = true where id = 'grande';
commit;
select 'plan' as kind, id, paddle_price_id, active from public.plans union all select 'package', id, paddle_price_id, active from public.credit_packages;