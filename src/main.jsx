import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { Puerta } from "./nube/Puerta.jsx";
import "./index.css";
import { traducirPantalla } from "./i18n/index.js";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Puerta>{(usuario) => <App usuario={usuario} />}</Puerta>
  </React.StrictMode>
);
// En inglés, cada texto que React dibuja se cambia por su traducción (ver i18n/index.js)
traducirPantalla();
