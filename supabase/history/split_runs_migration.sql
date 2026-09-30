-- One row per split run (a batch of one or more shows split together).
create table if not exists split_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid,
  band_pct numeric,
  total_net numeric not null default 0,
  total_band_fund numeric,
  shows jsonb not null default '[]'::jsonb,
  payments jsonb not null default '[]'::jsonb,
  report jsonb,
  reconstructed boolean not null default false
);

alter table split_runs enable row level security;

drop policy if exists "split_runs authenticated full access" on split_runs;
create policy "split_runs authenticated full access" on split_runs
  for all to authenticated using (true) with check (true);

-- Backfill the splits done before this table existed. Shows split together
-- share an identical split_at; their payments are matched by creation time
-- (show_id is null on a multi-show split's transactions). Band % and the
-- full report can't be recovered, so these are flagged reconstructed.
insert into split_runs (created_at, total_net, shows, payments, reconstructed)
select
  g.split_at,
  coalesce((
    select sum(t.amount) from finance_transactions t
    where t.show_id = any(g.ids) and t.category is distinct from 'split'
  ), 0),
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id,
      'title', s.title,
      'date', s.show_date,
      'net', coalesce((
        select sum(t.amount) from finance_transactions t
        where t.show_id = s.id and t.category is distinct from 'split'
      ), 0)
    ) order by s.show_date)
    from shows s where s.id = any(g.ids)
  ), '[]'::jsonb),
  coalesce((
    select jsonb_agg(x) from (
      select jsonb_build_object(
        'from', t.member_id, 'to', t.member_id,
        'fromName', coalesce(p.display_name, 'Member'), 'toName', coalesce(p.display_name, 'Member'),
        'amount', -t.amount, 'kind', 'self'
      ) as x
      from finance_transactions t
      left join profiles p on p.id = t.member_id
      where t.category = 'split'
        and t.created_at between g.split_at - interval '1 minute' and g.split_at + interval '2 minutes'
      union all
      select jsonb_build_object(
        'from', pp.from_member, 'to', pp.to_member,
        'fromName', coalesce(pf.display_name, 'Member'), 'toName', coalesce(pt.display_name, 'Member'),
        'amount', pp.amount, 'kind', 'transfer', 'pendingId', pp.id
      )
      from pending_payments pp
      left join profiles pf on pf.id = pp.from_member
      left join profiles pt on pt.id = pp.to_member
      where pp.category = 'split'
        and pp.created_at between g.split_at - interval '1 minute' and g.split_at + interval '2 minutes'
    ) q
  ), '[]'::jsonb),
  true
from (
  select split_at, array_agg(id) as ids
  from shows where split_at is not null group by split_at
) g
where not exists (
  select 1 from split_runs r where r.reconstructed and r.created_at = g.split_at
);
