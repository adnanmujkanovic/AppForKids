import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./styles.css";
import { SessionProvider } from "./session";
import { RewardsProvider } from "./components/rewards";
import { KidShell, ParentShell } from "./components/Shells";
import { Landing, Login, Register } from "./pages/Public";
import { Loading } from "./components/ui";
import { BuildGame, Create, Explore, KidHome, Learn, MakeApp } from "./pages/Kid";

import { Creations, Detective, Missions, PassportPage } from "./pages/Progress";
// Heavier screens load on demand so the first screen appears fast on phones.
const ParentDashboard = lazy(() => import("./pages/Parent").then((m) => ({ default: m.ParentDashboard })));
const ChildSettings = lazy(() => import("./pages/Parent").then((m) => ({ default: m.ChildSettings })));
const ProjectStudio = lazy(() => import("./pages/Project").then((m) => ({ default: m.ProjectStudio })));
const SharePage = lazy(() => import("./pages/SharePage").then((m) => ({ default: m.SharePage })));
const FeedPage = lazy(() => import("./pages/Social").then((m) => ({ default: m.FeedPage })));
const FriendsPage = lazy(() => import("./pages/Social").then((m) => ({ default: m.FriendsPage })));
const NewCode = lazy(() => import("./pages/Social").then((m) => ({ default: m.NewCode })));
const PlannerPage = lazy(() => import("./pages/Social").then((m) => ({ default: m.PlannerPage })));

const kid = (el: React.ReactNode) => <KidShell>{el}</KidShell>;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SessionProvider>
      <RewardsProvider>
        <BrowserRouter>
          <Suspense fallback={<Loading />}>
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
            <Route path="/kid/friends" element={kid(<FriendsPage />)} />
            <Route path="/kid/feed" element={kid(<FeedPage />)} />
            <Route path="/kid/plans" element={kid(<PlannerPage />)} />
            <Route path="/kid/code" element={kid(<NewCode />)} />
            <Route path="/s/:token" element={<SharePage />} />
            <Route path="/p/:who/:slug" element={<SharePage />} />
            <Route path="*" element={<main className="container center"><h1>🛸 Lost in space</h1><a href="/">Go home</a></main>} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </RewardsProvider>
    </SessionProvider>
  </StrictMode>,
);

// Installable app (PWA): register the service worker in production builds.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
