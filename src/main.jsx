import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

/* ============================================================
   SERVICE WORKER
   ============================================================ */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });

      console.log(
        "Dental notification service worker registered:",
        registration.scope
      );
    } catch (error) {
      console.error(
        "Dental notification service worker registration failed:",
        error
      );
    }
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);