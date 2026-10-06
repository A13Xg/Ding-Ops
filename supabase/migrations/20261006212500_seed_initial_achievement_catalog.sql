-- DING starter achievement catalog.
-- Phase 7 expands this catalog substantially; these IDs establish the vertical
-- slice and allow reconciliation to be exercised before the full catalog lands.

insert into public.achievement_catalog (id)
values
  ('first_ding'),
  ('ten_dings'),
  ('twenty_five_dings'),
  ('max_level'),
  ('late_night_ding'),
  ('dungeon_ding'),
  ('questing_ding'),
  ('speed_level'),
  ('death_tax'),
  ('altaholic')
on conflict (id) do nothing;
