import React, { useEffect, useMemo, useState } from "react";

/** Base API URL from Vite env */
const BASE = import.meta.env.VITE_API_URL || ""; // e.g. https://api.websitebuildexample4.online

const api = {
  users: async () => (await fetch(`${BASE}/api/users`)).json(),
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
};

/** helpers **/
const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
const toYMD = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfWeekMon = (date) => {
  const d = new Date(date);
  const day = d.getDay();
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

export default function App() {
  const [users, setUsers] = useState(["Adam", "Mike"]);
  const [weekStart, setWeekStart] = useState(startOfWeekMon(new Date()));
  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState({
    title: "",
    assignee: "Adam",
    date: toYMD(new Date()),
    type: "Dinner",
  });

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );
  const range = { start: toYMD(weekDays[0]), end: toYMD(weekDays[6]) };

  const refresh = async () => setTasks(await api.list(range));

  useEffect(() => {
    api
      .users()
      .then(setUsers)
      .catch(() => {});
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  const addTask = async (e) => {
    e.preventDefault();
    if (!form.date) return alert("Pick a date!");

    const payload = {
      ...form,
      title:
        form.title || (form.type === "Dinner" ? "Dinner" : "Untitled Task"),
    };
    const result = await api.create(payload);
    if (result?.error) return alert(result.error);

    setForm((f) => ({ ...f, title: "", date: f.date }));
    await refresh();
  };

  const toggleDone = async (t) => {
    await api.update(t.id, { done: !t.done });
    await refresh();
  };

  const remove = async (id) => {
    if (!confirm("Delete this item?")) return;
    await api.remove(id);
    await refresh();
  };

  const makeOwnDay = async (date) => {
    const count = tasks.filter((t) => t.type === "NoDinner").length;
    if (count >= 2) {
      alert("Limit reached: only 2 'Make your own' days allowed per week.");
      return;
    }
    const res = await api.create({ date, type: "NoDinner" });
    if (res?.error) alert(res.error);
    await refresh();
  };

  /** derived views **/
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

  const targetPerPerson = 3;
  const remaining = {
    Adam: Math.max(0, targetPerPerson - dinnersThisWeek.Adam),
    Mike: Math.max(0, targetPerPerson - dinnersThisWeek.Mike),
  };

  const noDinnerCount = tasks.filter((t) => t.type === "NoDinner").length;
  const noDinnerDisabled = noDinnerCount >= 2;

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
            const target = 3;
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
                form.type === "Dinner" ? "Dinner" : "e.g., Vacuum lounge"
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

        <button className="btn">Add</button>
        <button
          type="button"
          className="btn ghost"
          onClick={() => makeOwnDay(form.date)}
          disabled={noDinnerDisabled}
          title={
            noDinnerDisabled
              ? "Limit reached: only 2 'Make your own' days per week"
              : "Create a 'Make your own' day (no dinner duty) on selected date"
          }
        >
          Make your own
        </button>
      </form>

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
                        <button
                          className="x"
                          onClick={() => remove(t.id)}
                          title="Delete"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
