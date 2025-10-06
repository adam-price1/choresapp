import React, { useEffect, useMemo, useState } from "react";

const BASE = import.meta.env.VITE_API_URL || "";

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
};

const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
const toYMD = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfWeekMon = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
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

  const refreshTasks = async () => setTasks(await api.chores.list(range));

  useEffect(() => {
    api.users().then(setUsers);
    refreshTasks();
  }, [weekStart]);

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

  const makeOwnDay = async (date) => {
    const countThisWeek = tasks.filter(
      (t) =>
        t.type === "NoDinner" && t.date >= range.start && t.date <= range.end
    ).length;
    if (countThisWeek >= 4) {
      alert("Limit: only 4 'Make your own' days allowed per week.");
      return;
    }
    await api.chores.create({
      date,
      type: "NoDinner",
      title: "Make your own",
    });
    await refreshTasks();
  };

  const tasksByDate = useMemo(() => {
    const map = {};
    for (const d of weekDays) map[toYMD(d)] = [];
    for (const t of tasks) {
      if (!map[t.date]) map[t.date] = [];
      map[t.date].push(t);
    }
    return map;
  }, [tasks, weekDays]);

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
          >
            Make your own
          </button>
        </div>
      </form>

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
                        <button className="x" onClick={() => remove(t.id)}>
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
