import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Nav from './components/Nav';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';

// Public storefront pages load eagerly — this is what most visitors hit first.
import Home from './pages/Home';
import Collections from './pages/Collections';
import ProductDetail from './pages/ProductDetail';
import Journal from './pages/Journal';

// Admin is a separate bundle. Nobody browsing the storefront should download
// the entire dashboard — this is the single biggest lever on public bundle size.
const AdminLogin = lazy(() => import('./pages/admin/Login'));
const DashboardLayout = lazy(() => import('./pages/admin/DashboardLayout'));
const Overview = lazy(() => import('./pages/admin/Overview'));
const HomepageAdmin = lazy(() => import('./pages/admin/Homepage'));
const AdminProducts = lazy(() => import('./pages/admin/Products'));
const Events = lazy(() => import('./pages/admin/Events'));
const JournalAdmin = lazy(() => import('./pages/admin/JournalAdmin'));
const Collaborations = lazy(() => import('./pages/admin/Collaborations'));
const Countdowns = lazy(() => import('./pages/admin/Countdowns'));
const Media = lazy(() => import('./pages/admin/Media'));
const Orders = lazy(() => import('./pages/admin/Orders'));
const SiteSettings = lazy(() => import('./pages/admin/SiteSettings'));

function SiteLayout({ children }) {
  return (
    <>
      <Nav />
      {children}
      <Footer />
    </>
  );
}

function AdminFallback() {
  return <div className="min-h-screen flex items-center justify-center bg-paper text-ink/40 text-sm">Loading…</div>;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<SiteLayout><Home /></SiteLayout>} />
          <Route path="/collections" element={<SiteLayout><Collections /></SiteLayout>} />
          <Route path="/collections/:slug" element={<SiteLayout><Collections /></SiteLayout>} />
          <Route path="/product/:slug" element={<SiteLayout><ProductDetail /></SiteLayout>} />
          <Route path="/journal" element={<SiteLayout><Journal /></SiteLayout>} />

          <Route
            path="/admin/login"
            element={<Suspense fallback={<AdminFallback />}><AdminLogin /></Suspense>}
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Suspense fallback={<AdminFallback />}>
                  <DashboardLayout />
                </Suspense>
              </ProtectedRoute>
            }
          >
            <Route index element={<Suspense fallback={<AdminFallback />}><Overview /></Suspense>} />
            <Route path="homepage" element={<Suspense fallback={<AdminFallback />}><HomepageAdmin /></Suspense>} />
            <Route path="products" element={<Suspense fallback={<AdminFallback />}><AdminProducts /></Suspense>} />
            <Route path="events" element={<Suspense fallback={<AdminFallback />}><Events /></Suspense>} />
            <Route path="journal" element={<Suspense fallback={<AdminFallback />}><JournalAdmin /></Suspense>} />
            <Route path="collaborations" element={<Suspense fallback={<AdminFallback />}><Collaborations /></Suspense>} />
            <Route path="countdowns" element={<Suspense fallback={<AdminFallback />}><Countdowns /></Suspense>} />
            <Route path="media" element={<Suspense fallback={<AdminFallback />}><Media /></Suspense>} />
            <Route path="orders" element={<Suspense fallback={<AdminFallback />}><Orders /></Suspense>} />
            <Route path="settings" element={<Suspense fallback={<AdminFallback />}><SiteSettings /></Suspense>} />
          </Route>
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}
