import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./styles.css";
import { SessionProvider } from "./session";
import { RewardsProvider } from "./components/rewards";
import { KidShell, ParentShell } from "./components/Shells";
import { Landing, Login, Register } from "./pages/Public";
import { ChildSettings, ParentDashboard } from "./pages/Parent";
import { BuildGame, Create, Explore, KidHome, Learn, MakeApp } from "./pages/Kid";
import { ProjectStudio } from "./pages/Project";
import { Creations, Detective, Missions, PassportPage } from "./pages/Progress";
import { SharePage } from "./pages/SharePage";

const kid = (el: React.ReactNode) => <KidShell>{el}</KidShell>;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SessionProvider>
      <RewardsProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/parent" element={<ParentShell><ParentDashboard /></ParentShell>} />
            <Route path="/parent/child/:id" element={<ParentShell><ChildSettings /></ParentShell>} />
            <Route path="/kid" element={kid(<KidHome />)} />
            <Route path="/kid/explore" element={kid(<Explore />)} />
            <Route path="/kid/learn" element={kid(<Learn />)} />
            <Route path="/kid/create" element={kid(<Create />)} />
            <Route path="/kid/build" element={kid(<BuildGame />)} />
            <Route path="/kid/apps" element={kid(<MakeApp />)} />
            <Route path="/kid/project/:id" element={kid(<ProjectStudio />)} />
            <Route path="/kid/missions" element={kid(<Missions />)} />
            <Route path="/kid/passport" element={kid(<PassportPage />)} />
            <Route path="/kid/creations" element={kid(<Creations />)} />
            <Route path="/kid/detective" element={kid(<Detective />)} />
            <Route path="/s/:token" element={<SharePage />} />
            <Route path="/p/:who/:slug" element={<SharePage />} />
            <Route path="*" element={<main className="container center"><h1>🛸 Lost in space</h1><a href="/">Go home</a></main>} />
          </Routes>
        </BrowserRouter>
      </RewardsProvider>
    </SessionProvider>
  </StrictMode>,
);
