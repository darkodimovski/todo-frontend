import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getTodos } from "../services/api";
import { getEstimates, formatHours } from "../services/estimates";

const DAY = 86400000;
const TZ = "Europe/Zagreb";
const isoToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
const isoAdd = (iso, n) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * DAY).toISOString().slice(0, 10);
const mondayOf = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return isoAdd(iso, -((d.getUTCDay() + 6) % 7));
};
const fmt = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
const updatedIso = (t) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(t.updatedAt));

export default function Report() {
  const [todos, setTodos] = useState([]);
  const [estimates, setEstimates] = useState({});
  const [weekOffset, setWeekOffset] = useState(0);
  const [error, setError] = useState("");
  const [open, setOpen] = useState({}); // expanded people

  useEffect(() => {
    Promise.all([getTodos(), getEstimates().catch(() => ({}))])
      .then(([res, w]) => {
        setTodos(res.data?.data || []);
        setEstimates(w || {});
      })
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
      if (!people.has(name))
        people.set(name, {
          name,
          done: 0,
          donePts: 0,
          open: 0,
          openPts: 0,
          overdue: 0,
          overduePts: 0,
          upcoming: 0,
          doneItems: [],
          overdueItems: [],
        });
      return people.get(name);
    };
    let unrated = 0;

    for (const t of todos) {
      const est = estimates[t.documentId];
      const hasEst = est !== undefined && est !== null;
      const pts = hasEst ? Number(est) : 0; // hours
      const weight = hasEst ? est : null;
      const r = row(t.assignee?.username || "Unassigned");
      const item = { ...t, weight, pts };

      if (t.position === "done") {
        const d = updatedIso(t);
        if (d >= weekStart && d <= weekEnd) {
          r.done++;
          r.donePts += pts;
          r.doneItems.push({ ...item, doneOn: d });
          if (!weight) unrated++;
        }
        continue;
      }
      r.open++;
      r.openPts += pts;
      if (!weight) unrated++;
      if (t.position !== "review" && t.dueDate && t.dueDate < asOf) {
        r.overdue++;
        r.overduePts += pts;
        r.overdueItems.push(item);
      } else if (t.dueDate && t.dueDate <= isoAdd(asOf, 6)) {
        r.upcoming++;
      }
    }

    const rows = [...people.values()]
      .filter((r) => r.done || r.open)
      .sort((a, b) => b.donePts - a.donePts || b.overduePts - a.overduePts || a.name.localeCompare(b.name));
    rows.forEach((r) => {
      r.doneItems.sort((a, b) => b.pts - a.pts || a.doneOn.localeCompare(b.doneOn));
      r.overdueItems.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    });

    const total = rows.reduce(
      (acc, r) => {
        for (const k of ["done", "donePts", "open", "openPts", "overdue", "overduePts", "upcoming"]) acc[k] += r[k];
        return acc;
      },
      { done: 0, donePts: 0, open: 0, openPts: 0, overdue: 0, overduePts: 0, upcoming: 0 }
    );
    return { rows, total, unrated };
  }, [todos, estimates, weekStart, weekEnd, asOf]);

  const title = `Team report ${fmt(weekStart)} – ${fmt(weekEnd)}${weekEnd.slice(0, 4)}`;
  const tableHead = ["Person", "Done (h)", "Done (ToDos)", "Open (h)", "Overdue (h)", "Due next 7 days"];
  const r1 = (n) => Math.round(n * 10) / 10;
  const tableBody = report.rows.map((r) => [r.name, r1(r.donePts), r.done, r1(r.openPts), r1(r.overduePts), r.upcoming]);
  const totalRow = [
    "Total",
    r1(report.total.donePts),
    report.total.done,
    r1(report.total.openPts),
    r1(report.total.overduePts),
    report.total.upcoming,
  ];

  const doneList = report.rows.flatMap((r) =>
    r.doneItems.map((t) => [r.name, t.title, t.project?.name || "", t.weight ?? "–", t.doneOn])
  );
  const overdueList = report.rows.flatMap((r) =>
    r.overdueItems.map((t) => [r.name, t.title, t.project?.name || "", t.weight ?? "–", t.dueDate])
  );

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([tableHead, ...tableBody, totalRow]), "Summary");
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([["Person", "ToDo", "Project", "Est. hours", "Done on"], ...doneList]),
      "Done"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([["Person", "ToDo", "Project", "Est. hours", "Due"], ...overdueList]),
      "Overdue"
    );
    XLSX.writeFile(wb, `team-report-${weekStart}.xlsx`);
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(title, 14, 16);
    doc.setFontSize(9);
    doc.text("Hours are the manager's estimates per ToDo (ToDos without an estimate count as 0 h).", 14, 22);
    autoTable(doc, { startY: 26, head: [tableHead], body: [...tableBody, totalRow], styles: { fontSize: 9 } });
    const section = (label, head, body) => {
      if (!body.length) return;
      doc.setFontSize(12);
      doc.text(label, 14, doc.lastAutoTable.finalY + 10);
      autoTable(doc, { startY: doc.lastAutoTable.finalY + 14, head: [head], body, styles: { fontSize: 8 } });
    };
    section("Done this week", ["Person", "ToDo", "Project", "Est. h", "Done on"], doneList);
    section("Overdue", ["Person", "ToDo", "Project", "Est. h", "Due"], overdueList);
    doc.save(`team-report-${weekStart}.pdf`);
  };

  const Stat = ({ label, value, sub, tone }) => (
    <div className={`p-3 sm:p-4 rounded-lg shadow-md text-center ${tone}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs sm:text-sm mt-1 font-medium">{label}</div>
      {sub && <div className="text-xs opacity-80">{sub}</div>}
    </div>
  );

  const WeightBadge = ({ w }) => (
    <span
      className={`inline-block min-w-[42px] text-center text-xs font-semibold px-1.5 py-0.5 rounded border ${
        w != null ? "bg-blue-100 text-blue-800 border-transparent" : "text-gray-500"
      }`}
      title={w != null ? "Estimated hours" : "No estimate (counts as 0 h)"}
    >
      {w != null ? formatHours(w) : "– h"}
    </span>
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <Stat label="Done this week" value={formatHours(report.total.donePts)} sub={`${report.total.done} ToDos`} tone="bg-green-100 text-green-800" />
        <Stat label="Overdue" value={formatHours(report.total.overduePts)} sub={`${report.total.overdue} ToDos`} tone="bg-red-100 text-red-800" />
        <Stat label="Due next 7 days" value={report.total.upcoming} sub="ToDos" tone="bg-yellow-100 text-yellow-800" />
        <Stat label="Open workload" value={formatHours(report.total.openPts)} sub={`${report.total.open} ToDos`} tone="bg-blue-100 text-blue-800" />
      </div>

      <p className="text-xs text-gray-500 mb-4">
        Hours are your estimates per ToDo – set them on the Todos page ("Est. h", only managers see it).
        {report.unrated > 0 && (
          <span className="text-yellow-600"> {report.unrated} ToDo(s) in this report have no estimate yet and count as 0 h.</span>
        )}
      </p>

      <div className="bg-white rounded border overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-600 border-b">
              {tableHead.map((h, i) => (
                <th key={h} className={`p-3 font-semibold ${i ? "text-right" : ""} whitespace-nowrap`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.rows.map((r) => (
              <React.Fragment key={r.name}>
                <tr
                  className="border-b cursor-pointer hover:bg-gray-50"
                  onClick={() => setOpen((o) => ({ ...o, [r.name]: !o[r.name] }))}
                >
                  <td className="p-3 font-medium whitespace-nowrap">
                    <span className="text-gray-400 mr-1">{open[r.name] ? "▾" : "▸"}</span>
                    {r.name}
                  </td>
                  <td className="p-3 text-right font-semibold">{r1(r.donePts)}</td>
                  <td className="p-3 text-right">{r.done}</td>
                  <td className="p-3 text-right">{r1(r.openPts)}</td>
                  <td className={`p-3 text-right ${r.overdue ? "text-red-600 font-semibold" : ""}`}>{r1(r.overduePts)}</td>
                  <td className="p-3 text-right">{r.upcoming}</td>
                </tr>
                {open[r.name] && (
                  <tr className="border-b bg-gray-50">
                    <td colSpan={tableHead.length} className="p-3">
                      {r.doneItems.length === 0 ? (
                        <p className="text-xs text-gray-500">Nothing done this week.</p>
                      ) : (
                        <ul className="space-y-1">
                          {r.doneItems.map((t) => (
                            <li key={t.id} className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                              <WeightBadge w={t.weight} />
                              <span className="font-medium break-words">{t.title}</span>
                              {t.project?.name && <span className="text-gray-500">· {t.project.name}</span>}
                              <span className="text-gray-500 ml-auto">done {fmt(t.doneOn)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
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
          {report.rows.flatMap((r) =>
            r.overdueItems.map((t) => (
              <li key={t.id} className="bg-white border rounded p-2 flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 break-words flex items-center gap-2">
                  <WeightBadge w={t.weight} />
                  <strong>{t.title}</strong>
                  {t.project?.name && <span className="text-gray-500"> · {t.project.name}</span>}
                </span>
                <span className="text-gray-600 shrink-0">
                  {r.name} · <span className="text-red-600">due {t.dueDate}</span>
                </span>
              </li>
            ))
          )}
        </ul>
      )}

      <p className="text-xs text-gray-500 mt-6">
        Click a person to see what they finished. "Done this week" counts ToDos marked done whose last change falls in
        the week. Managers also get a summary notification every Friday at 15:00.
      </p>
    </div>
  );
}
