import React, { useEffect, useMemo, useState } from "react";

/** ====== Config ====== */
const BASE = import.meta.env.VITE_API_URL || ""; // e.g. https://choresapp-backend.onrender.com

/** ====== API ====== */
const api = {
  users: async () => (await fetch(`${BASE}/api/users`)).json(),
  chores: {
    list: async (q) => {
      const qs = q ? `?start=${q.start}&end=${q.end}` : "";
      return (await fetch(`${BASE}/api/chores${qs}`)).json();
    },
    create: async (payload) =>
      (
        await fetch(`${BASE}/api/chores`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      ).json(),
    update: async (id, payload) =>
      (
        await fetch(`${BASE}/api/chores/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      ).json(),
    remove: async (id) =>
      (await fetch(`${BASE}/api/chores/${id}`, { method: "DELETE" })).json(),
  },
  comments: {
    list: async () => (await fetch(`${BASE}/api/comments`)).json(),
    create: async (formData) =>
      (
        await fetch(`${BASE}/api/comments`, {
          method: "POST",
          body: formData, // multipart/form-data for text + photo
        })
      ).json(),
  },
  recipe: async (meal) =>
    (await fetch(`${BASE}/api/recipe/${encodeURIComponent(meal)}`)).json(),
};

/** ====== helpers ====== */
const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
const toYMD = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfWeekMon = (date) => {
  const d = new Date(date);
  const day = d.getDay(); // 0 Sun..6 Sat
  const diff = (day === 0 ? -6 : 1) - day; // move to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};
const addDays = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};

/** ====== Component ====== */
export default function App() {
  const [users, setUsers] = useState(["Adam", "Mike"]);
  const [weekStart, setWeekStart] = useState(startOfWeekMon(new Date()));
  const [tasks, setTasks] = useState([]);
  const [comments, setComments] = useState([]);

  // add form
  const [form, setForm] = useState({
    title: "",
    assignee: "Adam",
    date: toYMD(new Date()),
    type: "Dinner",
  });

  // comment form
  const [commentForm, setCommentForm] = useState({
    date: toYMD(new Date()),
    name: "",
    isAnonymous: false,
    text: "",
    photoFile: null,
  });

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );
  const range = { start: toYMD(weekDays[0]), end: toYMD(weekDays[6]) };

  const refreshTasks = async () => setTasks(await api.chores.list(range));
  const refreshComments = async () => {
    try {
      const all = await api.comments.list();
      setComments(all || []);
    } catch {
      setComments([]);
    }
  };

  useEffect(() => {
    api
      .users()
      .then(setUsers)
      .catch(() => {});
    refreshTasks();
    refreshComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  /** CRUD task */
  const addTask = async (e) => {
    e.preventDefault();
    if (!form.date) return alert("Pick a date!");
    const payload = {
      ...form,
      title:
        form.title || (form.type === "Dinner" ? "Dinner" : "Untitled Task"),
      done: false,
    };
    const result = await api.chores.create(payload);
    if (result?.error) return alert(result.error);
    setForm((f) => ({ ...f, title: "", date: f.date }));
    await refreshTasks();
  };

  const toggleDone = async (t) => {
    await api.chores.update(t.id, { done: !t.done });
    await refreshTasks();
  };

  const remove = async (id) => {
    if (!confirm("Delete this item?")) return;
    await api.chores.remove(id);
    await refreshTasks();
  };

  /** Make-your-own day (NoDinner), capped 4 per current week */
  const makeOwnDay = async (date) => {
    const start = range.start;
    const end = range.end;
    const countThisWeek = tasks.filter(
      (t) => t.type === "NoDinner" && t.date >= start && t.date <= end
    ).length;
    if (countThisWeek >= 4) {
      alert("Limit: only 4 'Make your own' days allowed per week.");
      return;
    }
    const res = await api.chores.create({
      date,
      type: "NoDinner",
      title: "Make your own",
    });
    if (res?.error) alert(res.error);
    await refreshTasks();
  };

  /** Comments */
  const submitComment = async (e) => {
    e.preventDefault();
    if (!commentForm.text?.trim() && !commentForm.photoFile) {
      return alert("Write a comment or add a photo.");
    }

    const formData = new FormData();
    formData.append("date", commentForm.date);
    formData.append("name", commentForm.isAnonymous ? "" : commentForm.name);
    formData.append("isAnonymous", commentForm.isAnonymous);
    formData.append("text", commentForm.text);
    if (commentForm.photoFile) {
      if (commentForm.photoFile.size > 3 * 1024 * 1024) {
        return alert("Image too large. Max 3 MB.");
      }
      formData.append("photo", commentForm.photoFile);
    }

    try {
      const saved = await api.comments.create(formData);
      if (saved?.error) {
        alert(saved.error);
      } else {
        setComments((prev) => [saved, ...prev]);
        setCommentForm((f) => ({
          ...f,
          text: "",
          name: "",
          isAnonymous: false,
          photoFile: null,
        }));
        alert("Comment posted!");
      }
    } catch {
      alert("Comments API not available on server.");
    }
  };

  /** Get Recipe for a meal name (uses backend recipe proxy) */
  const getRecipe = async (mealTitle) => {
    const q = (mealTitle || "Dinner").trim();
    try {
      const data = await api.recipe(q);
      if (data?.strMeal) {
        const pieces = [];
        pieces.push(`🍽 ${data.strMeal}`);
        if (data.strArea) pieces.push(`(${data.strArea})`);
        if (data.strCategory) pieces.push(`• ${data.strCategory}`);
        const head = pieces.join(" ");
        const steps = data.strInstructions
          ? data.strInstructions.slice(0, 500) +
            (data.strInstructions.length > 500 ? "..." : "")
          : "No instructions provided.";
        alert(`${head}\n\n${steps}`);
      } else {
        alert("No recipe found.");
      }
    } catch {
      alert("Recipe lookup failed.");
    }
  };

  /** ====== Derived views ====== */
  const tasksByDate = useMemo(() => {
    const map = {};
    for (const d of weekDays) map[toYMD(d)] = [];
    for (const t of tasks) {
      if (!map[t.date]) map[t.date] = [];
      map[t.date].push(t);
    }
    return map;
  }, [tasks, weekDays]);

  const dinnersThisWeek = useMemo(() => {
    const count = { Adam: 0, Mike: 0 };
    tasks
      .filter((t) => t.type === "Dinner" && t.done)
      .forEach((t) => {
        if (count[t.assignee] != null) count[t.assignee]++;
      });
    return count;
  }, [tasks]);

  const dinnersAssigned = useMemo(() => {
    const count = { Adam: 0, Mike: 0 };
    tasks
      .filter((t) => t.type === "Dinner")
      .forEach((t) => {
        if (count[t.assignee] != null) count[t.assignee]++;
      });
    return count;
  }, [tasks]);

  const targetPerPerson = 2;
  const noDinnerCountThisWeek = useMemo(() => {
    const start = range.start;
    const end = range.end;
    return tasks.filter(
      (t) => t.type === "NoDinner" && t.date >= start && t.date <= end
    ).length;
  }, [tasks, range.start, range.end]);
  const noDinnerDisabled = noDinnerCountThisWeek >= 4;

  /** comments grouped by date for display */
  const commentsByDate = useMemo(() => {
    const map = {};
    for (const c of comments) {
      const key = c.date || "";
      if (!key) continue;
      if (!map[key]) map[key] = [];
      map[key].push(c);
    }
    return map;
  }, [comments]);

  /** ====== UI ====== */
  return (
    <div className="wrap">
      <header className="header">
        <h1>🗓️ Chores – Weekly Calendar</h1>
        {/* Week navigation... */}
      </header>

      {/* Overview ... */}

      {/* Add task ... */}

      {/* Comments */}
      <section className="card">
        <h2>💬 Leave a Comment (optional photo)</h2>
        <div className="grid-4">
          <label>
            Date
            <input
              type="date"
              value={commentForm.date}
              onChange={(e) =>
                setCommentForm({ ...commentForm, date: e.target.value })
              }
            />
          </label>
          <label>
            Name (optional)
            <input
              placeholder="Your name"
              value={commentForm.name}
              onChange={(e) =>
                setCommentForm({ ...commentForm, name: e.target.value })
              }
              disabled={commentForm.isAnonymous}
            />
          </label>
          <label className="checkline">
            <input
              type="checkbox"
              checked={commentForm.isAnonymous}
              onChange={(e) =>
                setCommentForm({
                  ...commentForm,
                  isAnonymous: e.target.checked,
                })
              }
            />
            Post as anonymous
          </label>
          <label>
            Photo (optional)
            <input
              type="file"
              accept="image/*"
              onChange={(e) =>
                setCommentForm({
                  ...commentForm,
                  photoFile: e.target.files?.[0] || null,
                })
              }
            />
          </label>
        </div>

        <label>
          Comment
          <textarea
            placeholder="What did you think? Any notes about dinner?"
            value={commentForm.text}
            onChange={(e) =>
              setCommentForm({ ...commentForm, text: e.target.value })
            }
          />
        </label>

        <button className="btn" onClick={submitComment}>
          Post Comment
        </button>
      </section>

      {/* Calendar ... */}
    </div>
  );
}
