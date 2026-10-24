-- Oramira OS — Migration 0046: Acquisition Engine (off-market land sourcing)
-- A landowner/parcel pipeline parallel to the sales CRM: sourcing stages, land
-- attributes (for scoring), seller-profile intelligence, valuation/uplift, and
-- an assembly key that clusters adjacent/fragmented plots. Staff-only under RLS.

create table if not exists land_parcels (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete set null,   -- the landowner
  reference text not null,                                       -- parcel name / ref
  location text,                                                 -- town / area
  area_ref text,                                                 -- assembly cluster key (block/street)
  plot_size_sqm numeric,
  stage text not null default 'new',   -- new | contacted | interested | under_review | negotiation | due_diligence | offer_made | acquired | lost

  -- Land attributes (scoring inputs; 1–10 unless noted)
  location_quality integer,
  planning_uplift integer,
  frontage_m numeric,
  access_quality text,                 -- none | track | paved | main_road
  plot_shape text,                     -- regular | irregular | narrow | triangular
  density_potential integer,
  zone text,                           -- residential | tourist | commercial | agricultural
  building_density numeric,

  -- Seller-profile intelligence
  seller_urgency integer,              -- 1–10
  reason_for_selling text,
  flexibility integer,                 -- 1–10 (price flexibility)
  financial_pressure boolean not null default false,
  inheritance boolean not null default false,
  family_split boolean not null default false,

  -- Valuation / planning uplift
  current_value numeric,
  post_planning_value numeric,
  asking_price numeric,
  offer_amount numeric,

  -- Workflow
  assigned_to uuid references profiles(id) on delete set null,
  next_action_date timestamptz,
  last_contacted_at timestamptz,
  notes text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists land_parcels_stage_idx on land_parcels (stage);
create index if not exists land_parcels_area_idx on land_parcels (area_ref);
create index if not exists land_parcels_contact_idx on land_parcels (contact_id);

alter table land_parcels enable row level security;
create policy land_parcels_staff_all on land_parcels for all using (is_staff()) with check (is_staff());

-- Outreach cadence templates for landowners (audience-aware like the sales ones).
insert into message_templates (channel, key, name, subject, body, audience) values
  ('whatsapp','landowner_intro','Landowner intro', null, 'Hello {{name}}, I''m {{agent}} from Oramira. We''re acquiring land in {{location}} and would value a brief conversation about your plot — no obligation. When suits you?','en'),
  ('whatsapp','landowner_follow_up','Landowner follow-up', null, 'Hi {{name}}, following up on your land in {{location}}. We remain interested and can move quickly — happy to discuss terms whenever you''re ready.','en'),
  ('email','landowner_intro','Landowner intro','Regarding your land in {{location}}', 'Dear {{name}},<p>I''m {{agent}} from Oramira. We''re actively acquiring land in {{location}} and would welcome a short, no-obligation conversation about your plot.</p><p>Kind regards,<br/>{{agent}}</p>'),
  ('email','landowner_follow_up','Landowner follow-up','Following up on your land', 'Dear {{name}},<p>Following up on your plot in {{location}} — we remain interested and can proceed quickly. I''d be glad to discuss terms at your convenience.</p>')
on conflict (channel, key, audience) do nothing;
