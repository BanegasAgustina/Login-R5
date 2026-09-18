import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./style.css";
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
// Este archivo es el punto de entrada de la aplicación React.
//  Importa los módulos necesarios, incluyendo React, ReactDOM y 
// el componente principal App. Luego, utiliza createRoot para 
// renderizar el componente App dentro del elemento con id "root" 
// en el DOM, envolviéndolo en StrictMode para ayudar a identificar 
// problemas potenciales en la aplicación.