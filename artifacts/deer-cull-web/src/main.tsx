import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerServiceWorker } from "@/lib/offlineMap";

registerServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);
