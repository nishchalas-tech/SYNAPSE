import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Menu, ShoppingBag, User, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';

export function CustomerLayout() {
  const { session, logout } = useAuth();
  const { state } = useNetwork();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const cartCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium whitespace-nowrap shrink-0 transition-colors pb-0.5 ${
      isActive
        ? 'text-[#264C4F] border-b-2 border-[#264C4F]'
        : 'text-[#526063] hover:text-[#1A2022]'
    }`;

  const handleSignOut = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F7F5] text-[#1A2022]">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-[#E1E5E4]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-element wordmark */}
          <Link
            to="/"
            className="text-lg font-bold tracking-tight text-[#264C4F] whitespace-nowrap shrink-0"
          >
            SYNAPSE
          </Link>

          {/* Zone 2: 5 concise single-line text nav links */}
          <nav aria-label="Customer navigation" className="hidden md:flex items-center gap-7">
            <NavLink to="/" end className={navLinkClass}>
              Home
            </NavLink>
            <NavLink to="/catalogue" className={navLinkClass}>
              Catalogue
            </NavLink>
            <NavLink to="/search" className={navLinkClass}>
              Search
            </NavLink>
            <NavLink to="/orders" className={navLinkClass}>
              My Orders
            </NavLink>
            <NavLink to="/profile" className={navLinkClass}>
              Profile
            </NavLink>
          </nav>

          {/* Zone 3: Primary Cart / Account action */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/cart"
              aria-label={`Shopping cart with ${cartCount} items`}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-[#264C4F] hover:bg-[#1D3B3D] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <ShoppingBag className="w-4 h-4" aria-hidden="true" />
              <span>Cart</span>
              <span className="font-mono-tabular bg-white/15 px-1.5 py-0.5 rounded text-[11px]">
                {cartCount}
              </span>
            </Link>

            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
              className="md:hidden p-2 rounded-lg border border-[#E1E5E4] text-[#1A2022]"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <div className="md:hidden border-t border-[#E1E5E4] bg-white px-4 py-4 space-y-2">
            <div className="flex flex-col space-y-2">
              <Link to="/" onClick={() => setMobileOpen(false)} className="py-2 text-sm font-medium text-[#1A2022]">
                Home
              </Link>
              <Link to="/catalogue" onClick={() => setMobileOpen(false)} className="py-2 text-sm font-medium text-[#1A2022]">
                Catalogue
              </Link>
              <Link to="/search" onClick={() => setMobileOpen(false)} className="py-2 text-sm font-medium text-[#1A2022]">
                Search
              </Link>
              <Link to="/orders" onClick={() => setMobileOpen(false)} className="py-2 text-sm font-medium text-[#1A2022]">
                My Orders
              </Link>
              <Link to="/profile" onClick={() => setMobileOpen(false)} className="py-2 text-sm font-medium text-[#1A2022]">
                Profile
              </Link>
            </div>
            <div className="pt-3 border-t border-[#E1E5E4] flex items-center justify-between">
              <span className="text-xs text-[#526063]">{session ? session.displayName : 'Guest Shopper'}</span>
              {session ? (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="text-xs font-medium text-[#264C4F]"
                >
                  Sign Out
                </button>
              ) : (
                <Link to="/login" onClick={() => setMobileOpen(false)} className="text-xs font-medium text-[#264C4F]">
                  Sign In
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-white border-t border-[#E1E5E4] mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#264C4F]">SYNAPSE Retail Network</p>
            <p className="text-xs text-[#526063] mt-0.5">
              Fictional Bengaluru demo stores · Prepared for FastAPI + Aiven PostgreSQL, Kafka, and OpenSearch integration.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-[#526063]">
            {session ? (
              <>
                <span className="inline-flex items-center gap-1.5 text-[#1A2022] font-medium">
                  <User className="w-3.5 h-3.5 text-[#264C4F]" aria-hidden="true" />
                  {session.displayName} ({session.role})
                </span>
                {session.role === 'STORE_MANAGER' && (
                  <Link to="/manager" className="text-[#264C4F] font-medium hover:underline">
                    Store Manager Portal
                  </Link>
                )}
                {session.role === 'NETWORK_ADMIN' && (
                  <Link to="/admin" className="text-[#264C4F] font-medium hover:underline">
                    Network Admin Portal
                  </Link>
                )}
                <Link to="/login" className="hover:text-[#1A2022] underline">
                  Switch Account
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1 text-[#526063] hover:text-[#1A2022]"
                >
                  <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                  Sign Out
                </button>
              </>
            ) : (
              <Link to="/login" className="text-[#264C4F] font-medium hover:underline">
                Portal Sign In (Customer / Manager / Admin)
              </Link>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
