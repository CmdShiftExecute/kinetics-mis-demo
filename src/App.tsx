import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router';
import { Grain } from './components/Grain';
import FrontPage from './pages/FrontPage';
import VerticalPage from './pages/VerticalPage';
import OverduePage from './pages/OverduePage';
import EngineerPage from './pages/EngineerPage';
import NotFound from './pages/NotFound';

function Pages() {
  const location = useLocation();
  const reduce = useReducedMotion();
  const page = reduce
    ? {}
    : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.18 } };
  return (
    <AnimatePresence mode="wait" initial={false} onExitComplete={() => window.scrollTo({ top: 0 })}>
      <motion.main key={location.pathname} {...page}>
        <Routes location={location}>
          <Route path="/" element={<FrontPage />} />
          <Route path="/v/:slug" element={<VerticalPage />} />
          <Route path="/v/:slug/overdue" element={<OverduePage />} />
          <Route path="/v/:slug/e/:eng" element={<EngineerPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </motion.main>
    </AnimatePresence>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Grain />
      <Pages />
    </BrowserRouter>
  );
}
