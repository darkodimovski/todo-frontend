import axios from "axios";

const API = axios.create({ baseURL: "http://localhost:1337/api" });

export const getProjects = () => API.get("/projects?pagination[pageSize]=1000&populate=*");
export const getTodos = () => API.get("/todos?pagination[pageSize]=1000&populate=*");
export const getTeamMembers = () => API.get("/team-members");
export const getClients = () => API.get("/clients?pagination[pageSize]=1000&populate=*");
