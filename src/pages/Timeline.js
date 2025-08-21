import { useEffect, useState, useCallback } from "react";
import {
  format,
  addDays,
  differenceInDays,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths
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
  Chip,
  LinearProgress,
  Modal,
  Paper
} from "@mui/material";
import ArrowBackIosIcon from "@mui/icons-material/ArrowBackIos";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import { getProjects, getClients, getTodos } from "../services/api";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";

const Timeline = () => {
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [zoom, setZoom] = useState(1);
  const [view, setView] = useState("month");
  const [referenceDate, setReferenceDate] = useState(new Date());
  const today = new Date();
  const [clientFilter, setClientFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [expandedClients, setExpandedClients] = useState({});
  const [selectedProject, setSelectedProject] = useState(null);

  // ✅ stable fetch function
  const fetchAllData = useCallback(async () => {
    const [projectRes, clientRes, todoRes] = await Promise.all([
      getProjects(),
      getClients(),
      getTodos(),
    ]);

    const fetchedTodos = todoRes.data.data;

    const fetchedProjects = projectRes.data.data.map((project) => {
      const relatedTodos = fetchedTodos.filter((todo) => todo.project?.id === project.id);
      const allDone = relatedTodos.length > 0 && relatedTodos.every((todo) => todo.position === "done");
      const anyInProgress = relatedTodos.some((todo) => todo.position === "in-progress");
      const anyTodo = relatedTodos.some((todo) => todo.position === "todo");

      let newPosition = "no-todos";
      if (allDone) newPosition = "done";
      else if (anyInProgress) newPosition = "in-progress";
      else if (anyTodo) newPosition = "todo";

      const completed = relatedTodos.filter(t => t.position === "done").length;
      const progress = relatedTodos.length > 0 ? Math.round((completed / relatedTodos.length) * 100) : 0;

      return { ...project, position: newPosition, todos: relatedTodos, progress };
    });

    setProjects(fetchedProjects);
    setClients(clientRes.data.data);
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const getVisibleRange = () => {
    return view === "month"
      ? [startOfMonth(referenceDate), endOfMonth(referenceDate)]
      : [addDays(referenceDate, -7), addDays(referenceDate, 7)];
  };

  const [minDate, maxDate] = getVisibleRange();
  const totalDays = Math.max(1, differenceInDays(maxDate, minDate));
  const maxTimelineWidth = 1000;
  const pixelsPerDay = (maxTimelineWidth / totalDays) * zoom;
  const todayOffset = Math.max(0, differenceInDays(today, minDate));

  const getBarColor = (position = "") => {
    const map = {
      done: "#22c55e",
      "in-progress": "#3b82f6",
      todo: "#ef4444",
      "no-todos": "#9ca3af"
    };
    return map[position.toLowerCase()] || "#d1d5db";
  };

  const getDuration = (start, end) => Math.max(1, differenceInDays(new Date(end), new Date(start)));
  const getOffset = (start) => Math.max(0, differenceInDays(new Date(start), minDate));

  const handleNavigation = (direction) => {
    const newDate =
      view === "month"
        ? direction === "prev"
          ? subMonths(referenceDate, 1)
          : addMonths(referenceDate, 1)
        : addDays(referenceDate, direction === "prev" ? -7 : 7);
    setReferenceDate(newDate);
  };

  const handleZoom = (factor) => setZoom((prev) => Math.max(0.5, Math.min(prev + factor, 3)));
  const handleViewChange = (e) => setView(e.target.value);
  const toggleClient = (clientId) => {
    setExpandedClients(prev => ({ ...prev, [clientId]: !prev[clientId] }));
  };

  const filteredProjects = projects.filter((proj) => {
    const matchesClient = clientFilter === "All" || proj.clients?.some(c => c.documentId === clientFilter);
    const matchesStatus = statusFilter === "All" || proj.position === statusFilter.toLowerCase();
    return matchesClient && matchesStatus;
  });

  const projectsByClient = clients.reduce((acc, client) => {
    const clientProjects = filteredProjects.filter(p => p.clients?.some(c => c.documentId === client.documentId));
    if (clientProjects.length > 0) acc.push({ client, projects: clientProjects });
    return acc;
  }, []);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box p={3}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={2}>
          <Typography variant="h6">📊 Project Timeline</Typography>
          <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
            <IconButton onClick={() => handleNavigation("prev")}> <ArrowBackIosIcon fontSize="small" /></IconButton>
            <IconButton onClick={() => handleNavigation("next")}> <ArrowForwardIosIcon fontSize="small" /></IconButton>
            <DatePicker
              label="Jump to date"
              value={referenceDate}
              onChange={(newValue) => newValue && setReferenceDate(newValue)}
              slotProps={{ textField: { size: "small" } }}
            />
            <Button onClick={() => setReferenceDate(today)} variant="outlined" size="small"><CalendarMonthIcon fontSize="small" /></Button>
            <Button onClick={() => handleZoom(-0.25)} size="small">➖</Button>
            <Button onClick={() => handleZoom(0.25)} size="small">➕</Button>
            <FormControl size="small">
              <InputLabel>View</InputLabel>
              <Select value={view} onChange={handleViewChange} label="View">
                <MenuItem value="month">Month</MenuItem>
                <MenuItem value="week">Week</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small">
              <InputLabel>Status</InputLabel>
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} label="Status">
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="todo">Todo</MenuItem>
                <MenuItem value="in-progress">In Progress</MenuItem>
                <MenuItem value="done">Done</MenuItem>
                <MenuItem value="no-todos">No ToDos</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small">
              <InputLabel>Client</InputLabel>
              <Select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} label="Client">
                <MenuItem value="All">All</MenuItem>
                {clients.map((client) => (
                  <MenuItem key={client.documentId} value={client.documentId}>{client.Client}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Box>

        <Box overflow="auto">
          <Box minWidth={maxTimelineWidth}>
            <Box display="flex" fontSize={10} fontWeight={500} mb={1}>
              {Array.from({ length: totalDays + 1 }, (_, i) => addDays(minDate, i)).map((date, index) => (
                <Box
                  key={index}
                  textAlign="center"
                  borderRight="1px solid #e5e7eb"
                  minWidth={pixelsPerDay}
                >
                  {format(date, "MMM d")}
                </Box>
              ))}
            </Box>

            <Box position="relative">
              <Box
                position="absolute"
                top={0}
                bottom={0}
                width={2}
                bgcolor="red"
                zIndex={10}
                left={`${todayOffset * pixelsPerDay}px`}
              />

              {projectsByClient.map(({ client, projects }) => (
                <Box key={client.documentId} mb={3}>
                  <Typography
                    fontWeight={600}
                    fontSize={14}
                    mb={1}
                    sx={{ cursor: "pointer" }}
                    onClick={() => toggleClient(client.documentId)}
                  >
                    {expandedClients[client.documentId] ? "▼" : "▶"} {client.Client}
                  </Typography>
                  {expandedClients[client.documentId] && projects.map((proj) => {
                    const { id, name, position = "no-todos", startDate, endDate, todos, progress } = proj;
                    if (!startDate || !endDate) return null;
                    const duration = getDuration(startDate, endDate);
                    const offset = getOffset(startDate);
                    return (
                      <Box key={id} mb={2} onClick={() => setSelectedProject(proj)}>
                        <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                          <Typography fontSize={12} fontWeight={500}>{name}</Typography>
                          <Chip label={position} size="small" sx={{ textTransform: 'capitalize', backgroundColor: getBarColor(position), color: "#fff" }} />
                        </Box>
                        <Box position="relative" height={24} bgcolor="#f1f5f9" borderRadius={1}>
                          <Tooltip
                            title={
                              todos?.length
                                ? todos.map((todo) => `${todo.title} (${todo.position})`).join(" • ")
                                : "No ToDos"
                            }
                            arrow
                            placement="top"
                          >
                            <Box
                              position="absolute"
                              left={`${offset * pixelsPerDay}px`}
                              width={`${duration * pixelsPerDay}px`}
                              height="100%"
                              display="flex"
                              alignItems="center"
                              px={1}
                              borderRadius={1}
                              fontSize={10}
                              fontWeight={600}
                              color="white"
                              sx={{ backgroundColor: getBarColor(position), cursor: "pointer", '&:hover': { opacity: 0.9 } }}
                            >
                              {progress > 0 && (
                                <Box width="100%">
                                  <LinearProgress
                                    variant="determinate"
                                    value={progress}
                                    sx={{
                                      height: 8,
                                      borderRadius: 1,
                                      backgroundColor: 'rgba(255,255,255,0.2)',
                                      '& .MuiLinearProgress-bar': { backgroundColor: '#fff' }
                                    }}
                                  />
                                </Box>
                              )}
                            </Box>
                          </Tooltip>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        <Modal
          open={!!selectedProject}
          onClose={() => setSelectedProject(null)}
          aria-labelledby="project-modal-title"
          aria-describedby="project-modal-description"
        >
          <Paper
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              minWidth: 400,
              p: 4,
              borderRadius: 2,
              boxShadow: 24
            }}
          >
            {selectedProject && (
              <>
                <Typography id="project-modal-title" variant="h6" mb={2}>
                  {selectedProject.name}
                </Typography>
                <Typography>Status: <strong>{selectedProject.position}</strong></Typography>
                <Typography>Progress: {selectedProject.progress}%</Typography>
                <Typography>Start: {selectedProject.startDate}</Typography>
                <Typography>End: {selectedProject.endDate}</Typography>
                <Typography mt={2}>ToDos:</Typography>
                <ul>
                  {selectedProject.todos?.map(todo => (
                    <li key={todo.id}>{todo.title} ({todo.position})</li>
                  ))}
                </ul>
              </>
            )}
          </Paper>
        </Modal>
      </Box>
    </LocalizationProvider>
  );
};

export default Timeline;
