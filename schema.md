-- ============================================================
-- ENUMS (create before tables that use them)
-- ============================================================

-- create type duration_tag as enum ('short', 'medium', 'long');
-- create type day_key as enum ('monday','tuesday','wednesday','thursday','friday','saturday','sunday');
-- create type ingredient_category as enum ('vegetables','bakery','meat','aisle','fridge');

-- ============================================================
-- HELPER FUNCTION
-- ============================================================

-- Returns the household_id of the currently authenticated user.
-- Used as column DEFAULT and in RLS policies.
create or replace function get_my_household_id() returns uuid
  language sql stable security definer set search_path = public
  as $$ select household_id from household_memberships where user_id = auth.uid() $$;

-- ============================================================
-- HOUSEHOLDS
-- ============================================================

create table households (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- ============================================================
-- HOUSEHOLD MEMBERSHIPS
-- Every user belongs to exactly one household (solo by default).
-- user_id is the primary key — enforces the one-household invariant.
-- email is stored here so members can be displayed without joining auth.users.
-- ============================================================

create table household_memberships (
  household_id uuid not null references households(id) on delete cascade,
  user_id      uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  joined_at    timestamptz not null default now()
);

-- ============================================================
-- HOUSEHOLD INVITES
-- Tracks invitations sent from one household to an email address.
-- ============================================================

create table household_invites (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references households(id) on delete cascade,
  invited_by       uuid not null references auth.users(id) on delete cascade,
  invited_by_email text not null,
  invite_email     text not null,
  status           text not null default 'pending', -- always 'pending'; accepted/left invites are deleted, not archived (see accept_household_invite / remove_from_household)
  created_at       timestamptz not null default now(),
  unique (household_id, invite_email)
);

-- ============================================================
-- TRIGGER: auto-create a solo household for every new user
-- ============================================================

create or replace function handle_new_user() returns trigger
  language plpgsql security definer set search_path = public
  as $$
  declare hh_id uuid;
  begin
    insert into households default values returning id into hh_id;
    insert into household_memberships (household_id, user_id, email)
    values (hh_id, new.id, new.email);
    return new;
  end;
  $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- RPC: accept_household_invite
-- Atomically: verify invite is for current user, move membership,
-- consume the invite. Deletes rather than archiving as 'accepted' —
-- the unique (household_id, invite_email) constraint means a leftover
-- row of any status would block re-inviting the same email later, and
-- nothing in the app reads past-tense invite history.
-- ============================================================

create or replace function accept_household_invite(invite_id uuid) returns void
  language plpgsql security definer set search_path = public
  as $$
  declare
    target_hh_id   uuid;
    expected_email text;
    my_email       text;
  begin
    select household_id, invite_email
    into   target_hh_id, expected_email
    from   household_invites
    where  id = invite_id and status = 'pending';

    if target_hh_id is null then
      raise exception 'Invite not found or already used';
    end if;

    select email into my_email
    from   household_memberships
    where  user_id = auth.uid();

    if my_email != expected_email then
      raise exception 'This invite is not for you';
    end if;

    update household_memberships
    set    household_id = target_hh_id
    where  user_id = auth.uid();

    delete from household_invites where id = invite_id;
  end;
  $$;

-- ============================================================
-- RPC: remove_from_household
-- Shared logic for "leave household" (target = self) and
-- "remove member" (target = another user in same household).
-- Creates a new solo household for the removed user.
-- ============================================================

create or replace function remove_from_household(target_user_id uuid) returns void
  language plpgsql security definer set search_path = public
  as $$
  declare
    new_hh_id     uuid;
    my_hh_id      uuid;
    target_hh_id  uuid;
    target_email  text;
  begin
    select household_id into my_hh_id from household_memberships where user_id = auth.uid();
    select household_id, email into target_hh_id, target_email
    from household_memberships where user_id = target_user_id;

    if target_user_id != auth.uid() and target_hh_id != my_hh_id then
      raise exception 'Not authorized to remove this user';
    end if;

    if (select count(*) from household_memberships where household_id = target_hh_id) <= 1 then
      raise exception 'Already in a solo household';
    end if;

    insert into households default values returning id into new_hh_id;
    update household_memberships set household_id = new_hh_id where user_id = target_user_id;

    -- Consume the invite the departing member joined through (if any — the
    -- original household creator never had one) so the household can
    -- re-invite that email later without hitting the unique
    -- (household_id, invite_email) constraint.
    delete from household_invites
    where household_id = target_hh_id
      and invite_email = target_email;
  end;
  $$;

-- ============================================================
-- PROFILES (1:1 with auth.users)
-- ============================================================

create table profiles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now(),
  unique (user_id)
);

-- ============================================================
-- MEALS (scoped to household)
-- ============================================================

create table meals (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade default get_my_household_id(),
  name         text not null,
  duration     duration_tag not null default 'medium',
  url          text not null default '',
  supper_days  day_key[] not null default '{}',
  instructions text[] not null default '{}',
  tags         text[] not null default '{}',
  needs_prep_ahead boolean not null default false,
  created_at   timestamptz not null default now(),
  version      int not null default 1,
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- ============================================================
-- MEAL INGREDIENTS (many-to-one with meals)
-- ============================================================

create table meal_ingredients (
  id       uuid primary key default gen_random_uuid(),
  meal_id  uuid not null references meals(id) on delete cascade,
  name     text not null,
  quantity text not null default '',
  category ingredient_category not null,
  section  text
);

-- ============================================================
-- WEEKLY PLANS (scoped to household)
-- ============================================================

create table weekly_plans (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade default get_my_household_id(),
  week_start   date not null,
  dismissed_ingredient_names text[] not null default '{}',
  created_at   timestamptz not null default now(),
  version      int not null default 1,
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (household_id, week_start)
);

-- ============================================================
-- DAY PLANS (child of weekly_plans)
-- ============================================================

create table day_plans (
  id             uuid primary key default gen_random_uuid(),
  weekly_plan_id uuid not null references weekly_plans(id) on delete cascade,
  day_key        day_key not null,
  note           text,
  supper_meal_id uuid references meals(id) on delete set null,
  diner_meal_id  uuid references meals(id) on delete set null,
  unique (weekly_plan_id, day_key)
);

-- ============================================================
-- GROCERY ITEMS (child of weekly_plans)
-- ============================================================

create table grocery_items (
  id             uuid primary key default gen_random_uuid(),
  weekly_plan_id uuid not null references weekly_plans(id) on delete cascade,
  name           text not null,
  quantity       text not null default '',
  category       ingredient_category not null,
  checked        boolean not null default false,
  to_verify      boolean not null default false,
  updated_at     timestamptz not null default now(),
  version        int not null default 1,
  deleted_at     timestamptz,
  unique (weekly_plan_id, name, category)
);

-- ============================================================
-- GROCERY PRESETS (scoped to household)
-- ============================================================

create table grocery_presets (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade default get_my_household_id(),
  name         text not null,
  created_at   timestamptz not null default now(),
  version      int not null default 1,
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- ============================================================
-- GROCERY PRESET ITEMS (many-to-one with grocery_presets)
-- ============================================================

create table grocery_preset_items (
  id        uuid primary key default gen_random_uuid(),
  preset_id uuid not null references grocery_presets(id) on delete cascade,
  name      text not null,
  quantity  text not null default '',
  category  ingredient_category not null
);

-- ============================================================
-- WEEKLY PLAN GROCERY PRESETS
-- Tracks which presets are currently "on" for a given week's plan.
-- ============================================================

create table weekly_plan_grocery_presets (
  weekly_plan_id uuid not null references weekly_plans(id) on delete cascade,
  preset_id      uuid not null references grocery_presets(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (weekly_plan_id, preset_id)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- households: members can view their own household
alter table households enable row level security;
create policy "Members can view their household"
  on households for select
  using (id = get_my_household_id());

-- household_memberships: members can view all members of their household
alter table household_memberships enable row level security;
create policy "Members can view their household members"
  on household_memberships for select
  using (household_id = get_my_household_id());

-- household_invites: separate policies per operation to avoid for-all ambiguity.
-- SELECT: household members see outgoing invites; invited user sees invites to their email.
-- INSERT/DELETE: only household members can create or cancel invites.
alter table household_invites enable row level security;
create policy "household_invites_select"
  on household_invites for select
  using (
    household_id = get_my_household_id()
    or invite_email = (auth.jwt() ->> 'email')
  );
create policy "household_invites_insert"
  on household_invites for insert
  with check (household_id = get_my_household_id());
create policy "household_invites_delete"
  on household_invites for delete
  using (household_id = get_my_household_id());

-- meals
alter table meals enable row level security;
create policy "Household members can manage meals"
  on meals for all
  using (household_id = get_my_household_id())
  with check (household_id = get_my_household_id());

-- meal_ingredients (access via parent meal)
alter table meal_ingredients enable row level security;
create policy "Household members can manage meal ingredients"
  on meal_ingredients for all
  using (
    exists (select 1 from meals m where m.id = meal_id and m.household_id = get_my_household_id())
  )
  with check (
    exists (select 1 from meals m where m.id = meal_id and m.household_id = get_my_household_id())
  );

-- weekly_plans
alter table weekly_plans enable row level security;
create policy "Household members can manage weekly plans"
  on weekly_plans for all
  using (household_id = get_my_household_id())
  with check (household_id = get_my_household_id());

-- day_plans (access via parent weekly_plan)
alter table day_plans enable row level security;
create policy "Household members can manage day plans"
  on day_plans for all
  using (
    exists (select 1 from weekly_plans wp where wp.id = weekly_plan_id and wp.household_id = get_my_household_id())
  )
  with check (
    exists (select 1 from weekly_plans wp where wp.id = weekly_plan_id and wp.household_id = get_my_household_id())
  );

-- grocery_items (access via parent weekly_plan)
alter table grocery_items enable row level security;
create policy "Household members can manage grocery items"
  on grocery_items for all
  using (
    exists (select 1 from weekly_plans wp where wp.id = weekly_plan_id and wp.household_id = get_my_household_id())
  )
  with check (
    exists (select 1 from weekly_plans wp where wp.id = weekly_plan_id and wp.household_id = get_my_household_id())
  );

-- grocery_presets
alter table grocery_presets enable row level security;
create policy "Household members can manage grocery presets"
  on grocery_presets for all
  using (household_id = get_my_household_id())
  with check (household_id = get_my_household_id());

-- grocery_preset_items (access via parent grocery_preset)
alter table grocery_preset_items enable row level security;
create policy "Household members can manage grocery preset items"
  on grocery_preset_items for all
  using (
    exists (select 1 from grocery_presets gp where gp.id = preset_id and gp.household_id = get_my_household_id())
  )
  with check (
    exists (select 1 from grocery_presets gp where gp.id = preset_id and gp.household_id = get_my_household_id())
  );

-- weekly_plan_grocery_presets (access via parent weekly_plan)
alter table weekly_plan_grocery_presets enable row level security;
create policy "Household members can manage weekly plan grocery presets"
  on weekly_plan_grocery_presets for all
  using (
    exists (select 1 from weekly_plans wp where wp.id = weekly_plan_id and wp.household_id = get_my_household_id())
  )
  with check (
    exists (select 1 from weekly_plans wp where wp.id = weekly_plan_id and wp.household_id = get_my_household_id())
  );

-- ============================================================
-- SYNC METADATA (offline-first sync layer — see offline-sync-plan.md)
-- version + updated_at are maintained solely by bump_sync_metadata();
-- RPCs never set them directly. deleted_at is a soft-delete tombstone
-- so deletions propagate through delta pulls.
-- ============================================================

create or replace function bump_sync_metadata() returns trigger
  language plpgsql
  as $$
  begin
    new.version    := old.version + 1;
    new.updated_at := now();
    return new;
  end;
  $$;

create trigger meals_bump_sync
  before update on meals
  for each row execute procedure bump_sync_metadata();

create trigger weekly_plans_bump_sync
  before update on weekly_plans
  for each row execute procedure bump_sync_metadata();

create trigger grocery_presets_bump_sync
  before update on grocery_presets
  for each row execute procedure bump_sync_metadata();

create trigger grocery_items_bump_sync
  before update on grocery_items
  for each row execute procedure bump_sync_metadata();

-- Indexes for the delta pull (updated_at > cursor, scoped per household/plan)
create index meals_sync_idx           on meals           (household_id, updated_at);
create index weekly_plans_sync_idx    on weekly_plans    (household_id, updated_at);
create index grocery_presets_sync_idx on grocery_presets (household_id, updated_at);
create index grocery_items_sync_idx   on grocery_items   (weekly_plan_id, updated_at);

-- ============================================================
-- REALTIME (offline-first sync layer — Issue 4)
-- Adds the synced tables to the `supabase_realtime` publication so
-- postgres_changes events fire on insert/update/delete. Realtime
-- enforces each table's RLS policy per subscriber, so no extra
-- household filter is needed client-side.
-- ============================================================

alter publication supabase_realtime add table meals;
alter publication supabase_realtime add table weekly_plans;
alter publication supabase_realtime add table grocery_presets;
alter publication supabase_realtime add table grocery_items;

-- ============================================================
-- SYNC RPCs (offline-first sync layer — Issue 0b)
-- One RPC per aggregate root, version-checked (`p_base_version`,
-- null = insert). Every RPC returns jsonb: {status: 'ok'|'conflict',
-- id, version}. `id` differs from the id the client pushed only for
-- weekly_plans/grocery_items, which can remap onto a canonical row
-- (Decision 4); the client adopts the returned id.
-- ============================================================

-- NOTE (meal tags migration): p_tags was appended with `default null`;
-- null means "leave existing tags untouched" (coalesce below) so stale
-- cached PWA clients calling the old 8-arg signature can't wipe tags.
-- When applying to an existing DB, drop the old overload first to avoid
-- ambiguous resolution:
--   drop function if exists upsert_meal(uuid, int, text, duration_tag, text, day_key[], text[], jsonb);
--   drop function if exists upsert_meal(uuid, int, text, duration_tag, text, day_key[], text[], jsonb, text[]);
-- NOTE (meal sections migration): meal_ingredients.section is a nullable
-- text column added for display-only grouping; ingredient jsonb elements
-- without a `section` key coalesce to null, so stale cached PWA clients
-- omitting the field don't wipe anything.
-- NOTE (needs_prep_ahead migration): p_needs_prep_ahead is always sent
-- (like p_duration, not coalesce-on-omit like p_tags) since it's a plain
-- form boolean. When applying to an existing DB, drop the old overload
-- first to avoid ambiguous resolution:
--   drop function if exists upsert_meal(uuid, int, text, duration_tag, text, day_key[], text[], jsonb, text[]);
create or replace function upsert_meal(
  p_id uuid,
  p_base_version int,
  p_name text,
  p_duration duration_tag,
  p_url text,
  p_supper_days day_key[],
  p_instructions text[],
  p_ingredients jsonb, -- [{name, quantity, category, section}]
  p_tags text[] default null,
  p_needs_prep_ahead boolean default false
) returns jsonb
  language plpgsql security definer set search_path = public
  as $$
  declare
    v_household_id uuid := get_my_household_id();
    v_row meals;
    v_rows_affected int;
  begin
    if p_base_version is null then
      insert into meals (id, household_id, name, duration, url, supper_days, instructions, tags, needs_prep_ahead)
      values (p_id, v_household_id, p_name, p_duration, p_url, p_supper_days, p_instructions, coalesce(p_tags, '{}'), p_needs_prep_ahead)
      on conflict (id) do update set
        name = excluded.name, duration = excluded.duration, url = excluded.url,
        supper_days = excluded.supper_days, instructions = excluded.instructions,
        tags = coalesce(p_tags, meals.tags), needs_prep_ahead = excluded.needs_prep_ahead
      where meals.household_id = v_household_id
      returning * into v_row;

      if v_row.id is null then
        raise exception 'Meal id already in use' using errcode = 'P0001';
      end if;
    else
      update meals set
        name = p_name, duration = p_duration, url = p_url,
        supper_days = p_supper_days, instructions = p_instructions,
        tags = coalesce(p_tags, meals.tags), needs_prep_ahead = p_needs_prep_ahead
      where id = p_id and household_id = v_household_id
        and version = p_base_version and deleted_at is null
      returning * into v_row;

      get diagnostics v_rows_affected = row_count;
      if v_rows_affected = 0 then
        select * into v_row from meals where id = p_id and household_id = v_household_id;
        if v_row.id is null then
          raise exception 'Meal not found' using errcode = 'P0002';
        end if;
        return jsonb_build_object('status', 'conflict', 'id', v_row.id, 'version', v_row.version);
      end if;
    end if;

    delete from meal_ingredients where meal_id = v_row.id;
    if jsonb_array_length(p_ingredients) > 0 then
      insert into meal_ingredients (meal_id, name, quantity, category, section)
      select v_row.id, (item->>'name'), coalesce(item->>'quantity', ''), (item->>'category')::ingredient_category, item->>'section'
      from jsonb_array_elements(p_ingredients) as item;
    end if;

    return jsonb_build_object('status', 'ok', 'id', v_row.id, 'version', v_row.version);
  end;
  $$;

create or replace function delete_meal(p_id uuid, p_base_version int) returns jsonb
  language plpgsql security definer set search_path = public
  as $$
  declare
    v_household_id uuid := get_my_household_id();
    v_row meals;
    v_rows_affected int;
    v_affected_plan_ids uuid[];
    v_affected_plans jsonb;
  begin
    update meals set deleted_at = now()
    where id = p_id and household_id = v_household_id
      and version = p_base_version and deleted_at is null
    returning * into v_row;

    get diagnostics v_rows_affected = row_count;
    if v_rows_affected = 0 then
      select * into v_row from meals where id = p_id and household_id = v_household_id;
      if v_row.id is null then
        return jsonb_build_object('status', 'ok', 'id', p_id);
      end if;
      return jsonb_build_object('status', 'conflict', 'id', v_row.id, 'version', v_row.version);
    end if;

    with cleared_supper as (
      update day_plans dp set supper_meal_id = null
      from weekly_plans wp
      where dp.weekly_plan_id = wp.id and wp.household_id = v_household_id
        and dp.supper_meal_id = p_id
      returning dp.weekly_plan_id
    ), cleared_diner as (
      update day_plans dp set diner_meal_id = null
      from weekly_plans wp
      where dp.weekly_plan_id = wp.id and wp.household_id = v_household_id
        and dp.diner_meal_id = p_id
      returning dp.weekly_plan_id
    )
    select array_agg(distinct weekly_plan_id) into v_affected_plan_ids
    from (
      select weekly_plan_id from cleared_supper
      union
      select weekly_plan_id from cleared_diner
    ) ids;

    if v_affected_plan_ids is not null then
      -- Client-side cleanup (weeklyPlanRepo.clearMealFromAllPlans) races this
      -- same nulling and pushes its own version-checked upsert right after;
      -- bumping the version here and reporting it back lets the sync engine
      -- fast-forward the client's local baseVersion so that upsert doesn't
      -- spuriously conflict against a cleanup both sides already agree on.
      update weekly_plans set updated_at = updated_at where id = any(v_affected_plan_ids);

      select jsonb_agg(jsonb_build_object('id', wp.id, 'version', wp.version))
      into v_affected_plans
      from weekly_plans wp
      where wp.id = any(v_affected_plan_ids);
    end if;

    return jsonb_build_object(
      'status', 'ok', 'id', v_row.id, 'version', v_row.version,
      'affected_plans', coalesce(v_affected_plans, '[]'::jsonb)
    );
  end;
  $$;

create or replace function upsert_grocery_preset(
  p_id uuid,
  p_base_version int,
  p_name text,
  p_items jsonb -- [{name, quantity, category}]
) returns jsonb
  language plpgsql security definer set search_path = public
  as $$
  declare
    v_household_id uuid := get_my_household_id();
    v_row grocery_presets;
    v_rows_affected int;
  begin
    if p_base_version is null then
      insert into grocery_presets (id, household_id, name)
      values (p_id, v_household_id, p_name)
      on conflict (id) do update set name = excluded.name
      where grocery_presets.household_id = v_household_id
      returning * into v_row;

      if v_row.id is null then
        raise exception 'Grocery preset id already in use' using errcode = 'P0001';
      end if;
    else
      update grocery_presets set name = p_name
      where id = p_id and household_id = v_household_id
        and version = p_base_version and deleted_at is null
      returning * into v_row;

      get diagnostics v_rows_affected = row_count;
      if v_rows_affected = 0 then
        select * into v_row from grocery_presets where id = p_id and household_id = v_household_id;
        if v_row.id is null then
          raise exception 'Grocery preset not found' using errcode = 'P0002';
        end if;
        return jsonb_build_object('status', 'conflict', 'id', v_row.id, 'version', v_row.version);
      end if;
    end if;

    delete from grocery_preset_items where preset_id = v_row.id;
    if jsonb_array_length(p_items) > 0 then
      insert into grocery_preset_items (preset_id, name, quantity, category)
      select v_row.id, (item->>'name'), coalesce(item->>'quantity', ''), (item->>'category')::ingredient_category
      from jsonb_array_elements(p_items) as item;
    end if;

    return jsonb_build_object('status', 'ok', 'id', v_row.id, 'version', v_row.version);
  end;
  $$;

create or replace function delete_grocery_preset(p_id uuid, p_base_version int) returns jsonb
  language plpgsql security definer set search_path = public
  as $$
  declare
    v_household_id uuid := get_my_household_id();
    v_row grocery_presets;
    v_rows_affected int;
  begin
    update grocery_presets set deleted_at = now()
    where id = p_id and household_id = v_household_id
      and version = p_base_version and deleted_at is null
    returning * into v_row;

    get diagnostics v_rows_affected = row_count;
    if v_rows_affected = 0 then
      select * into v_row from grocery_presets where id = p_id and household_id = v_household_id;
      if v_row.id is null then
        return jsonb_build_object('status', 'ok', 'id', p_id);
      end if;
      return jsonb_build_object('status', 'conflict', 'id', v_row.id, 'version', v_row.version);
    end if;

    return jsonb_build_object('status', 'ok', 'id', v_row.id, 'version', v_row.version);
  end;
  $$;

-- Get-or-create by (household_id, week_start): if another device already
-- created this week's plan before this insert lands, we adopt its id (the
-- `on conflict` branch keeps the existing row's id since `id` isn't in the
-- update list) rather than erroring — this is the remap path from Decision 4.
-- If the row was already visible to this call's initial SELECT, a null
-- p_base_version is instead treated as a version conflict (see below) so a
-- late-arriving offline "create" can't silently clobber another device's
-- already-synced day plans.
create or replace function upsert_weekly_plan(
  p_id uuid,
  p_base_version int,
  p_week_start date,
  p_dismissed_names text[],
  p_day_plans jsonb, -- [{day_key, note, supper_meal_id, diner_meal_id}]
  p_preset_ids uuid[]
) returns jsonb
  language plpgsql security definer set search_path = public
  as $$
  declare
    v_household_id uuid := get_my_household_id();
    v_row weekly_plans;
  begin
    select * into v_row from weekly_plans
    where household_id = v_household_id and week_start = p_week_start and deleted_at is null;

    if v_row.id is null then
      insert into weekly_plans (id, household_id, week_start, dismissed_ingredient_names)
      values (p_id, v_household_id, p_week_start, p_dismissed_names)
      on conflict (household_id, week_start) do update set
        dismissed_ingredient_names = excluded.dismissed_ingredient_names,
        deleted_at = null
      returning * into v_row;
    else
      -- IS DISTINCT FROM (not just != ) also treats p_base_version = null as a
      -- conflict here: a null base_version means the client thought it was
      -- creating this week's plan for the first time, but a row already
      -- exists (another device created it first). Applying the client's
      -- payload wholesale in that case would silently discard whatever the
      -- other device already saved (Decision 5 requires server-wins + toast
      -- instead, so the client drops its local op, adopts this row/version,
      -- and re-applies its edit as a real update afterward).
      if p_base_version is distinct from v_row.version then
        return jsonb_build_object('status', 'conflict', 'id', v_row.id, 'version', v_row.version);
      end if;

      update weekly_plans set dismissed_ingredient_names = p_dismissed_names
      where id = v_row.id
      returning * into v_row;
    end if;

    delete from day_plans where weekly_plan_id = v_row.id;
    if jsonb_array_length(p_day_plans) > 0 then
      insert into day_plans (weekly_plan_id, day_key, note, supper_meal_id, diner_meal_id)
      select v_row.id, (item->>'day_key')::day_key, item->>'note',
             nullif(item->>'supper_meal_id', '')::uuid, nullif(item->>'diner_meal_id', '')::uuid
      from jsonb_array_elements(p_day_plans) as item;
    end if;

    delete from weekly_plan_grocery_presets where weekly_plan_id = v_row.id;
    if array_length(p_preset_ids, 1) > 0 then
      insert into weekly_plan_grocery_presets (weekly_plan_id, preset_id)
      select v_row.id, unnest(p_preset_ids);
    end if;

    return jsonb_build_object('status', 'ok', 'id', v_row.id, 'version', v_row.version);
  end;
  $$;

create or replace function delete_weekly_plan(p_id uuid, p_base_version int) returns jsonb
  language plpgsql security definer set search_path = public
  as $$
  declare
    v_household_id uuid := get_my_household_id();
    v_row weekly_plans;
    v_rows_affected int;
  begin
    update weekly_plans set deleted_at = now()
    where id = p_id and household_id = v_household_id
      and version = p_base_version and deleted_at is null
    returning * into v_row;

    get diagnostics v_rows_affected = row_count;
    if v_rows_affected = 0 then
      select * into v_row from weekly_plans where id = p_id and household_id = v_household_id;
      if v_row.id is null then
        return jsonb_build_object('status', 'ok', 'id', p_id);
      end if;
      return jsonb_build_object('status', 'conflict', 'id', v_row.id, 'version', v_row.version);
    end if;

    return jsonb_build_object('status', 'ok', 'id', v_row.id, 'version', v_row.version);
  end;
  $$;

-- v1 quantity merge: concatenates distinct quantity strings rather than
-- porting the client's fuzzy numeric/unit merge (`adjustQuantityString`,
-- which does unit-fuzzy-matching + fraction formatting) into SQL. Only
-- triggered when two offline devices independently add the *same new*
-- ingredient name+category before either has synced — rare, and the
-- concatenated string ("2 cups, 1 cup") is still correct, just not
-- arithmetically summed. Revisit if this proves confusing in practice.
create or replace function merge_grocery_quantity(existing text, incoming text) returns text
  language sql immutable
  as $$
  select case
    when existing is null or existing = '' then incoming
    when incoming is null or incoming = '' then existing
    when existing = incoming then existing
    else existing || ', ' || incoming
  end;
  $$;

-- Leaf root (Decision 3/4): identity is (weekly_plan_id, name, category).
-- On a name collision the row is merged (quantities combined, checked
-- and to_verify OR'd) and the canonical id/version returned so the client
-- remaps. p_deleted=true handles the delete path in the same RPC since both
-- need the same "does this row already exist under my client id" lookup.
create or replace function sync_grocery_item(
  p_weekly_plan_id uuid,
  p_client_id uuid,
  p_name text,
  p_category ingredient_category,
  p_quantity text,
  p_checked boolean,
  p_to_verify boolean,
  p_base_version int,
  p_deleted boolean
) returns jsonb
  language plpgsql security definer set search_path = public
  as $$
  declare
    v_household_id uuid := get_my_household_id();
    v_plan_owned boolean;
    v_existing grocery_items;
    v_row grocery_items;
    v_rows_affected int;
  begin
    select exists(
      select 1 from weekly_plans wp
      where wp.id = p_weekly_plan_id and wp.household_id = v_household_id
    ) into v_plan_owned;
    if not v_plan_owned then
      raise exception 'Weekly plan not found' using errcode = 'P0002';
    end if;

    if p_deleted then
      update grocery_items set deleted_at = now()
      where id = p_client_id and weekly_plan_id = p_weekly_plan_id
        and version = p_base_version and deleted_at is null
      returning * into v_row;

      get diagnostics v_rows_affected = row_count;
      if v_rows_affected = 0 then
        select * into v_row from grocery_items where id = p_client_id and weekly_plan_id = p_weekly_plan_id;
        if v_row.id is null then
          return jsonb_build_object('status', 'ok', 'id', p_client_id);
        end if;
        return jsonb_build_object('status', 'conflict', 'id', v_row.id, 'version', v_row.version);
      end if;

      return jsonb_build_object('status', 'ok', 'id', v_row.id, 'version', v_row.version);
    end if;

    select * into v_existing from grocery_items
    where id = p_client_id and weekly_plan_id = p_weekly_plan_id and deleted_at is null;

    if v_existing.id is not null then
      if p_base_version is not null and p_base_version != v_existing.version then
        return jsonb_build_object('status', 'conflict', 'id', v_existing.id, 'version', v_existing.version);
      end if;

      update grocery_items set quantity = p_quantity, checked = p_checked, to_verify = p_to_verify, category = p_category
      where id = v_existing.id
      returning * into v_row;

      return jsonb_build_object('status', 'ok', 'id', v_row.id, 'version', v_row.version);
    end if;

    -- Reviving a tombstoned row (name+category collides with a soft-deleted
    -- item, e.g. clear-week then regenerate) is a fresh write, not a merge:
    -- overwrite quantity/checked/to_verify instead of combining with the
    -- stale value.
    insert into grocery_items (id, weekly_plan_id, name, category, quantity, checked, to_verify)
    values (p_client_id, p_weekly_plan_id, p_name, p_category, p_quantity, p_checked, p_to_verify)
    on conflict (weekly_plan_id, name, category) do update set
      quantity = case when grocery_items.deleted_at is not null
                   then excluded.quantity
                   else merge_grocery_quantity(grocery_items.quantity, excluded.quantity) end,
      checked = case when grocery_items.deleted_at is not null
                  then excluded.checked
                  else grocery_items.checked or excluded.checked end,
      to_verify = case when grocery_items.deleted_at is not null
                    then excluded.to_verify
                    else grocery_items.to_verify or excluded.to_verify end,
      deleted_at = null
    returning * into v_row;

    return jsonb_build_object('status', 'ok', 'id', v_row.id, 'version', v_row.version);
  end;
  $$;

-- Batched sibling of sync_grocery_item: processes a whole array of items
-- (one household round trip instead of one per item — this is what the
-- client uses for "generate week" / "clear week", which otherwise touch
-- every grocery item at once). Same per-item semantics/merge rules as
-- sync_grocery_item, just looped inside one transaction. Each result also
-- carries the full row when the returned id differs from the client id (or
-- on conflict) so the client never needs a follow-up select to resolve an
-- id remap.
create or replace function sync_grocery_items(p_items jsonb) returns jsonb
  language plpgsql security definer set search_path = public
  as $$
  declare
    v_household_id uuid := get_my_household_id();
    v_item jsonb;
    v_weekly_plan_id uuid;
    v_client_id uuid;
    v_name text;
    v_category ingredient_category;
    v_quantity text;
    v_checked boolean;
    v_to_verify boolean;
    v_base_version int;
    v_deleted boolean;
    v_plan_owned boolean;
    v_existing grocery_items;
    v_row grocery_items;
    v_rows_affected int;
    v_results jsonb := '[]'::jsonb;
  begin
    for v_item in select * from jsonb_array_elements(p_items)
    loop
      v_weekly_plan_id := (v_item->>'weekly_plan_id')::uuid;
      v_client_id := (v_item->>'client_id')::uuid;
      v_name := v_item->>'name';
      v_category := (v_item->>'category')::ingredient_category;
      v_quantity := v_item->>'quantity';
      v_checked := (v_item->>'checked')::boolean;
      v_to_verify := (v_item->>'to_verify')::boolean;
      v_base_version := nullif(v_item->>'base_version', '')::int;
      v_deleted := (v_item->>'deleted')::boolean;

      select exists(
        select 1 from weekly_plans wp
        where wp.id = v_weekly_plan_id and wp.household_id = v_household_id
      ) into v_plan_owned;
      if not v_plan_owned then
        raise exception 'Weekly plan not found' using errcode = 'P0002';
      end if;

      if v_deleted then
        update grocery_items set deleted_at = now()
        where id = v_client_id and weekly_plan_id = v_weekly_plan_id
          and version = v_base_version and deleted_at is null
        returning * into v_row;

        get diagnostics v_rows_affected = row_count;
        if v_rows_affected = 0 then
          select * into v_row from grocery_items where id = v_client_id and weekly_plan_id = v_weekly_plan_id;
          if v_row.id is null then
            v_results := v_results || jsonb_build_object('client_id', v_client_id, 'status', 'ok', 'id', v_client_id);
          else
            v_results := v_results || jsonb_build_object(
              'client_id', v_client_id, 'status', 'conflict',
              'id', v_row.id, 'version', v_row.version, 'row', to_jsonb(v_row)
            );
          end if;
        else
          v_results := v_results || jsonb_build_object(
            'client_id', v_client_id, 'status', 'ok', 'id', v_row.id, 'version', v_row.version
          );
        end if;
        continue;
      end if;

      select * into v_existing from grocery_items
      where id = v_client_id and weekly_plan_id = v_weekly_plan_id and deleted_at is null;

      if v_existing.id is not null then
        if v_base_version is not null and v_base_version != v_existing.version then
          v_results := v_results || jsonb_build_object(
            'client_id', v_client_id, 'status', 'conflict',
            'id', v_existing.id, 'version', v_existing.version, 'row', to_jsonb(v_existing)
          );
          continue;
        end if;

        update grocery_items set quantity = v_quantity, checked = v_checked, to_verify = v_to_verify, category = v_category
        where id = v_existing.id
        returning * into v_row;

        v_results := v_results || jsonb_build_object(
          'client_id', v_client_id, 'status', 'ok', 'id', v_row.id, 'version', v_row.version
        );
        continue;
      end if;

      -- See sync_grocery_item: reviving a tombstoned row overwrites instead
      -- of merging with the stale pre-delete value.
      insert into grocery_items (id, weekly_plan_id, name, category, quantity, checked, to_verify)
      values (v_client_id, v_weekly_plan_id, v_name, v_category, v_quantity, v_checked, v_to_verify)
      on conflict (weekly_plan_id, name, category) do update set
        quantity = case when grocery_items.deleted_at is not null
                     then excluded.quantity
                     else merge_grocery_quantity(grocery_items.quantity, excluded.quantity) end,
        checked = case when grocery_items.deleted_at is not null
                    then excluded.checked
                    else grocery_items.checked or excluded.checked end,
        to_verify = case when grocery_items.deleted_at is not null
                      then excluded.to_verify
                      else grocery_items.to_verify or excluded.to_verify end,
        deleted_at = null
      returning * into v_row;

      if v_row.id = v_client_id then
        v_results := v_results || jsonb_build_object(
          'client_id', v_client_id, 'status', 'ok', 'id', v_row.id, 'version', v_row.version
        );
      else
        v_results := v_results || jsonb_build_object(
          'client_id', v_client_id, 'status', 'ok', 'id', v_row.id, 'version', v_row.version, 'row', to_jsonb(v_row)
        );
      end if;
    end loop;

    return v_results;
  end;
  $$;

-- Single round-trip delta pull across every synced table, scoped to the
-- caller's household. Returns tombstones (deleted_at is not filtered) so
-- deletions propagate. `p_since = null` performs a full pull (initial sync
-- / cold start after this migration). The watermark is captured with
-- `now()` in this same statement so client clock skew can never skip rows.
create or replace function pull_changes(p_since timestamptz) returns jsonb
  language plpgsql stable security definer set search_path = public
  as $$
  declare
    v_household_id uuid := get_my_household_id();
    v_watermark timestamptz := now();
    v_meals jsonb;
    v_weekly_plans jsonb;
    v_grocery_presets jsonb;
    v_grocery_items jsonb;
  begin
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id, 'name', m.name, 'duration', m.duration, 'url', m.url,
      'supper_days', m.supper_days, 'instructions', m.instructions, 'tags', m.tags,
      'needs_prep_ahead', m.needs_prep_ahead,
      'version', m.version, 'updated_at', m.updated_at, 'deleted_at', m.deleted_at,
      'ingredients', coalesce((
        select jsonb_agg(jsonb_build_object('name', mi.name, 'quantity', mi.quantity, 'category', mi.category, 'section', mi.section))
        from meal_ingredients mi where mi.meal_id = m.id
      ), '[]'::jsonb)
    )), '[]'::jsonb) into v_meals
    from meals m
    where m.household_id = v_household_id
      and (p_since is null or m.updated_at > p_since);

    select coalesce(jsonb_agg(jsonb_build_object(
      'id', wp.id, 'week_start', wp.week_start,
      'dismissed_ingredient_names', wp.dismissed_ingredient_names,
      'version', wp.version, 'updated_at', wp.updated_at, 'deleted_at', wp.deleted_at,
      'day_plans', coalesce((
        select jsonb_agg(jsonb_build_object(
          'day_key', dp.day_key, 'note', dp.note,
          'supper_meal_id', dp.supper_meal_id, 'diner_meal_id', dp.diner_meal_id
        )) from day_plans dp where dp.weekly_plan_id = wp.id
      ), '[]'::jsonb),
      'preset_ids', coalesce((
        select jsonb_agg(wpgp.preset_id) from weekly_plan_grocery_presets wpgp
        where wpgp.weekly_plan_id = wp.id
      ), '[]'::jsonb)
    )), '[]'::jsonb) into v_weekly_plans
    from weekly_plans wp
    where wp.household_id = v_household_id
      and (p_since is null or wp.updated_at > p_since);

    select coalesce(jsonb_agg(jsonb_build_object(
      'id', gp.id, 'name', gp.name,
      'version', gp.version, 'updated_at', gp.updated_at, 'deleted_at', gp.deleted_at,
      'items', coalesce((
        select jsonb_agg(jsonb_build_object('name', gpi.name, 'quantity', gpi.quantity, 'category', gpi.category))
        from grocery_preset_items gpi where gpi.preset_id = gp.id
      ), '[]'::jsonb)
    )), '[]'::jsonb) into v_grocery_presets
    from grocery_presets gp
    where gp.household_id = v_household_id
      and (p_since is null or gp.updated_at > p_since);

    select coalesce(jsonb_agg(jsonb_build_object(
      'id', gi.id, 'weekly_plan_id', gi.weekly_plan_id, 'name', gi.name,
      'quantity', gi.quantity, 'category', gi.category, 'checked', gi.checked,
      'to_verify', gi.to_verify,
      'version', gi.version, 'updated_at', gi.updated_at, 'deleted_at', gi.deleted_at
    )), '[]'::jsonb) into v_grocery_items
    from grocery_items gi
    join weekly_plans wp on wp.id = gi.weekly_plan_id
    where wp.household_id = v_household_id
      and (p_since is null or gi.updated_at > p_since);

    return jsonb_build_object(
      'watermark', v_watermark,
      'meals', v_meals,
      'weekly_plans', v_weekly_plans,
      'grocery_presets', v_grocery_presets,
      'grocery_items', v_grocery_items
    );
  end;
  $$;
