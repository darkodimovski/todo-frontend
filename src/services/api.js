import { api as API } from "./http";

export const getProjects = () =>
  API.get("/projects?pagination[pageSize]=1000&populate=*");

export const getTodos = async () => {
  const pageSize = 100;
  let page = 1;
  let allTodos = [];

  while (true) {
    const res = await API.get(
      `/todos?pagination[page]=${page}&pagination[pageSize]=${pageSize}&populate=*`
    );
    const data = res.data?.data || [];
    allTodos = [...allTodos, ...data];

    const pagination = res.data?.meta?.pagination;
    if (!pagination || page >= pagination.pageCount) break;
    page++;
  }

  return { data: { data: allTodos } };
};

export const getTeamMembers = () => API.get("/team-members");

export const getClients = () =>
  API.get("/clients?pagination[pageSize]=1000&populate=*");

