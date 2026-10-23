import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { SiDiscord } from "react-icons/si";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { LogOut, Menu, X } from "lucide-react";
import { discordAvatarUrl } from "../lib/panels";

export default function Navbar() {
  const { user, staffInfo, login, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const startsWith = (prefix) => location.pathname.startsWith(prefix);
  const isStaff = staffInfo?.is_staff;
  const isManagement = staffInfo?.is_management === true;
  const displayName = user ? user.discord_global_name || user.discord_username : "";

  const links = [
    { to: "/", label: "Panele", active: location.pathname === "/" || startsWith("/recruitment"), testId: "nav-rekrutacje" },
    user && { to: "/my-applications", label: "Moje zgłoszenia", active: startsWith("/my-applications"), testId: "nav-moje-aplikacje" },
    isStaff && { to: "/staff", label: "Panel staff", active: location.pathname === "/staff" || startsWith("/staff/recruitments"), testId: "nav-staff-panel" },
    isManagement && { to: "/staff/history", label: "Historia podań", active: startsWith("/staff/history"), testId: "nav-history" },
  ].filter(Boolean);

  return (
    <header className="sticky top-0 z-50 bg-hs-ground border-b border-[#14191B]" data-testid="navbar">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-8 h-[60px] sm:h-[72px] flex items-center gap-6 lg:gap-10">
        <Link to="/" className="flex items-center gap-2.5 text-hs-ink hover:text-white" data-testid="nav-logo" aria-label="HoodStories — strona główna">
          <img src="/logo-mark.webp" alt="" width="120" height="92" className="h-8 sm:h-9 w-auto" />
          <span className="hs-display text-[21px] sm:text-2xl leading-none">HoodStories</span>
        </Link>

        <nav aria-label="Główna" className="hidden md:flex items-center gap-7 flex-1">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              aria-current={link.active ? "page" : undefined}
              className={`text-[15px] font-medium ${link.active ? "text-white" : "text-hs-muted hover:text-white"}`}
              data-testid={link.testId}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto md:ml-0 flex items-center gap-2">
          {user ? (
            <div className="flex items-center gap-2.5">
              <Avatar className="w-[34px] h-[34px]" title={`@${user.discord_username}`}>
                <AvatarImage src={discordAvatarUrl(user.discord_id, user.discord_avatar)} alt="" />
                <AvatarFallback className="bg-[#0B3237] text-[#6FE9FF] text-sm font-semibold">
                  {(displayName || "?")[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="hidden lg:block text-[15px] font-medium max-w-[140px] truncate" data-testid="nav-username">
                {displayName}
              </span>
              <button type="button" onClick={logout} className="hs-icon-btn w-9 h-9" aria-label="Wyloguj" title="Wyloguj" data-testid="nav-logout-button">
                <LogOut className="w-[18px] h-[18px]" strokeWidth={1.8} />
              </button>
            </div>
          ) : (
            <button type="button" onClick={login} className="hs-btn hs-btn-primary px-4 sm:px-[18px]" data-testid="nav-login-button">
              <SiDiscord className="w-[18px] h-[18px]" />
              <span className="hidden sm:inline">Zaloguj przez Discord</span>
              <span className="sm:hidden">Zaloguj</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="md:hidden hs-icon-btn w-11 h-11 bg-hs-surface"
            aria-label={menuOpen ? "Zamknij menu" : "Otwórz menu"}
            aria-expanded={menuOpen}
            aria-controls="hs-mobile-menu"
          >
            {menuOpen ? <X className="w-5 h-5" strokeWidth={1.8} /> : <Menu className="w-5 h-5" strokeWidth={1.8} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav id="hs-mobile-menu" aria-label="Menu" className="md:hidden border-t border-[#14191B] px-4 pb-4 pt-2">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              aria-current={link.active ? "page" : undefined}
              className={`flex items-center h-12 text-base font-medium ${link.active ? "text-white" : "text-hs-muted"}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
