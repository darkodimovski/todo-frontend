import { api } from "./http";

/** Estimated hours per ToDo (managers only). { [documentId]: hours } */
export const getEstimates = async () => (await api.get("/todo-estimates")).data || {};

export const setEstimate = (documentId, hours) => api.put(`/todo-estimates/${documentId}`, { data: { hours } });

/** "1.5 h", "12 h" – one decimal at most. */
export const formatHours = (h) => `${Math.round((Number(h) || 0) * 10) / 10} h`;
