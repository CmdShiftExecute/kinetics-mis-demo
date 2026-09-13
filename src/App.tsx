import { Suspense, lazy, useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TableSkeleton } from './components/Skeleton';
import Overview from './pages/Overview';

const SalesReport = lazy(() => import('./pages/SalesReport'));
const PipelineReport = lazy(() => import('./pages/PipelineReport'));
const NetProfitReport = lazy(() => import('./pages/NetProfitReport'));
const ReceivablesReport = lazy(() => import('./pages/ReceivablesReport'));
const WorkingCapitalReport = lazy(() => import('./pages/WorkingCapitalReport'));
const DataBasis = lazy(() => import('./pages/DataBasis'));
const VerticalPage = lazy(() => import('./pages/VerticalPage'));
const CustomerAgingPage = lazy(() => import('./pages/CustomerAgingPage'));
const EngineerPage = lazy(() => import('./pages/EngineerPage'));
const NotFound = lazy(() => import('./pages/NotFound'));

function Fallback() {
  return (
    <div className="wrap" style={{ paddingTop: 'var(--s-3xl)' }}>
      <TableSkeleton rows={8} />
    </div>
  );
}

/*
 * The overview is in the main bundle so the first paint needs one script; every other
 * route is split and loaded on demand.
 */

/** Scroll to the top on every path change, or to the anchor when the address carries one. */
function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView({ block: 'start' });
        return;
      }
    }
    window.scrollTo({ top: 0 });
  }, [pathname, hash]);
  return null;
}

function Pages() {
  const location = useLocation();
  const reduce = useReducedMotion();
  const page = reduce ? {} : { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 }, transition: { duration: 0.2 } };
  // No `initial={false}` on AnimatePresence below. That flag suppresses the entry
  // animation of every motion component beneath it on FIRST load, which is why page
  // titles and headline strips never rose and the app read as static on every page
  // that had neither a chart nor count-up figures. Measured 13 Sep 2026: restoring it
  // took /calculator in the sibling WMS from 1 distinct rendered frame to 3.
  return (
    <AnimatePresence mode="wait">
      <motion.main key={location.pathname} {...page}>
        <ErrorBoundary key={location.pathname}>
          <Suspense fallback={<Fallback />}>
            <Routes location={location}>
              <Route path="/" element={<Overview />} />
              <Route path="/sales" element={<SalesReport />} />
              <Route path="/pipeline" element={<PipelineReport />} />
              {/* The tab was called Delivery until 13 Sep 2026. Old links still resolve. */}
              <Route path="/delivery" element={<Navigate to="/pipeline" replace />} />
              <Route path="/net-profit" element={<NetProfitReport />} />
              <Route path="/receivables" element={<ReceivablesReport />} />
              <Route path="/working-capital" element={<WorkingCapitalReport />} />
              <Route path="/data-basis" element={<DataBasis />} />
              <Route path="/v/:slug" element={<VerticalPage />} />
              <Route path="/v/:slug/receivables" element={<CustomerAgingPage />} />
              <Route path="/v/:slug/e/:eng" element={<EngineerPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </motion.main>
    </AnimatePresence>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <ScrollManager />
      <Pages />
    </BrowserRouter>
  );
}
