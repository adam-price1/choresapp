import React, { useEffect, useMemo, useState } from "react";

/** ====== Config ====== */
const BASE = import.meta.env.VITE_API_URL || ""; // e.g. https://choresapp-backend.onrender.com
const CLOUD_NAME = import.meta.env.VITE_CLOUD_NAME || "";
const CLOUD_PRESET = import.meta.env.VITE_CLOUD_PRESET || "";

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
    create: async (payload) =>
      (
        await fetch(`${BASE}/api/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
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

/** optional image upload via Cloudinary (unsigned) */
async function uploadPhotoToCloudinary(file) {
  if (!CLOUD_NAME || !CLOUD_PRESET) {
    throw new Error(
      "Image upload not configured. Set VITE_CLOUD_NAME and VITE_CLOUD_PRESET."
    );
  }
  const data = new FormData();
  data.append("file", file);
  data.append("upload_preset", CLOUD_PRESET);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: data }
  );
  if (!res.ok) throw new Error("Upload failed");
  const json = await res.json();
  return json.secure_url;
}

/** ====== Component ====== */
export default function App() {
  const [users, setUsers] = useState(["Adam", "Mike"]);
  const [weekStart, setWeekStart] = useState(startOfWeekMon(new Date()));
  const [tasks, setTasks] = useState([]);
  const [comments, setComments] = useState([]); // {id, date, name?, isAnonymous, text, photo, createdAt}

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
    let photoUrl = null;
    try {
      if (commentForm.photoFile) {
        if (commentForm.photoFile.size > 3 * 1024 * 1024) {
          return alert("Image too large. Max 3 MB.");
        }
        photoUrl = await uploadPhotoToCloudinary(commentForm.photoFile);
      }
    } catch (err) {
      alert(err.message || "Photo upload failed.");
      return;
    }
    const payload = {
      date: commentForm.date,
      name: commentForm.isAnonymous ? "" : commentForm.name?.trim(),
      isAnonymous: !!commentForm.isAnonymous,
      text: (commentForm.text || "").trim(),
      photo: photoUrl,
    };
    try {
      const saved = await api.comments.create(payload);
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

  const targetPerPerson = 2; // UPDATED goal
  const remaining = {
    Adam: Math.max(0, targetPerPerson - (dinnersThisWeek.Adam || 0)),
    Mike: Math.max(0, targetPerPerson - (dinnersThisWeek.Mike || 0)),
  };

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
        <div className="week-nav">
          <button onClick={() => setWeekStart(addDays(weekStart, -7))}>
            ◀ Prev
          </button>
          <div>
            {toYMD(weekDays[0])} – {toYMD(weekDays[6])}
          </div>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))}>
            Next ▶
          </button>
          <button onClick={() => setWeekStart(startOfWeekMon(new Date()))}>
            This Week
          </button>
        </div>
      </header>

      {/* Overview */}
      <section className="card">
        <h2>Weekly Dinner Overview</h2>
        <div className="overview-grid">
          {["Adam", "Mike"].map((name) => {
            const done = dinnersThisWeek[name] ?? 0;
            const assigned = dinnersAssigned[name] ?? 0;
            const target = targetPerPerson;
            const left = Math.max(0, target - done);
            const pct = Math.min(100, Math.round((done / target) * 100));
            const initials = name.slice(0, 1).toUpperCase();

            return (
              <div className="stat-card" key={name}>
                <div className="stat-top">
                  <div className="avatar">{initials}</div>
                  <div className="who">
                    <div className="name">{name}</div>
                    <div className="meta">
                      <span className="chip chip-soft">
                        target: <b>{target}</b>
                      </span>
                      <span className="chip chip-soft">
                        assigned: <b>{assigned}</b>
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  className="progress-wrap"
                  title={`${done}/${target} dinners done`}
                >
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="progress-label">
                    <b>{done}</b>/<span>{target}</span> dinners done
                  </div>
                </div>

                <div className="stat-foot">
                  <span
                    className={`chip ${left ? "chip-warn" : "chip-success"}`}
                  >
                    left: <b>{left}</b>
                  </span>
                  {done >= target ? (
                    <span className="chip chip-success">Goal met ✅</span>
                  ) : (
                    <span className="chip chip-info">Keep going 💪</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="pill-row">
          <span className="pill">
            Make-your-own days used this week: <b>{noDinnerCountThisWeek}</b>/4
          </span>
          {!CLOUD_NAME || !CLOUD_PRESET ? (
            <span
              className="pill warn"
              title="Set VITE_CLOUD_NAME and VITE_CLOUD_PRESET to enable photo upload"
            >
              Photo upload not configured
            </span>
          ) : (
            <span className="pill ok">Photo upload ready</span>
          )}
        </div>
      </section>

      {/* Add task */}
      <form className="card" onSubmit={addTask}>
        <h2>Add to calendar</h2>
        <div className="grid-4">
          <label>
            Type
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option>Dinner</option>
              <option>Other</option>
            </select>
          </label>

          <label>
            Title
            <input
              placeholder={
                form.type === "Dinner" ? "Dinner" : "e.g., Do Dishes"
              }
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>

          <label>
            Assign to
            <select
              value={form.assignee}
              onChange={(e) => setForm({ ...form, assignee: e.target.value })}
              disabled={form.type === "NoDinner"}
            >
              {users.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>

          <label>
            Date
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </label>
        </div>

        <div className="row">
          <button className="btn">Add</button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => makeOwnDay(form.date)}
            disabled={noDinnerDisabled}
            title={
              noDinnerDisabled
                ? "Limit reached: 4 'Make your own' days per week"
                : "Create a 'Make your own' day (no dinner duty) for the selected date"
            }
          >
            Make your own
          </button>
        </div>
      </form>

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

      {/* Calendar */}
      <section className="card">
        <h2>Week</h2>
        <div className="calendar">
          {weekDays.map((d) => {
            const ymd = toYMD(d);
            const dayTasks = (tasksByDate[ymd] || []).sort((a, b) =>
              a.type.localeCompare(b.type)
            );
            const isToday = toYMD(new Date()) === ymd;
            const dayComments = commentsByDate[ymd] || [];

            return (
              <div className={`day ${isToday ? "today" : ""}`} key={ymd}>
                <div className="day-head">
                  <div className="dow">
                    {d.toLocaleDateString(undefined, { weekday: "short" })}
                  </div>
                  <div className="date">{d.getDate()}</div>
                </div>

                {/* Badge for NoDinner */}
                {dayTasks.some((t) => t.type === "NoDinner") && (
                  <div className="badge nodin">Make your own</div>
                )}

                <div className="list">
                  {dayTasks
                    .filter((t) => t.type !== "NoDinner")
                    .map((t) => (
                      <div
                        className={`item ${
                          t.type === "Dinner" ? "dinner" : ""
                        }`}
                        key={t.id}
                      >
                        <label className="check">
                          <input
                            type="checkbox"
                            checked={!!t.done}
                            onChange={() => toggleDone(t)}
                          />
                          <span className={t.done ? "done" : ""}>
                            {t.type === "Dinner" ? "🍽️ " : "• "}
                            {t.title} — <b>{t.assignee}</b>
                          </span>
                        </label>
                        <div className="item-actions">
                          {t.type === "Dinner" && (
                            <button
                              className="chip chip-info"
                              onClick={() => getRecipe(t.title || "Dinner")}
                              title="Get a recipe suggestion"
                            >
                              Get recipe
                            </button>
                          )}
                          <button
                            className="x"
                            onClick={() => remove(t.id)}
                            title="Delete"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                </div>

                {/* Comments for this day */}
                {dayComments.length > 0 && (
                  <div className="comments">
                    {dayComments.map((c) => (
                      <div className="comment" key={c.id}>
                        <div className="comment-head">
                          <b>
                            {c.isAnonymous ? "Anonymous" : c.name || "Unnamed"}
                          </b>
                          <span className="comment-time">
                            {c.createdAt
                              ? new Date(c.createdAt).toLocaleString()
                              : ""}
                          </span>
                        </div>
                        {c.text && <div className="comment-text">{c.text}</div>}
                        {c.photo && (
                          <a href={c.photo} target="_blank" rel="noreferrer">
                            <img
                              className="comment-photo"
                              src={c.photo}
                              alt="upload"
                            />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
