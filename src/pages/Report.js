import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getTodos } from "../services/api";

const DAY = 86400000;
const isoToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zagreb" }).format(new Date());
const isoAdd = (iso, n) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * DAY).toISOString().slice(0, 10);
const mondayOf = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return isoAdd(iso, -((d.getUTCDay() + 6) % 7));
};
const fmt = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
const updatedIso = (t) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zagreb" }).format(new Date(t.updatedAt));

export default function Report() {
  const [todos, setTodos] = useState([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    getTodos()
      .then((res) => setTodos(res.data?.data || []))
      .catch(() => setError("Failed to load ToDos."));
  }, []);

  const today = isoToday();
  const weekStart = isoAdd(mondayOf(today), weekOffset * 7);
  const weekEnd = isoAdd(weekStart, 6);
  // "overdue"/"open" are as of the end of the selected week (or today for the current week)
  const asOf = weekOffset === 0 ? today : isoAdd(weekEnd, 1);

  const report = useMemo(() => {
    const people = new Map();
    const row = (name) => {
      if (!people.has(name)) people.set(name, { name, done: 0, open: 0, overdue: 0, upcoming: 0, overdueItems: [] });
      return people.get(name);
    };

    for (const t of todos) {
      const r = row(t.assignee?.username || "Unassigned");
      if (t.position === "done") {
        const d = updatedIso(t);
        if (d >= weekStart && d <= weekEnd) r.done++;
        continue;
      }
      r.open++;
      if (t.dueDate && t.dueDate < asOf) {
        r.overdue++;
        r.overdueItems.push(t);
      } else if (t.dueDate && t.dueDate <= isoAdd(asOf, 6)) {
        r.upcoming++;
      }
    }

    const rows = [...people.values()]
      .filter((r) => r.done || r.open)
      .sort((a, b) => b.overdue - a.overdue || b.open - a.open || a.name.localeCompare(b.name));
    const total = rows.reduce(
      (acc, r) => ({
        done: acc.done + r.done,
        open: acc.open + r.open,
        overdue: acc.overdue + r.overdue,
        upcoming: acc.upcoming + r.upcoming,
      }),
      { done: 0, open: 0, overdue: 0, upcoming: 0 }
    );
    return { rows, total };
  }, [todos, weekStart, weekEnd, asOf]);

  const title = `Team report ${fmt(weekStart)} – ${fmt(weekEnd)}${weekEnd.slice(0, 4)}`;
  const tableHead = ["Person", "Done this week", "Open", "Overdue", "Due next 7 days"];
  const tableBody = report.rows.map((r) => [r.name, r.done, r.open, r.overdue, r.upcoming]);
  const totalRow = ["Total", report.total.done, report.total.open, report.total.overdue, report.total.upcoming];

  const overdueList = report.rows.flatMap((r) =>
    r.overdueItems
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map((t) => [r.name, t.title, t.project?.name || "", t.dueDate])
  );

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([tableHead, ...tableBody, totalRow]), "Summary");
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([["Person", "ToDo", "Project", "Due"], ...overdueList]),
      "Overdue"
    );
    XLSX.writeFile(wb, `team-report-${weekStart}.xlsx`);
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(title, 14, 16);
    autoTable(doc, { startY: 22, head: [tableHead], body: [...tableBody, totalRow], styles: { fontSize: 9 } });
    if (overdueList.length) {
      doc.setFontSize(12);
      doc.text("Overdue ToDos", 14, doc.lastAutoTable.finalY + 10);
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 14,
        head: [["Person", "ToDo", "Project", "Due"]],
        body: overdueList,
        styles: { fontSize: 8 },
      });
    }
    doc.save(`team-report-${weekStart}.pdf`);
  };

  const Stat = ({ label, value, tone }) => (
    <div className={`p-3 sm:p-4 rounded-lg shadow-md text-center ${tone}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs sm:text-sm mt-1 font-medium">{label}</div>
    </div>
  );

  return (
    <div className="py-2 sm:p-6">
      <div className="mb-4 flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset((w) => w - 1)} className="px-2 py-1 rounded hover:bg-gray-200" aria-label="Previous week">
            ‹
          </button>
          <h2 className="text-lg sm:text-2xl font-semibold">{title}</h2>
          <button
            onClick={() => setWeekOffset((w) => Math.min(0, w + 1))}
            disabled={weekOffset === 0}
            className="px-2 py-1 rounded hover:bg-gray-200 disabled:opacity-30"
            aria-label="Next week"
          >
            ›
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={exportExcel} className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 text-sm">
            Excel
          </button>
          <button onClick={exportPdf} className="bg-gray-800 text-white px-3 py-2 rounded hover:bg-gray-900 text-sm">
            PDF
          </button>
        </div>
      </div>

      {error && <div className="mb-4 p-2 rounded bg-red-100 text-red-700 text-sm">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Stat label="Done this week" value={report.total.done} tone="bg-green-100 text-green-800" />
        <Stat label="Overdue" value={report.total.overdue} tone="bg-red-100 text-red-800" />
        <Stat label="Due next 7 days" value={report.total.upcoming} tone="bg-yellow-100 text-yellow-800" />
        <Stat label="Open" value={report.total.open} tone="bg-blue-100 text-blue-800" />
      </div>

      <div className="bg-white rounded border overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-600 border-b">
              {tableHead.map((h, i) => (
                <th key={h} className={`p-3 font-semibold ${i ? "text-right" : ""}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.rows.map((r) => (
              <tr key={r.name} className="border-b">
                <td className="p-3 font-medium">{r.name}</td>
                <td className="p-3 text-right">{r.done}</td>
                <td className="p-3 text-right">{r.open}</td>
                <td className={`p-3 text-right ${r.overdue ? "text-red-600 font-semibold" : ""}`}>{r.overdue}</td>
                <td className="p-3 text-right">{r.upcoming}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              {totalRow.map((v, i) => (
                <td key={i} className={`p-3 ${i ? "text-right" : ""}`}>{v}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <h3 className="text-lg font-semibold mb-2">Overdue ToDos</h3>
      {overdueList.length === 0 ? (
        <p className="text-sm text-gray-500">Nothing overdue. 🎉</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {overdueList.map(([who, t, project, due], i) => (
            <li key={i} className="bg-white border rounded p-2 flex flex-wrap justify-between gap-2">
              <span className="min-w-0 break-words">
                <strong>{t}</strong>
                {project && <span className="text-gray-500"> · {project}</span>}
              </span>
              <span className="text-gray-600 shrink-0">
                {who} · <span className="text-red-600">due {due}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-gray-500 mt-6">
        "Done this week" counts ToDos marked done whose last change falls in the week. Managers also get this summary
        as a notification every Friday at 15:00.
      </p>
    </div>
  );
}
