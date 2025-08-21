import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:1337";

const API = axios.create({ baseURL: `${API_URL}/api` });

export const getProjects = () =>
  API.get("/projects?pagination[pageSize]=1000&populate=*");

export const getTodos = () =>
  API.get("/todos?pagination[pageSize]=1000&populate=*");

export const getTeamMembers = () => API.get("/team-members");

export const getClients = () =>
  API.get("/clients?pagination[pageSize]=1000&populate=*");
