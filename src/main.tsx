import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import "./index.css";
import { Toaster } from "@/components/ui/sonner";
import { Layout } from "@/components/layout";
import { VehiclesPage } from "@/pages/vehicles";
import { VehiclePage } from "@/pages/vehicle";
import { ModelsPage } from "@/pages/models";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<VehiclesPage />} />
          <Route path="models" element={<ModelsPage />} />
        </Route>
        <Route path="vehicles/:id" element={<VehiclePage />} />
      </Routes>
    </BrowserRouter>
    <Toaster position="top-center" richColors />
  </StrictMode>,
);
