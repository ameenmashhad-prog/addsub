import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Globe, MapPin, UserRound, Apple, Flower2, Trophy, Settings,
  Plus, Trash2, Pencil, RefreshCw, X, Check, Sparkles, Home, ArrowRight,
  Eye, Crown, Radio
} from "lucide-react";
import { supabase } from "./supabaseClient.js";

/* ============================================================
   نظام الألوان والهوية البصرية (Design Tokens)
   ============================================================ */
const THEME = {
  bg: "#150f2b",
  bgElevated: "#1f1642",
  bgCard: "#251a4d",
  gold: "#f5b942",
  goldSoft: "#f5b94222",
  positive: "#2dd4bf",
  negative: "#f4636f",
  text: "#f7f3ea",
  textMuted: "#b3a8d6",
  border: "#3a2c6b",
};

/* الفئات الافتراضية - قابلة للتعديل بالكامل من لوحة التحكم */
const DEFAULT_CATEGORIES = [
  { id: "countries", name: "أسماء الدول", icon: "Globe", color: "#5b8dee",
    items: ["مصر", "السعودية", "الإمارات", "الأردن", "المغرب", "تونس", "الجزائر", "العراق", "الكويت", "قطر", "عُمان", "لبنان", "سوريا", "فلسطين", "اليمن"] },
  { id: "capitals", name: "أسماء العواصم", icon: "MapPin", color: "#a78bfa",
    items: ["القاهرة", "الرياض", "أبوظبي", "عمّان", "الرباط", "تونس", "الجزائر", "بغداد", "الكويت", "الدوحة", "مسقط", "بيروت", "دمشق", "القدس", "صنعاء"] },
  { id: "people", name: "أسماء أشخاص", icon: "UserRound", color: "#f472b6",
    items: ["أحمد", "محمد", "علي", "يوسف", "عمر", "خالد", "فاطمة", "مريم", "سارة", "نور", "ليلى", "هدى", "زينب", "أمل", "رنا"] },
  { id: "produce", name: "فواكه وخضروات", icon: "Apple", color: "#4ade80",
    items: ["تفاح", "موز", "برتقال", "عنب", "فراولة", "بطيخ", "خيار", "طماطم", "جزر", "بطاطا", "خس", "باذنجان", "فلفل", "ليمون", "مانجو"] },
  { id: "flowers", name: "الزهور المشهورة", icon: "Flower2", color: "#fb7185",
    items: ["ورد", "ياسمين", "بنفسج", "زنبق", "أقحوان", "نرجس", "توليب", "سوسن", "لافندر", "عباد الشمس"] },
];

const ICONS = { Globe, MapPin, UserRound, Apple, Flower2 };

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function assignFreshPoints(categories) {
  return categories.map((cat) => ({
    ...cat,
    items: cat.items.map((item) => {
      const name = typeof item === "string" ? item : item.name;
      return { id: name, name, points: randomBetween(-10, 10), disabled: false };
    }),
  }));
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

const ROLE_KEY = "points_game_role"; // مفتاح تخزين الدور محلياً على هذا الجهاز فقط
const ROOM_ID = 1; // صف واحد ثابت لحالة اللعبة (Singleton Row) في جدول game_state

export default function PointsGame() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null); // "host" | "viewer" | null
  const [categories, setCategories] = useState([]);
  const [players, setPlayers] = useState([]);
  const [view, setView] = useState("home");
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [pendingItem, setPendingItem] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [toast, setToast] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [newItemDrafts, setNewItemDrafts] = useState({});
  const toastTimer = useRef(null);
  const skipNextSave = useRef(false); // لتفادي إعادة كتابة نفس البيانات عند استلامها عبر Realtime

  /* ------------------- تحميل الحالة الأولية من Supabase ------------------- */
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.from("game_state").select("*").eq("id", ROOM_ID).single();
        if (error) throw error;
        setCategories(data.categories && data.categories.length ? data.categories : assignFreshPoints(DEFAULT_CATEGORIES));
        setPlayers(data.players || []);
      } catch {
        setCategories(assignFreshPoints(DEFAULT_CATEGORIES));
        setPlayers([]);
      }
      const savedRole = localStorage.getItem(ROLE_KEY);
      if (savedRole === "host" || savedRole === "viewer") setRole(savedRole);
      setLoading(false);
    })();
  }, []);

  /* ------------------- اختيار/تبديل الدور (محلي على هذا الجهاز فقط) ------------------- */
  function chooseRole(newRole) {
    setRole(newRole);
    localStorage.setItem(ROLE_KEY, newRole);
    if (newRole === "host") {
      // تأكيد وجود صف الحالة في قاعدة البيانات لأول مرة (upsert آمن)
      supabase.from("game_state").upsert({
        id: ROOM_ID, categories, players, updated_at: new Date().toISOString(),
      }).then(() => {});
    }
  }
  function switchRole() {
    setRole(null);
    localStorage.removeItem(ROLE_KEY);
  }

  /* ------------------- حفظ التغييرات (المسؤول فقط يكتب) ------------------- */
  useEffect(() => {
    if (loading || role !== "host") return;
    if (skipNextSave.current) { skipNextSave.current = false; return; }
    supabase.from("game_state").upsert({
      id: ROOM_ID, categories, players, updated_at: new Date().toISOString(),
    }).then(({ error }) => { if (error) console.error("خطأ في الحفظ:", error.message); });
  }, [categories, players, loading, role]);

  /* ------------------- المزامنة اللحظية عبر Supabase Realtime (كل من هو مشاهد أو مسؤول يستمع للتغييرات) ------------------- */
  useEffect(() => {
    if (loading) return;
    const channel = supabase
      .channel("game_state_live")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_state", filter: `id=eq.${ROOM_ID}` },
        (payload) => {
          const row = payload.new;
          // إن كنا المسؤول، تجاهل الحدث الناتج عن حفظنا نحن أنفسنا لتفادي حلقة تحديث لا داعي لها
          skipNextSave.current = role === "host";
          if (row.categories) setCategories(row.categories);
          if (row.players) setPlayers(row.players);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loading, role]);

  const activeCategory = categories.find((c) => c.id === activeCategoryId);
  const sortedPlayers = useMemo(() => [...players].sort((a, b) => b.total - a.total), [players]);
  const allPlayerNames = useMemo(() => players.map((p) => p.name), [players]);

  function openPicker(catId, item) {
    if (role !== "host" || item.disabled) return;
    setPendingItem({ catId, item });
    setNameInput("");
  }

  function confirmPick() {
    const cleanName = nameInput.trim();
    if (!cleanName || !pendingItem) return;
    const { catId, item } = pendingItem;

    setPlayers((prev) => {
      const existing = prev.find((p) => p.name.toLowerCase() === cleanName.toLowerCase());
      if (existing) {
        return prev.map((p) =>
          p.name.toLowerCase() === cleanName.toLowerCase() ? { ...p, total: p.total + item.points } : p
        );
      }
      return [...prev, { name: cleanName, total: item.points }];
    });

    setCategories((prev) =>
      prev.map((cat) =>
        cat.id !== catId ? cat : { ...cat, items: cat.items.map((i) => (i.id === item.id ? { ...i, disabled: true } : i)) }
      )
    );

    setToast({ player: cleanName, points: item.points, item: item.name });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
    setPendingItem(null);
    setNameInput("");
  }

  function startNewRound() {
    setCategories((prev) => assignFreshPoints(prev));
    setPlayers([]);
    setConfirmReset(false);
    setView("home");
  }

  function renameCategory(catId, newName) {
    setCategories((prev) => prev.map((c) => (c.id === catId ? { ...c, name: newName } : c)));
  }
  function deleteItem(catId, itemId) {
    setCategories((prev) => prev.map((c) => (c.id !== catId ? c : { ...c, items: c.items.filter((i) => i.id !== itemId) })));
  }
  function addItem(catId) {
    const text = (newItemDrafts[catId] || "").trim();
    if (!text) return;
    setCategories((prev) =>
      prev.map((c) =>
        c.id !== catId ? c : { ...c, items: [...c.items, { id: makeId("item"), name: text, points: randomBetween(-10, 10), disabled: false }] }
      )
    );
    setNewItemDrafts((prev) => ({ ...prev, [catId]: "" }));
  }

  if (loading) {
    return (
      <div dir="rtl" style={{ background: THEME.bg, color: THEME.text, minHeight: "100vh" }} className="flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <Sparkles className="animate-pulse" size={36} color={THEME.gold} />
          <p className="text-sm" style={{ color: THEME.textMuted }}>جارِ التحميل...</p>
        </div>
      </div>
    );
  }

  if (!role) {
    return (
      <div dir="rtl" style={{ background: THEME.bg, color: THEME.text, minHeight: "100vh", fontFamily: "'Tajawal','Segoe UI',Tahoma,sans-serif" }} className="flex flex-col items-center justify-center px-6 py-10">
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap');`}</style>
        <Sparkles size={30} color={THEME.gold} className="mb-3" />
        <h1 className="font-black text-2xl mb-1 text-center">لعبة النقاط</h1>
        <p className="text-sm mb-8 text-center" style={{ color: THEME.textMuted }}>كيف تريد استخدام هذا الجهاز؟</p>
        <div className="w-full max-w-sm flex flex-col gap-3">
          <button onClick={() => chooseRole("host")} className="rounded-2xl p-5 text-right flex items-center gap-4" style={{ background: THEME.bgCard, border: `1px solid ${THEME.gold}66` }}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: THEME.goldSoft, color: THEME.gold }}><Crown size={22} /></div>
            <div><p className="font-black">مسؤول اللعبة</p><p className="text-xs mt-0.5" style={{ color: THEME.textMuted }}>تحكّم كامل: اختيار الأسماء، الإدارة، وبدء الجولات</p></div>
          </button>
          <button onClick={() => chooseRole("viewer")} className="rounded-2xl p-5 text-right flex items-center gap-4" style={{ background: THEME.bgCard, border: `1px solid ${THEME.border}` }}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${THEME.positive}22`, color: THEME.positive }}><Eye size={22} /></div>
            <div><p className="font-black">مشاهدة فقط</p><p className="text-xs mt-0.5" style={{ color: THEME.textMuted }}>شاشة عرض مباشر للاعبين، بدون أي تحكم باللعبة</p></div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" style={{ background: THEME.bg, color: THEME.text, minHeight: "100vh", fontFamily: "'Tajawal','Segoe UI',Tahoma,sans-serif" }} className="flex flex-col">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap');
        * { box-sizing: border-box; }
        .card-tap:active { transform: scale(0.97); }
        @keyframes popIn { from { opacity:0; transform: translateY(10px) scale(.9);} to {opacity:1; transform: translateY(0) scale(1);} }
        .pop-in { animation: popIn .25s ease-out; }
        @keyframes flipReveal { from { transform: rotateY(90deg); opacity:0;} to { transform: rotateY(0deg); opacity:1;} }
        .flip-reveal { animation: flipReveal .35s ease-out; }
        ::-webkit-scrollbar { width: 6px; height:6px; }
        ::-webkit-scrollbar-thumb { background: ${THEME.border}; border-radius: 10px; }
      `}</style>

      <header style={{ background: THEME.bgElevated, borderBottom: `1px solid ${THEME.border}` }} className="sticky top-0 z-20 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={22} color={THEME.gold} />
          <h1 className="font-black text-lg">لعبة النقاط</h1>
        </div>
        <div className="flex items-center gap-2">
          {role === "viewer" ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: `${THEME.positive}22`, color: THEME.positive }}>
              <Radio size={13} className="animate-pulse" /> بث مباشر
            </span>
          ) : (
            <button onClick={() => setConfirmReset(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-bold card-tap transition" style={{ background: THEME.goldSoft, color: THEME.gold, border: `1px solid ${THEME.gold}55` }}>
              <RefreshCw size={15} /> جولة جديدة
            </button>
          )}
          <button onClick={switchRole} title="تبديل الدور" style={{ color: THEME.textMuted }} className="p-1.5">
            {role === "host" ? <Crown size={17} /> : <Eye size={17} />}
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-3xl w-full mx-auto pb-24">
        {view === "home" && <HomeView categories={categories} onOpenCategory={(id) => { setActiveCategoryId(id); setView("category"); }} />}
        {view === "category" && activeCategory && (
          <CategoryView category={activeCategory} onBack={() => setView("home")} onPick={(item) => openPicker(activeCategory.id, item)} isViewer={role === "viewer"} />
        )}
        {view === "scoreboard" && <ScoreboardView players={sortedPlayers} />}
        {view === "admin" && role === "host" && (
          <AdminView categories={categories} drafts={newItemDrafts} setDrafts={setNewItemDrafts} onRename={renameCategory} onDeleteItem={deleteItem} onAddItem={addItem} />
        )}
      </main>

      <nav style={{ background: THEME.bgElevated, borderTop: `1px solid ${THEME.border}` }} className="fixed bottom-0 inset-x-0 z-20 px-2 py-2 flex justify-around max-w-3xl mx-auto">
        <NavBtn active={view === "home"} icon={<Home size={20} />} label="الفئات" onClick={() => setView("home")} />
        <NavBtn active={view === "scoreboard"} icon={<Trophy size={20} />} label="النتائج" onClick={() => setView("scoreboard")} />
        {role === "host" && <NavBtn active={view === "admin"} icon={<Settings size={20} />} label="الإدارة" onClick={() => setView("admin")} />}
      </nav>

      {pendingItem && (
        <Modal onClose={() => setPendingItem(null)}>
          <div className="text-center mb-4">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center text-2xl font-black" style={{ background: THEME.goldSoft, color: THEME.gold }}>؟</div>
            <p className="text-sm" style={{ color: THEME.textMuted }}>تم اختيار</p>
            <p className="text-xl font-black">{pendingItem.item.name}</p>
          </div>
          <label className="block text-sm mb-1.5 font-bold" style={{ color: THEME.textMuted }}>من هو اللاعب الذي اختار هذا الاسم؟</label>
          <input autoFocus list="players-suggestions" value={nameInput} onChange={(e) => setNameInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && confirmPick()}
            placeholder="اكتب اسم اللاعب..." className="w-full rounded-xl px-4 py-3 text-base font-bold outline-none" style={{ background: THEME.bg, border: `2px solid ${THEME.border}`, color: THEME.text }} />
          <datalist id="players-suggestions">{allPlayerNames.map((n) => <option value={n} key={n} />)}</datalist>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setPendingItem(null)} className="flex-1 py-3 rounded-xl font-bold" style={{ background: THEME.bg, color: THEME.textMuted, border: `1px solid ${THEME.border}` }}>إلغاء</button>
            <button onClick={confirmPick} disabled={!nameInput.trim()} className="flex-1 py-3 rounded-xl font-black flex items-center justify-center gap-1.5" style={{ background: nameInput.trim() ? THEME.gold : `${THEME.gold}55`, color: THEME.bg }}>
              <Check size={18} /> تأكيد
            </button>
          </div>
        </Modal>
      )}

      {confirmReset && (
        <Modal onClose={() => setConfirmReset(false)}>
          <div className="text-center">
            <RefreshCw size={30} color={THEME.gold} className="mx-auto mb-3" />
            <p className="font-black text-lg mb-2">بدء جولة جديدة؟</p>
            <p className="text-sm mb-5" style={{ color: THEME.textMuted }}>سيتم تفعيل كل الأسماء من جديد، وتوزيع نقاط عشوائية جديدة، وتصفير لوحة النتائج بالكامل.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmReset(false)} className="flex-1 py-3 rounded-xl font-bold" style={{ background: THEME.bg, color: THEME.textMuted, border: `1px solid ${THEME.border}` }}>تراجع</button>
              <button onClick={startNewRound} className="flex-1 py-3 rounded-xl font-black" style={{ background: THEME.gold, color: THEME.bg }}>تأكيد البدء</button>
            </div>
          </div>
        </Modal>
      )}

      {toast && (
        <div className="fixed bottom-24 inset-x-0 flex justify-center z-30 px-4 pointer-events-none">
          <div className="pop-in flip-reveal px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 max-w-sm w-full justify-center"
            style={{ background: THEME.bgCard, border: `1px solid ${toast.points >= 0 ? THEME.positive : THEME.negative}66` }}>
            <span className="font-bold">{toast.player}</span>
            <span className="font-black text-xl px-2.5 py-0.5 rounded-lg" style={{ color: toast.points >= 0 ? THEME.positive : THEME.negative, background: toast.points >= 0 ? `${THEME.positive}22` : `${THEME.negative}22` }}>
              {toast.points > 0 ? `+${toast.points}` : toast.points}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function NavBtn({ active, icon, label, onClick }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition" style={{ color: active ? THEME.gold : THEME.textMuted }}>
      {icon}<span className="text-[11px] font-bold">{label}</span>
    </button>
  );
}

function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "#00000099" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="pop-in w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 relative" style={{ background: THEME.bgElevated, border: `1px solid ${THEME.border}` }}>
        <button onClick={onClose} className="absolute top-4 left-4" style={{ color: THEME.textMuted }}><X size={20} /></button>
        {children}
      </div>
    </div>
  );
}

function HomeView({ categories, onOpenCategory }) {
  return (
    <div>
      <p className="text-sm mb-4" style={{ color: THEME.textMuted }}>اختر فئة لبدء الجولة</p>
      <div className="grid grid-cols-2 gap-3">
        {categories.map((cat) => {
          const Icon = ICONS[cat.icon] || Sparkles;
          const remaining = cat.items.filter((i) => !i.disabled).length;
          return (
            <button key={cat.id} onClick={() => onOpenCategory(cat.id)} className="card-tap pop-in rounded-2xl p-4 text-right flex flex-col gap-3 transition" style={{ background: THEME.bgCard, border: `1px solid ${THEME.border}` }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${cat.color}22`, color: cat.color }}><Icon size={22} /></div>
              <div>
                <p className="font-black text-sm leading-snug">{cat.name}</p>
                <p className="text-xs mt-1" style={{ color: THEME.textMuted }}>{remaining} من {cat.items.length} متبقٍ</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CategoryView({ category, onBack, onPick, isViewer }) {
  const Icon = ICONS[category.icon] || Sparkles;
  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-bold mb-4" style={{ color: THEME.gold }}><ArrowRight size={16} /> رجوع للفئات</button>
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${category.color}22`, color: category.color }}><Icon size={18} /></div>
        <h2 className="font-black text-lg">{category.name}</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {category.items.map((item) => (
          <button key={item.id} onClick={() => onPick(item)} disabled={item.disabled || isViewer}
            className={`rounded-xl px-3 py-4 font-bold text-sm flex flex-col items-center gap-2 transition ${isViewer ? "" : "card-tap"}`}
            style={{ background: item.disabled ? "transparent" : THEME.bgCard, border: `1px solid ${THEME.border}`, opacity: item.disabled ? 0.4 : 1, color: THEME.text, cursor: isViewer ? "default" : "pointer" }}>
            <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black" style={{ background: THEME.goldSoft, color: THEME.gold }}>
              {item.disabled ? <Check size={14} /> : "؟"}
            </span>
            {item.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function ScoreboardView({ players }) {
  if (players.length === 0) {
    return (
      <div className="text-center py-16">
        <Trophy size={38} color={THEME.textMuted} className="mx-auto mb-3" />
        <p className="font-bold" style={{ color: THEME.textMuted }}>لا توجد نتائج بعد</p>
        <p className="text-sm mt-1" style={{ color: THEME.textMuted }}>ابدأ باختيار الأسماء من الفئات</p>
      </div>
    );
  }
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div>
      <h2 className="font-black text-lg mb-4 flex items-center gap-2"><Trophy size={20} color={THEME.gold} /> لوحة النتائج</h2>
      <div className="flex flex-col gap-2">
        {players.map((p, idx) => (
          <div key={p.name} className="pop-in flex items-center justify-between rounded-xl px-4 py-3" style={{ background: idx === 0 ? THEME.goldSoft : THEME.bgCard, border: `1px solid ${idx === 0 ? THEME.gold + "66" : THEME.border}` }}>
            <div className="flex items-center gap-3">
              <span className="font-black w-6 text-center">{medals[idx] || idx + 1}</span>
              <span className="font-bold">{p.name}</span>
            </div>
            <span className="font-black text-lg" style={{ color: p.total >= 0 ? THEME.positive : THEME.negative }}>{p.total > 0 ? `+${p.total}` : p.total}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminView({ categories, drafts, setDrafts, onRename, onDeleteItem, onAddItem }) {
  const [editingCat, setEditingCat] = useState(null);
  const [editValue, setEditValue] = useState("");
  return (
    <div>
      <h2 className="font-black text-lg mb-1 flex items-center gap-2"><Settings size={20} color={THEME.gold} /> إدارة الفئات والأسماء</h2>
      <p className="text-sm mb-5" style={{ color: THEME.textMuted }}>أضف أو احذف أسماء، أو عدّل عناوين الفئات. التعديلات تُحفظ تلقائياً.</p>
      <div className="flex flex-col gap-4">
        {categories.map((cat) => {
          const Icon = ICONS[cat.icon] || Sparkles;
          return (
            <div key={cat.id} className="rounded-2xl p-4" style={{ background: THEME.bgCard, border: `1px solid ${THEME.border}` }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${cat.color}22`, color: cat.color }}><Icon size={16} /></div>
                  {editingCat === cat.id ? (
                    <input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => { onRename(cat.id, editValue.trim() || cat.name); setEditingCat(null); }}
                      onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                      className="font-bold text-sm rounded-lg px-2 py-1 outline-none" style={{ background: THEME.bg, border: `1px solid ${THEME.gold}`, color: THEME.text }} />
                  ) : <span className="font-black text-sm">{cat.name}</span>}
                </div>
                <button onClick={() => { setEditingCat(cat.id); setEditValue(cat.name); }} style={{ color: THEME.textMuted }}><Pencil size={15} /></button>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {cat.items.map((item) => (
                  <span key={item.id} className="flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-xs font-bold" style={{ background: THEME.bg, border: `1px solid ${THEME.border}` }}>
                    {item.name}
                    <button onClick={() => onDeleteItem(cat.id, item.id)} style={{ color: THEME.negative }}><X size={12} /></button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={drafts[cat.id] || ""} onChange={(e) => setDrafts((p) => ({ ...p, [cat.id]: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && onAddItem(cat.id)} placeholder="اسم جديد..."
                  className="flex-1 rounded-lg px-3 py-2 text-sm outline-none" style={{ background: THEME.bg, border: `1px solid ${THEME.border}`, color: THEME.text }} />
                <button onClick={() => onAddItem(cat.id)} className="px-3 rounded-lg flex items-center justify-center" style={{ background: THEME.gold, color: THEME.bg }}><Plus size={16} /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
