-- eliminar trigger anterior si existe
drop trigger if exists on_auth_user_created on auth.users;

-- eliminar función anterior
drop function if exists public.handle_new_user cascade;

-- crear función corregida
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (
    id,
    email,
    phone,
    company_name,
    contact_name,
    client_type,
    default_margin,
    role
  )
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'company_name',
    new.raw_user_meta_data->>'contact_name',
    new.raw_user_meta_data->>'client_type',
    coalesce((new.raw_user_meta_data->>'default_margin')::int, 0),
    new.raw_user_meta_data->>'role'
  );

  return new;
end;
$$ language plpgsql security definer;

-- recrear trigger
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();