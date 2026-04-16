-- Stock back-in-stock notification subscriptions for B2B clients
create table if not exists stock_notifications (
  id          bigserial primary key,
  user_id     uuid    not null references profiles(id) on delete cascade,
  product_id  integer not null references products(id) on delete cascade,
  created_at  timestamptz not null default now(),
  notified_at timestamptz,
  unique (user_id, product_id)
);

alter table stock_notifications enable row level security;

create policy "Users manage own stock notifications"
  on stock_notifications for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_stock_notif_product on stock_notifications (product_id)
  where notified_at is null;
