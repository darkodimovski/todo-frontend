import React, { useEffect, useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import axios from "axios";
import { getTodos } from "../services/api";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:1337";

export default function Kanban() {
  const [todos, setTodos] = useState({
    todo: [],
    "in-progress": [],
    done: [],
  });

  const fetchTodos = async () => {
    try {
      const res = await getTodos();
      const rawTodos = res?.data?.data || [];

      const grouped = rawTodos.reduce(
        (acc, todo) => {
          const pos = todo.position || "todo";
          const cleanTodo = {
            id: todo.id,
            title: todo.title,
            dueDate: todo.dueDate,
            position: todo.position,
            documentId: todo.documentId,
            projects: todo.projects?.data || [],
            assignee: todo.assignee || null,
            ...todo.attributes,
          };
          if (acc[pos]) acc[pos].push(cleanTodo);
          else console.warn("Unknown position:", pos, cleanTodo);
          return acc;
        },
        { todo: [], "in-progress": [], done: [] }
      );

      setTodos(grouped);
    } catch (err) {
      console.error("❌ Failed to fetch todos:", err);
    }
  };

  useEffect(() => {
    fetchTodos();
  }, []);

  const columns = [
    { key: "todo", label: "To Do" },
    { key: "in-progress", label: "In Progress" },
    { key: "done", label: "Done" },
  ];

  const handleDragEnd = async (result) => {
    const { source, destination, draggableId } = result;

    if (!destination || source.droppableId === destination.droppableId) return;

    const todoDocumentId = draggableId;
    const allTodos = Object.values(todos).flat();
    const draggedTodo = allTodos.find((todo) => todo.documentId === todoDocumentId);

    if (!draggedTodo) {
      console.error("❌ Could not find draggedTodo in state:", todoDocumentId);
      return;
    }

    try {
      const newPosition = destination.droppableId;
      const url = `${API_URL}/api/todos/${todoDocumentId}`;

      await axios.put(url, {
        data: { position: newPosition },
      });

      fetchTodos();
    } catch (err) {
      console.error("🔥 Failed to update todo position:", err?.response?.data || err);
    }
  };

  const getColorClass = (position) => {
    switch (position) {
      case "done":
        return "bg-green-100 border-green-300";
      case "in-progress":
        return "bg-blue-100 border-blue-300";
      default:
        return "bg-red-100 border-red-300";
    }
  };

  const getTopBorderClass = (position) => {
    switch (position) {
      case "done":
        return "border-t-4 border-green-400";
      case "in-progress":
        return "border-t-4 border-blue-400";
      default:
        return "border-t-4 border-red-400";
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">🗂️ Kanban Board</h2>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {columns.map((col) => (
            <Droppable droppableId={col.key} key={col.key}>
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`bg-gray-100 rounded p-4 min-h-[300px] ${getTopBorderClass(col.key)}`}
                >
                  <h3 className="text-xl font-semibold mb-4">{col.label}</h3>
                  <div className="space-y-4">
                    {todos[col.key]?.map((todo, index) => (
                      <Draggable
                        draggableId={String(todo.documentId)}
                        index={index}
                        key={todo.documentId}
                      >
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`p-4 border shadow rounded ${getColorClass(todo.position)}`}
                          >
                            <h4 className="font-semibold mb-1">{todo.title}</h4>
                            <span className="inline-block text-xs font-semibold px-2 py-1 rounded-full bg-white border text-gray-700 mb-1">
                              {todo.position.replace("-", " ")}
                            </span>
                            <p className="text-sm text-gray-600">
                              Due: {todo.dueDate || "N/A"}
                            </p>
                            {todo.assignee && (
                              <p className="text-sm text-gray-700 italic mt-1">
                                👤 {todo.assignee.username}
                              </p>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
