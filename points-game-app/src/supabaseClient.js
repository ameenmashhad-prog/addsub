import { createClient } from "@supabase/supabase-js";

// يتم تعبئة هذه القيم من ملف .env (محلياً) أو من إعدادات المتغيرات في Vercel (بعد النشر)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // تنبيه واضح في الكونسول بدل فشل صامت، يساعد عند نسيان ضبط المتغيرات
  console.error(
    "⚠️ لم يتم ضبط VITE_SUPABASE_URL أو VITE_SUPABASE_ANON_KEY. راجع ملف .env أو إعدادات المتغيرات في Vercel."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
