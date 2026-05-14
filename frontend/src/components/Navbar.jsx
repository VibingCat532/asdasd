import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { SiDiscord } from "react-icons/si";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { LogOut, FileText, Home, LayoutDashboard, History } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";

export default function Navbar() {
  const { user, staffInfo, login, logout } = useAuth();
  const location = useLocation();

  const discordAvatarUrl = user?.discord_avatar
    ? `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.discord_avatar}.png?size=64`
    : null;

  const isActive = (path) => location.pathname === path;
  const startsWith = (prefix) => location.pathname.startsWith(prefix);
  const isStaff = staffInfo?.is_staff;
  const isManagement = staffInfo?.is_management === true;

  return (
    <TooltipProvider>
      <nav
        className="sticky top-0 z-50 border-b border-white/10 backdrop-blur-xl"
        style={{ background: "rgba(5, 5, 5, 0.85)" }}
        data-testid="navbar"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group" data-testid="nav-logo">
            <span className="text-base font-bold tracking-tight transition-colors group-hover:text-[#00E5FF]"
              style={{ fontFamily: "'Unbounded', sans-serif", color: "#FAFAFA" }}>Hood</span>
            <span className="text-base font-bold tracking-tight"
              style={{ fontFamily: "'Unbounded', sans-serif", color: "#00E5FF" }}>Stories</span>
          </Link>

          <div className="hidden sm:flex items-center gap-1">
            <NavLink to="/" active={isActive("/")} icon={<Home className="w-3.5 h-3.5" />} label="Rekrutacje" testId="nav-rekrutacje" />
            {user && (
              <NavLink to="/my-applications" active={startsWith("/my-applications")}
                icon={<FileText className="w-3.5 h-3.5" />} label="Moje Aplikacje" testId="nav-moje-aplikacje" />
            )}
            {isStaff && (
              <NavLink to="/staff" active={location.pathname === "/staff" || startsWith("/staff/recruitments")}
                icon={<LayoutDashboard className="w-3.5 h-3.5" />} label="Panel" testId="nav-staff-panel" />
            )}
            {isManagement && (
              <NavLink to="/staff/history" active={startsWith("/staff/history")}
                icon={<History className="w-3.5 h-3.5" />} label="Historia" testId="nav-history" />
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Mobile nav icons */}
            {user && (
              <div className="flex sm:hidden items-center gap-1">
                <Link to="/my-applications" className="p-2 text-zinc-400 hover:text-zinc-200"><FileText className="w-4 h-4" /></Link>
                {isStaff && <Link to="/staff" className="p-2 text-zinc-400 hover:text-zinc-200"><LayoutDashboard className="w-4 h-4" /></Link>}
                {isManagement && <Link to="/staff/history" className="p-2 text-zinc-400 hover:text-zinc-200"><History className="w-4 h-4" /></Link>}
              </div>
            )}
            {user ? (
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2">
                      <Avatar className="w-7 h-7 border border-[#00E5FF]/30">
                        <AvatarImage src={discordAvatarUrl} alt={user.discord_username} />
                        <AvatarFallback className="bg-zinc-900 text-[#00E5FF] text-xs font-bold">
                          {(user.discord_global_name || user.discord_username || "?")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden md:block text-sm text-zinc-300 font-medium max-w-[120px] truncate" data-testid="nav-username">
                        {user.discord_global_name || user.discord_username}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent><p>@{user.discord_username}</p></TooltipContent>
                </Tooltip>
                <button onClick={logout} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors" data-testid="nav-logout-button">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button onClick={login}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold text-white transition-all duration-200 hover:shadow-[0_0_16px_rgba(88,101,242,0.3)]"
                style={{ background: "#5865F2" }} data-testid="nav-login-button">
                <SiDiscord className="w-4 h-4" />
                <span className="hidden sm:inline">Zaloguj</span>
              </button>
            )}
          </div>
        </div>
      </nav>
    </TooltipProvider>
  );
}

function NavLink({ to, active, icon, label, testId }) {
  return (
    <Link to={to}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1.5 ${
        active ? "text-[#00E5FF] bg-[#00E5FF]/10" : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
      }`}
      data-testid={testId}
    >
      {icon}{label}
    </Link>
  );
}
