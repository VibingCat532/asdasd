import { useState, useEffect, useCallback } from "react";
import { SiDiscord } from "react-icons/si";
import { LogOut, Shield, CheckCircle, AlertTriangle, XCircle, Loader2, User, Hash, Calendar } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";
import axios from "axios";
import { API, API_ORIGIN } from "../lib/api";


export default function LandingPage() {
  const [user, setUser] = useState(null);
  const [configStatus, setConfigStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMessage, setAuthMessage] = useState(null);

  const fetchUser = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/auth/me`, { withCredentials: true });
      setUser(res.data);
    } catch {
      setUser(null);
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/auth/config-status`);
      setConfigStatus(res.data);
    } catch {
      setConfigStatus(null);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authParam = params.get("auth");
    const messageParam = params.get("message");
    if (authParam === "error") {
      setAuthMessage({ type: "error", text: messageParam || "Logowanie nie powiodło się" });
      window.history.replaceState({}, "", "/");
    } else if (authParam === "success") {
      setAuthMessage({ type: "success", text: "Zalogowano pomyślnie" });
      window.history.replaceState({}, "", "/");
    }

    Promise.all([fetchUser(), fetchConfig()]).finally(() => setLoading(false));
  }, [fetchUser, fetchConfig]);

  const handleLogin = () => {
    window.location.href = `${API}/auth/discord/start`;
  };

  const handleLogout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
      setUser(null);
      setAuthMessage({ type: "success", text: "Wylogowano" });
    } catch {
      setAuthMessage({ type: "error", text: "Błąd wylogowania" });
    }
  };

  const discordAvatarUrl = user?.discord_avatar
    ? `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.discord_avatar}.png?size=128`
    : null;

  const canLogin = configStatus?.discord_client_id && configStatus?.discord_client_secret && configStatus?.discord_redirect_uri;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="loading-screen">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--hs-accent)" }} />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen relative flex items-center justify-center px-4 py-12">
        {/* Background scene */}
        <div className="hs-bg-scene" />

        {/* Content */}
        <div className="relative z-10 w-full max-w-md">
          {/* Auth message toast */}
          {authMessage && (
            <div
              data-testid="auth-message"
              className={`mb-6 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 hs-animate-fade-up ${
                authMessage.type === "error"
                  ? "bg-red-500/10 border border-red-500/20 text-red-400"
                  : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
              }`}
            >
              {authMessage.type === "error" ? <XCircle className="w-4 h-4 flex-shrink-0" /> : <CheckCircle className="w-4 h-4 flex-shrink-0" />}
              {authMessage.text}
              <button
                onClick={() => setAuthMessage(null)}
                className="ml-auto text-current opacity-60 hover:opacity-100"
                data-testid="dismiss-auth-message"
              >
                &times;
              </button>
            </div>
          )}

          {/* Main card */}
          <div className="hs-glass-card hs-animate-fade-up hs-animate-pulse-glow" data-testid="auth-card">
            <div className="p-8 sm:p-10">
              {/* Header */}
              <div className="text-center mb-8 hs-animate-fade-up-delay-1">
                <div className="hs-overline mb-3">Phase 0</div>
                <h1
                  className="text-3xl sm:text-4xl font-bold tracking-tight mb-2"
                  style={{ fontFamily: "'Outfit', sans-serif", color: "var(--hs-text)" }}
                >
                  HoodStories
                </h1>
                <p
                  className="text-lg font-medium"
                  style={{ color: "var(--hs-accent)" }}
                >
                  Rekrutacje
                </p>
              </div>

              <Separator className="my-6 opacity-10" />

              {user ? (
                /* ---- Authenticated view ---- */
                <div className="hs-animate-fade-up-delay-2" data-testid="authenticated-view">
                  <div className="flex flex-col items-center gap-4 mb-6">
                    <div className="hs-avatar-ring p-0.5">
                      <Avatar className="w-20 h-20">
                        <AvatarImage src={discordAvatarUrl} alt={user.discord_username} />
                        <AvatarFallback className="bg-[#12121A] text-[#00D4FF] text-2xl font-bold">
                          {(user.discord_global_name || user.discord_username || "?")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="text-center">
                      <h2
                        className="text-xl font-semibold"
                        style={{ fontFamily: "'Outfit', sans-serif", color: "var(--hs-text)" }}
                        data-testid="user-display-name"
                      >
                        {user.discord_global_name || user.discord_username}
                      </h2>
                      <p className="text-sm" style={{ color: "var(--hs-text-secondary)" }} data-testid="user-discord-tag">
                        @{user.discord_username}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-emerald-500/30 text-emerald-400 bg-emerald-500/5"
                      data-testid="auth-connected-badge"
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Połączono z Discord
                    </Badge>
                  </div>

                  <div className="space-y-1 mb-6 px-2">
                    <div className="hs-info-row">
                      <User className="w-4 h-4 flex-shrink-0" style={{ color: "var(--hs-accent)" }} />
                      <span className="label">Discord ID</span>
                      <span className="value font-mono text-xs" data-testid="user-discord-id">{user.discord_id}</span>
                    </div>
                    <div className="hs-info-row">
                      <Hash className="w-4 h-4 flex-shrink-0" style={{ color: "var(--hs-accent)" }} />
                      <span className="label">ID sesji</span>
                      <span className="value font-mono text-xs" data-testid="user-session-id">{user.id.slice(0, 8)}...</span>
                    </div>
                    <div className="hs-info-row">
                      <Calendar className="w-4 h-4 flex-shrink-0" style={{ color: "var(--hs-accent)" }} />
                      <span className="label">Dołączono</span>
                      <span className="value text-xs" data-testid="user-joined-at">
                        {new Date(user.created_at).toLocaleDateString("pl-PL", { year: "numeric", month: "long", day: "numeric" })}
                      </span>
                    </div>
                  </div>

                  <button
                    className="hs-logout-btn w-full flex items-center justify-center gap-2"
                    onClick={handleLogout}
                    data-testid="logout-button"
                  >
                    <LogOut className="w-4 h-4" />
                    Wyloguj się
                  </button>
                </div>
              ) : (
                /* ---- Unauthenticated view ---- */
                <div className="hs-animate-fade-up-delay-2" data-testid="unauthenticated-view">
                  <p
                    className="text-center text-sm mb-6"
                    style={{ color: "var(--hs-text-secondary)" }}
                  >
                    Zaloguj się kontem Discord, aby uzyskać dostęp do systemu rekrutacji.
                  </p>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <button
                          className="hs-discord-btn"
                          onClick={handleLogin}
                          disabled={!canLogin}
                          data-testid="login-discord-button"
                        >
                          <SiDiscord className="w-5 h-5" />
                          Zaloguj przez Discord
                        </button>
                      </div>
                    </TooltipTrigger>
                    {!canLogin && (
                      <TooltipContent>
                        <p>Brakuje konfiguracji Discord OAuth. Sprawdź zmienne środowiskowe.</p>
                      </TooltipContent>
                    )}
                  </Tooltip>

                  {!canLogin && (
                    <div className="mt-4 px-3 py-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10" data-testid="missing-config-warning">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-amber-400 mb-1">Brakujące zmienne środowiskowe</p>
                          <ul className="text-xs space-y-0.5" style={{ color: "var(--hs-text-secondary)" }}>
                            {!configStatus?.discord_client_id && <li>DISCORD_CLIENT_ID</li>}
                            {!configStatus?.discord_client_secret && <li>DISCORD_CLIENT_SECRET</li>}
                            {!configStatus?.discord_redirect_uri && <li>DISCORD_REDIRECT_URI</li>}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Config status bar */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 hs-animate-fade-up-delay-3" data-testid="config-status-bar">
            <Tooltip>
              <TooltipTrigger>
                <div className="hs-status-pill" data-testid="config-status-badge">
                  <span className={`hs-status-dot ${configStatus?.all_required_set ? "ok" : "warn"}`} />
                  <span style={{ color: "var(--hs-text-secondary)" }}>
                    {configStatus?.all_required_set ? "Konfiguracja OK" : "Niekompletna konfiguracja"}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <div className="space-y-1.5 text-xs">
                  <p className="font-medium mb-2">Status zmiennych środowiskowych:</p>
                  <ConfigLine label="DISCORD_CLIENT_ID" ok={configStatus?.discord_client_id} />
                  <ConfigLine label="DISCORD_CLIENT_SECRET" ok={configStatus?.discord_client_secret} />
                  <ConfigLine label="DISCORD_REDIRECT_URI" ok={configStatus?.discord_redirect_uri} />
                  <ConfigLine label="DATABASE_URL" ok={configStatus?.database_url} />
                  <ConfigLine label="JWT_SECRET" ok={configStatus?.jwt_secret} />
                  <ConfigLine label="DISCORD_BOT_TOKEN" ok={configStatus?.discord_bot_token} optional />
                </div>
              </TooltipContent>
            </Tooltip>

            {configStatus?.redirect_uri_value && (
              <Tooltip>
                <TooltipTrigger>
                  <div className="hs-status-pill" data-testid="redirect-uri-badge">
                    <Shield className="w-3 h-3" style={{ color: "var(--hs-accent)" }} />
                    <span style={{ color: "var(--hs-text-secondary)" }}>Redirect URI</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-sm">
                  <p className="text-xs mb-1 font-medium">Dodaj ten URI w Discord Developer Portal:</p>
                  <code className="text-xs break-all block px-2 py-1 rounded bg-black/40">
                    {configStatus.redirect_uri_value}
                  </code>
                </TooltipContent>
              </Tooltip>
            )}

            <a
              href={`${API_ORIGIN}/api/docs`}
              target="_blank"
              rel="noopener noreferrer"
              className="hs-status-pill hover:border-[var(--hs-accent)]/20 transition-colors"
              data-testid="api-docs-link"
            >
              <span style={{ color: "var(--hs-text-secondary)" }}>API Docs</span>
            </a>
          </div>

          {/* Footer */}
          <p className="text-center mt-8 text-xs hs-animate-fade-up-delay-3" style={{ color: "var(--hs-text-secondary)", opacity: 0.5 }}>
            HoodStories Rekrutacje &middot; Phase 0 POC
          </p>
        </div>
      </div>
    </TooltipProvider>
  );
}

function ConfigLine({ label, ok, optional }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? (
        <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" />
      ) : optional ? (
        <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
      ) : (
        <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
      )}
      <span className={ok ? "text-emerald-400" : optional ? "text-amber-400" : "text-red-400"}>
        {label}
      </span>
      {optional && !ok && <span className="text-[10px] opacity-50">(opcjonalne)</span>}
    </div>
  );
}
