import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { BrowserRouter as Router } from "react-router-dom";
import './index.css';
import "./services/http"; // attaches the JWT to every API request
import { registerServiceWorker } from "./services/push";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <App />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);

registerServiceWorker();
