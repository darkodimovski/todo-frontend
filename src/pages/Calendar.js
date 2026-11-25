import React, { useContext, useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import { AuthContext } from "../context/AuthContext";
import { getTodos } from "../services/api";

const STATUS = {
  todo: { label: "Todo", className: "cal-todo" },
  "in-progress": { label: "In progress", className: "cal-progress" },
  review: { label: "In review", className: "cal-review" },
  done: { label: "Done", className: "cal-done" },
};

const isoToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zagreb" }).format(new Date());

export default function Calendar() {
  const { user } = useContext(AuthContext);
  const [todos, setTodos] = useState([]);
  const [mineOnly, setMineOnly] = useState(true);
  const [showDone, setShowDone] = useState(false);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [narrow, setNarrow] = useState(() => window.innerWidth < 640);

  useEffect(() => {
    getTodos()
      .then((res) => setTodos(res.data?.data || []))
      .catch(() => setError("Failed to load ToDos."));
  }, []);

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const today = isoToday();

  const events = useMemo(
    () =>
      todos
        .filter((t) => t.dueDate)
        .filter((t) => !mineOnly || t.assignee?.id === user?.id)
        .filter((t) => showDone || t.position !== "done")
        .map((t) => {
          const status = STATUS[t.position] || STATUS.todo;
          const overdue = !["done", "review"].includes(t.position) && t.dueDate < today;
          return {
            id: String(t.id),
            title: t.title,
            start: t.dueDate,
            allDay: true,
            classNames: ["cal-event", status.className, overdue ? "cal-overdue" : ""],
            extendedProps: { todo: t, overdue },
          };
        }),
    [todos, mineOnly, showDone, user?.id, today]
  );

  return (
    <div className="py-2 sm:p-6">
      <div className="mb-4 flex flex-wrap justify-between items-center gap-3">
        <h2 className="text-xl sm:text-2xl font-semibold">Calendar</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          <div className="flex rounded-full border overflow-hidden">
            {[
              [true, "Mine"],
              [false, "Everyone"],
            ].map(([value, label]) => (
              <button
                key={label}
                type="button"
                onClick={() => setMineOnly(value)}
                className={`px-3 py-1.5 ${mineOnly === value ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 px-2">
            <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
            Show done
          </label>
        </div>
      </div>

      {error && <div className="mb-4 p-2 rounded bg-red-100 text-red-700 text-sm">{error}</div>}

      <div className="flex flex-wrap gap-4 text-xs text-gray-600 mb-3">
        <span className="flex items-center gap-1.5"><span className="cal-dot cal-todo" /> Todo</span>
        <span className="flex items-center gap-1.5"><span className="cal-dot cal-progress" /> In progress</span>
        <span className="flex items-center gap-1.5"><span className="cal-dot cal-review" /> In review</span>
        <span className="flex items-center gap-1.5"><span className="cal-dot cal-done" /> Done</span>
        <span className="flex items-center gap-1.5"><span className="cal-dot cal-todo cal-overdue-dot" /> Overdue</span>
      </div>

      <div className="bg-white rounded border p-2 sm:p-4 calendar-wrap">
        <FullCalendar
          plugins={[dayGridPlugin]}
          initialView={narrow ? "dayGridWeek" : "dayGridMonth"}
          key={narrow ? "week" : "month"}
          firstDay={1}
          height="auto"
          dayMaxEvents={narrow ? false : 3}
          headerToolbar={{ left: "prev,next today", center: "title", right: narrow ? "" : "dayGridMonth,dayGridWeek" }}
          buttonText={{ today: "Today", month: "Month", week: "Week" }}
          events={events}
          eventClick={(info) => setSelected(info.event.extendedProps.todo)}
        />
      </div>

      {selected && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 z-50 flex justify-center items-start sm:items-center p-3 sm:p-6 overflow-y-auto"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white w-full max-w-md rounded-lg shadow-lg p-4 sm:p-6 relative my-4 sm:my-0"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelected(null)}
              className="absolute top-2 right-2 w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-700 text-2xl"
            >
              &times;
            </button>
            <h3 className="text-lg font-semibold pr-8 break-words">{selected.title}</h3>
            <div className="text-xs text-gray-500 mt-1">
              Due {selected.dueDate} · {STATUS[selected.position]?.label || "Todo"}
              {!["done", "review"].includes(selected.position) && selected.dueDate < today && (
                <span className="text-red-600 font-semibold"> · overdue</span>
              )}
            </div>
            <div className="text-sm mt-1 text-gray-700">
              {selected.project?.name || "No project"} · {selected.assignee?.username || "Unassigned"}
            </div>
            {selected.description && (
              <p className="text-sm text-gray-600 mt-3 whitespace-pre-line break-words">{selected.description}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
