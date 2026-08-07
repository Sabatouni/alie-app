import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { SettingsProvider } from './context/SettingsContext';
import Nav from './components/Nav';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from './components/ProtectedRoute';

// Public storefront pages load eagerly — this is what most visitors hit first.
import Home from './pages/Home';
import Collections from './pages/Collections';
import ProductDetail from './pages/ProductDetail';
import Journal from './pages/Journal';
import JournalPost from './pages/JournalPost';
import Events from './pages/Events';
import CollaborationsPage from './pages/Collaborations';
import Search from './pages/Search';
import Wishlist from './pages/Wishlist';
import NotFound from './pages/NotFound';

// Admin is a separate bundle. Nobody browsing the storefront should download
// the entire dashboard — this is the single biggest lever on public bundle size.
const AdminLogin = lazy(() => import('./pages/admin/Login'));
const DashboardLayout = lazy(() => import('./pages/admin/DashboardLayout'));
const Overview = lazy(() => import('./pages/admin/Overview'));
const HomepageAdmin = lazy(() => import('./pages/admin/Homepage'));
const AdminProducts = lazy(() => import('./pages/admin/Products'));
const AdminCollections = lazy(() => import('./pages/admin/CollectionsAdmin'));
const AdminEvents = lazy(() => import('./pages/admin/Events'));
const JournalAdmin = lazy(() => import('./pages/admin/JournalAdmin'));
const AdminCollaborations = lazy(() => import('./pages/admin/Collaborations'));
const Countdowns = lazy(() => import('./pages/admin/Countdowns'));
const Media = lazy(() => import('./pages/admin/Media'));
const Orders = lazy(() => import('./pages/admin/Orders'));
const SiteSettings = lazy(() => import('./pages/admin/SiteSettings'));
const Team = lazy(() => import('./pages/admin/Team'));

function SiteLayout({ children }) {
  return (
    <>
      <Nav />
      <main>{children}</main>
      <Footer />
    </>
  );
}

function AdminFallback() {
  return <div className="min-h-screen flex items-center justify-center bg-paper text-ink/40 text-sm">Loading…</div>;
}

// Wrapping each admin route individually was 11 copies of the same Suspense
// boundary. One around the Outlet does the same job.
function AdminRoute({ children }) {
  return (
    <ProtectedRoute>
      <Suspense fallback={<AdminFallback />}>{children}</Suspense>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <ToastProvider>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<SiteLayout><Home /></SiteLayout>} />
            <Route path="/collections" element={<SiteLayout><Collections /></SiteLayout>} />
            <Route path="/collections/:slug" element={<SiteLayout><Collections /></SiteLayout>} />
            <Route path="/product/:slug" element={<SiteLayout><ProductDetail /></SiteLayout>} />
            <Route path="/journal" element={<SiteLayout><Journal /></SiteLayout>} />
            <Route path="/journal/:slug" element={<SiteLayout><JournalPost /></SiteLayout>} />
            <Route path="/events" element={<SiteLayout><Events /></SiteLayout>} />
            <Route path="/collaborations" element={<SiteLayout><CollaborationsPage /></SiteLayout>} />
            <Route path="/search" element={<SiteLayout><Search /></SiteLayout>} />
            <Route path="/wishlist" element={<SiteLayout><Wishlist /></SiteLayout>} />

            <Route
              path="/admin/login"
              element={<Suspense fallback={<AdminFallback />}><AdminLogin /></Suspense>}
            />
            <Route path="/admin" element={<AdminRoute><DashboardLayout /></AdminRoute>}>
              <Route index element={<Overview />} />
              <Route path="homepage" element={<HomepageAdmin />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="collections" element={<AdminCollections />} />
              <Route path="events" element={<AdminEvents />} />
              <Route path="journal" element={<JournalAdmin />} />
              <Route path="collaborations" element={<AdminCollaborations />} />
              <Route path="countdowns" element={<Countdowns />} />
              <Route path="media" element={<Media />} />
              <Route path="orders" element={<Orders />} />
              <Route path="settings" element={<SiteSettings />} />
              <Route path="team" element={<Team />} />
            </Route>

            {/* Catch-all. Without this, any unknown path rendered a blank page. */}
            <Route path="*" element={<SiteLayout><NotFound /></SiteLayout>} />
          </Routes>
        </ToastProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}
