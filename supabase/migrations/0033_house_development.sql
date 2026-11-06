-- Oramira OS — Migration 0033: Villa / house developments
-- Supports developments of individual houses (not apartment blocks): a project
-- development type, house-specific specs (plot, garden, pool), and map
-- coordinates so each house can be positioned on the site plan. Additive.

-- Project development type drives the map: 'houses' renders a flat site map of
-- positioned houses; 'apartments' renders the Block → Floor → Unit drill-down.
alter table projects add column development_type text default 'houses';

-- House-specific specifications (units double as "houses" in a villa project).
alter table units add column plot_size_sqm numeric;
alter table units add column garden_sqm numeric;
alter table units add column has_pool boolean default false;

-- Position on the site plan / masterplan (percentages of the image, 0–100).
alter table units add column map_x numeric;
alter table units add column map_y numeric;
