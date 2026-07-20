-- شغّل هذا الاستعلام كاملاً داخل Supabase > SQL Editor

-- الجدول: صف واحد فقط يحمل حالة اللعبة بالكامل (الفئات + اللاعبون) بصيغة JSON
create table if not exists game_state (
  id int primary key,
  categories jsonb not null default '[]'::jsonb,
  players jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- إدراج الصف الوحيد الذي سيستخدمه التطبيق (id = 1)
insert into game_state (id, categories, players)
values (1, '[]'::jsonb, '[]'::jsonb)
on conflict (id) do nothing;

-- تفعيل أمان مستوى الصف
alter table game_state enable row level security;

-- السماح لأي زائر (anon) بقراءة وتحديث هذا الجدول فقط
-- ملاحظة: هذا مناسب للعبة جماعية بسيطة بدون بيانات حساسة أو تسجيل دخول
create policy "allow read for everyone" on game_state
  for select using (true);

create policy "allow update for everyone" on game_state
  for update using (true) with check (true);

-- تفعيل البث اللحظي (Realtime) على الجدول حتى تصل التحديثات فوراً لشاشة المشاهدة
alter publication supabase_realtime add table game_state;
