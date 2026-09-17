import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { ExplainLaw } from "./pages/ExplainLaw";
import { Ask } from "./pages/Ask";
import { ReviewDocument } from "./pages/ReviewDocument";
import { CrossCheck } from "./pages/CrossCheck";
import { StressTest } from "./pages/StressTest";
import { Settings } from "./pages/Settings";
import { NotFound } from "./pages/NotFound";
import { Privacy } from "./pages/Privacy";
import { Terms } from "./pages/Terms";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="/explain-law" element={<ExplainLaw />} />
          <Route path="/ask" element={<Ask />} />
          <Route path="/review-document" element={<ReviewDocument />} />
          <Route path="/cross-check" element={<CrossCheck />} />
          <Route path="/stress-test" element={<StressTest />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
