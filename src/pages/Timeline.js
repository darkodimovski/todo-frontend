import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  format,
  addDays,
  addMonths,
  subMonths,
  differenceInCalendarDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  eachDayOfInterval,
  isWeekend,
  isSameDay,
  parseISO,
  isValid,
  max as maxDate,
  min as minDate,
} from "date-fns";
import {
  Box,
  Typography,
  IconButton,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip,
  Modal,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  LinearProgress,
  Chip,
} from "@mui/material";
import { alpha, useTheme as useMuiTheme } from "@mui/material/styles";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { getProjects, getClients, getTodos } from "../services/api";

const VIEWS = {
  "2w": { label: "2 weeks", dayWidth: 56 },
  month: { label: "Month", dayWidth: 34 },
  quarter: { label: "3 months", dayWidth: 12 },
};

const STATUS_LABEL = {
  todo: "Todo",
  "in-progress": "In progress",
  review: "In review",
  done: "Done",
  "no-todos": "No ToDos",
};

const toDate = (value) => {
  if (!value) return null;
  const d = typeof value === "string" ? parseISO(value) : new Date(value);
  return isValid(d) ? d : null;
};

const fmt = (d) => (d ? format(d, "d MMM yyyy") : "—");

export default function Timeline() {
  const theme = useMuiTheme();
  const isDark = theme.palette.mode === "dark";

  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("quarter");
  const [anchor, setAnchor] = useState(() => startOfMonth(new Date()));
  const [clientFilter, setClientFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const scrollRef = useRef(null);

  const today = useMemo(() => new Date(), []);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [projectRes, clientRes, todoRes] = await Promise.all([
        getProjects(),
        getClients(),
        getTodos(),
      ]);
      const todos = todoRes.data.data;

      const enriched = projectRes.data.data.map((project) => {
        const related = todos.filter((t) => t.project?.id === project.id);
        const done = related.filter((t) => t.position === "done").length;

        let status = "no-todos";
        if (related.length && done === related.length) status = "done";
        else if (related.some((t) => t.position === "in-progress" || t.position === "review")) status = "in-progress";
        else if (related.some((t) => t.position === "todo")) status = "todo";

        return {
          ...project,
          status,
          todos: related,
          doneCount: done,
          progress: related.length ? Math.round((done / related.length) * 100) : 0,
          start: toDate(project.startDate),
          end: toDate(project.endDate),
        };
      });

      setProjects(enriched);
      setClients(clientRes.data.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // ----- visible range -----
  const [rangeStart, rangeEnd] = useMemo(() => {
    if (view === "2w") {
      const s = startOfWeek(anchor, { weekStartsOn: 1 });
      return [s, addDays(s, 13)];
    }
    if (view === "month") return [startOfMonth(anchor), endOfMonth(anchor)];
    return [startOfMonth(anchor), endOfMonth(addMonths(anchor, 2))];
  }, [view, anchor]);

  const days = useMemo(
    () => eachDayOfInterval({ start: rangeStart, end: rangeEnd }),
    [rangeStart, rangeEnd]
  );
  const dayWidth = VIEWS[view].dayWidth;
  const trackWidth = days.length * dayWidth;
  const labelWidth = { xs: 140, sm: 260 };

  const months = useMemo(() => {
    const out = [];
    days.forEach((d) => {
      const key = format(d, "yyyy-MM");
      const last = out[out.length - 1];
      if (last?.key === key) last.days++;
      else out.push({ key, label: format(d, view === "quarter" ? "MMMM yyyy" : "MMMM yyyy"), days: 1 });
    });
    return out;
  }, [days, view]);

  const todayInRange = today >= rangeStart && today <= addDays(rangeEnd, 1);
  const todayOffset = differenceInCalendarDays(today, rangeStart) * dayWidth + dayWidth / 2;

  // scroll so that today is visible when the range changes
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = todayInRange ? Math.max(0, todayOffset - el.clientWidth / 3) : 0;
  }, [todayInRange, todayOffset, view]);

  // ----- navigation -----
  const step = (dir) => {
    if (view === "2w") setAnchor((a) => addDays(a, dir * 14));
    else setAnchor((a) => (dir > 0 ? addMonths(a, 1) : subMonths(a, 1)));
  };
  const goToday = () => setAnchor(view === "2w" ? today : startOfMonth(today));

  // ----- colours -----
  const statusColor = (status) => {
    const map = isDark
      ? { done: "#2f7d57", "in-progress": "#5f7489", review: "#a07a2a", todo: "#b9472f", "no-todos": "#4a4a4a" }
      : { done: "#16a34a", "in-progress": "#2563eb", review: "#ca8a04", todo: "#dc2626", "no-todos": "#9ca3af" };
    return map[status] || map["no-todos"];
  };
  const gridLine = theme.palette.divider;
  const weekendBg = alpha(theme.palette.text.primary, isDark ? 0.04 : 0.035);

  // ----- filtering -----
  const filtered = projects
    .filter((p) => clientFilter === "All" || p.clients?.some((c) => c.documentId === clientFilter))
    .filter((p) => statusFilter === "All" || p.status === statusFilter);

  const inRange = filtered
    .filter((p) => p.start && p.end && p.end >= rangeStart && p.start <= rangeEnd)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const noDates = filtered.filter((p) => !p.start || !p.end);
  const outside = filtered.length - inRange.length - noDates.length;

  const rangeLabel =
    view === "month"
      ? format(rangeStart, "MMMM yyyy")
      : `${format(rangeStart, rangeStart.getFullYear() === rangeEnd.getFullYear() ? "d MMM" : "d MMM yyyy")} – ${format(rangeEnd, "d MMM yyyy")}`;

  const clientNames = (p) => (p.clients || []).map((c) => c.Client).filter(Boolean);

  return (
    <Box px={{ xs: 0, sm: 3 }} py={{ xs: 1, sm: 3 }}>
      {/* ---------- header ---------- */}
      <Box display="flex" flexWrap="wrap" alignItems="center" justifyContent="space-between" gap={1.5} mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <IconButton size="small" onClick={() => step(-1)} aria-label="Previous">
            <ChevronLeftIcon />
          </IconButton>
          <Typography variant="h6" sx={{ minWidth: { sm: 220 }, textAlign: "center", fontSize: { xs: 16, sm: 20 } }}>
            {rangeLabel}
          </Typography>
          <IconButton size="small" onClick={() => step(1)} aria-label="Next">
            <ChevronRightIcon />
          </IconButton>
          <Button size="small" variant="outlined" onClick={goToday} sx={{ ml: 0.5 }}>
            Today
          </Button>
        </Box>

        <Box display="flex" flexWrap="wrap" alignItems="center" gap={1}>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={view}
            onChange={(_, v) => v && setView(v)}
          >
            {Object.entries(VIEWS).map(([key, v]) => (
              <ToggleButton key={key} value={key} sx={{ px: 1.5, textTransform: "none" }}>
                {v.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
              <MenuItem value="All">All</MenuItem>
              {Object.entries(STATUS_LABEL).map(([k, l]) => (
                <MenuItem key={k} value={k}>{l}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Client</InputLabel>
            <Select value={clientFilter} label="Client" onChange={(e) => setClientFilter(e.target.value)}>
              <MenuItem value="All">All clients</MenuItem>
              {clients.map((c) => (
                <MenuItem key={c.documentId} value={c.documentId}>{c.Client}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {/* ---------- legend ---------- */}
      <Box display="flex" flexWrap="wrap" alignItems="center" gap={2} mb={1.5} fontSize={12} color="text.secondary">
        {Object.entries(STATUS_LABEL).map(([k, l]) => (
          <Box key={k} display="flex" alignItems="center" gap={0.75}>
            <Box width={12} height={12} borderRadius={0.5} bgcolor={statusColor(k)} />
            {l}
          </Box>
        ))}
        <Box display="flex" alignItems="center" gap={0.75}>
          <Box width={2} height={14} bgcolor="error.main" />
          Today
        </Box>
        <Box ml="auto">
          {inRange.length} in this period
          {outside > 0 && ` · ${outside} outside`}
          {noDates.length > 0 && ` · ${noDates.length} without dates`}
        </Box>
      </Box>

      {/* ---------- gantt ---------- */}
      <Paper variant="outlined" sx={{ overflow: "hidden" }}>
        <Box ref={scrollRef} sx={{ overflowX: "auto", position: "relative" }}>
          <Box sx={{ minWidth: { xs: 140 + trackWidth, sm: 260 + trackWidth } }}>
            {/* months row */}
            <Box display="flex" sx={{ borderBottom: 1, borderColor: "divider" }}>
              <StickyCell width={labelWidth} header>
                <Typography variant="caption" fontWeight={600} color="text.secondary">
                  Project
                </Typography>
              </StickyCell>
              {months.map((m) => (
                <Box
                  key={m.key}
                  width={m.days * dayWidth}
                  flexShrink={0}
                  px={1}
                  py={0.75}
                  sx={{ borderLeft: 1, borderColor: "divider", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden" }}
                >
                  {m.label}
                </Box>
              ))}
            </Box>

            {/* days row */}
            <Box display="flex" sx={{ borderBottom: 1, borderColor: "divider" }}>
              <StickyCell width={labelWidth} header />
              {days.map((d) => {
                const showLabel = view !== "quarter" || d.getDay() === 1;
                const isToday = isSameDay(d, today);
                return (
                  <Box
                    key={d.toISOString()}
                    width={dayWidth}
                    flexShrink={0}
                    textAlign="center"
                    py={0.5}
                    sx={{
                      fontSize: 10,
                      lineHeight: 1.2,
                      color: isToday ? "error.main" : "text.secondary",
                      fontWeight: isToday ? 700 : 400,
                      bgcolor: isWeekend(d) && view !== "quarter" ? weekendBg : "transparent",
                      borderLeft: view === "quarter" ? (d.getDay() === 1 ? `1px solid ${gridLine}` : "none") : `1px solid ${gridLine}`,
                      overflow: "visible",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {showLabel && (
                      <>
                        {view !== "quarter" && <div>{format(d, "EEEEE")}</div>}
                        <div>{format(d, "d")}</div>
                      </>
                    )}
                  </Box>
                );
              })}
            </Box>

            {/* rows */}
            <Box position="relative">
              {/* weekend shading + today line behind the bars */}
              <Box
                position="absolute"
                top={0}
                bottom={0}
                sx={{ left: labelWidth, width: trackWidth, pointerEvents: "none" }}
              >
                {view !== "quarter" &&
                  days.map((d, i) =>
                    isWeekend(d) ? (
                      <Box key={i} position="absolute" top={0} bottom={0} left={i * dayWidth} width={dayWidth} bgcolor={weekendBg} />
                    ) : null
                  )}
                {todayInRange && (
                  <Box position="absolute" top={0} bottom={0} left={todayOffset - 1} width={2} bgcolor="error.main" zIndex={2} sx={{ opacity: 0.85 }} />
                )}
              </Box>

              {loading && <Box p={3}><LinearProgress /></Box>}

              {!loading && inRange.length === 0 && (
                <Box p={4} textAlign="center" color="text.secondary" fontSize={14}>
                  No projects in this period.
                  {outside > 0 && " Use the arrows or a longer view to see the others."}
                </Box>
              )}

              {inRange.map((p) => {
                const s = maxDate([p.start, rangeStart]);
                const e = minDate([p.end, rangeEnd]);
                const left = differenceInCalendarDays(s, rangeStart) * dayWidth;
                const width = Math.max(dayWidth, (differenceInCalendarDays(e, s) + 1) * dayWidth);
                const cutLeft = p.start < rangeStart;
                const cutRight = p.end > rangeEnd;
                const color = statusColor(p.status);
                const names = clientNames(p);

                return (
                  <Box
                    key={p.documentId}
                    display="flex"
                    alignItems="stretch"
                    sx={{
                      borderBottom: 1,
                      borderColor: "divider",
                      cursor: "pointer",
                      "&:hover .tl-label p:first-of-type": { color: "primary.main" },
                    }}
                    onClick={() => setSelected(p)}
                  >
                    <StickyCell width={labelWidth} className="tl-label">
                      <Typography fontSize={13} fontWeight={600} noWrap title={p.name}>
                        {p.name}
                      </Typography>
                      <Typography fontSize={11} color="text.secondary" noWrap title={names.join(", ")}>
                        {names.length > 3 ? `${names.slice(0, 2).join(", ")} +${names.length - 2}` : names.join(", ") || "No client"}
                      </Typography>
                    </StickyCell>

                    <Box position="relative" width={trackWidth} flexShrink={0} height={48}>
                      <Tooltip
                        arrow
                        placement="top"
                        title={
                          <Box fontSize={12}>
                            <b>{p.name}</b>
                            <div>{fmt(p.start)} → {fmt(p.end)}</div>
                            <div>{STATUS_LABEL[p.status]} · {p.doneCount}/{p.todos.length} ToDos done</div>
                          </Box>
                        }
                      >
                        <Box
                          position="absolute"
                          top={12}
                          height={24}
                          left={left}
                          width={width}
                          zIndex={1}
                          sx={{
                            bgcolor: alpha(color, isDark ? 0.45 : 0.25),
                            border: `1px solid ${color}`,
                            borderRadius: 1,
                            borderTopLeftRadius: cutLeft ? 0 : 4,
                            borderBottomLeftRadius: cutLeft ? 0 : 4,
                            borderTopRightRadius: cutRight ? 0 : 4,
                            borderBottomRightRadius: cutRight ? 0 : 4,
                            overflow: "hidden",
                            display: "flex",
                            alignItems: "center",
                            "&:hover": { filter: "brightness(1.1)" },
                          }}
                        >
                          {/* progress fill */}
                          <Box position="absolute" top={0} bottom={0} left={0} width={`${p.progress}%`} bgcolor={color} />
                          <Box
                            px={0.75}
                            fontSize={11}
                            fontWeight={600}
                            whiteSpace="nowrap"
                            color={isDark ? "#fff" : p.progress > 40 ? "#fff" : "text.primary"}
                            sx={{
                              // keep the bar's label in view when the bar starts left of the scroll position
                              position: "sticky",
                              left: labelWidth,
                              textShadow: isDark || p.progress > 40 ? "0 1px 1px rgba(0,0,0,.35)" : "none",
                            }}
                          >
                            {cutLeft && "‹ "}
                            {width > 90 ? `${p.name} · ${p.progress}%` : width > 36 ? `${p.progress}%` : ""}
                            {cutRight && " ›"}
                          </Box>
                        </Box>
                      </Tooltip>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Box>
      </Paper>

      {noDates.length > 0 && (
        <Typography mt={1.5} fontSize={12} color="text.secondary">
          Without start/end date: {noDates.map((p) => p.name).join(", ")}
        </Typography>
      )}

      {/* ---------- details ---------- */}
      <Modal open={!!selected} onClose={() => setSelected(null)}>
        <Paper
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: { xs: "calc(100% - 32px)", sm: 460 },
            maxHeight: "90vh",
            overflowY: "auto",
            p: { xs: 2, sm: 3 },
            borderRadius: 2,
          }}
        >
          {selected && (
            <>
              <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                <Box width={12} height={12} borderRadius={0.5} bgcolor={statusColor(selected.status)} />
                <Typography variant="h6" fontSize={18}>{selected.name}</Typography>
              </Box>
              {selected.description && (
                <Typography fontSize={13} color="text.secondary" mb={1.5}>{selected.description}</Typography>
              )}

              <Box display="grid" gridTemplateColumns="auto 1fr" columnGap={2} rowGap={0.5} fontSize={13} mb={2}>
                <Box color="text.secondary">Period</Box>
                <Box>{fmt(selected.start)} → {fmt(selected.end)}</Box>
                <Box color="text.secondary">Status</Box>
                <Box>{STATUS_LABEL[selected.status]}</Box>
                <Box color="text.secondary">Clients</Box>
                <Box>{clientNames(selected).join(", ") || "—"}</Box>
              </Box>

              <Box display="flex" justifyContent="space-between" fontSize={13} mb={0.5}>
                <span>Progress</span>
                <span>{selected.doneCount}/{selected.todos.length} ToDos · {selected.progress}%</span>
              </Box>
              <LinearProgress
                variant="determinate"
                value={selected.progress}
                sx={{ height: 8, borderRadius: 1, mb: 2, "& .MuiLinearProgress-bar": { bgcolor: statusColor(selected.status) } }}
              />

              {selected.todos.length > 0 ? (
                <Box display="flex" flexDirection="column" gap={0.75}>
                  {selected.todos.map((t) => (
                    <Box key={t.id} display="flex" alignItems="center" justifyContent="space-between" gap={1} fontSize={13}>
                      <Box minWidth={0}>
                        <Box sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</Box>
                        <Box fontSize={11} color="text.secondary">
                          {t.assignee?.username || "Unassigned"}{t.dueDate ? ` · due ${t.dueDate}` : ""}
                        </Box>
                      </Box>
                      <Chip
                        size="small"
                        label={STATUS_LABEL[t.position] || t.position || "todo"}
                        sx={{ bgcolor: statusColor(t.position || "todo"), color: "#fff", flexShrink: 0 }}
                      />
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography fontSize={13} color="text.secondary">No ToDos linked to this project.</Typography>
              )}

              <Box textAlign="right" mt={2}>
                <Button onClick={() => setSelected(null)}>Close</Button>
              </Box>
            </>
          )}
        </Paper>
      </Modal>
    </Box>
  );
}

/** Left column cell that stays visible while the timeline scrolls sideways. */
function StickyCell({ width, header, children, className }) {
  return (
    <Box
      className={className}
      sx={{
        width,
        minWidth: width,
        flexShrink: 0,
        position: "sticky",
        left: 0,
        zIndex: 3,
        bgcolor: "background.paper",
        borderRight: 1,
        borderColor: "divider",
        px: 1.5,
        py: header ? 0.75 : 0.5,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        transition: "background-color .15s",
      }}
    >
      {children}
    </Box>
  );
}
