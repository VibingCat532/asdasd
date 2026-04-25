import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Badge } from "../components/ui/badge";
import { Loader2, FileText, ArrowRight, Clock, LogIn } from "lucide-react";
import { SiDiscord } from "react-icons/si";
import axios from "axios";
import { API } from "../lib/api";


const STATUS_CONFIG = {
  nowe: { label: "Nowe", classes: "bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30" },
  zaakceptowane: { label: "Zaakceptowane", classes: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" },
  odrzucone: { label: "Odrzucone", classes: "bg-red-500/15 text-red-400 border border-red-500/30" },
};

export default function MyApplicationsPage() {
  const { user, loading: authLoading, login } = useAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    axios
      .get(`${API}/applications`, { withCredentials: true })
      .then((res) => setApplications(Array.isArray(res.data) ? res.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (authLoading) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-[#00E5FF]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center hs-animate-fade-up" data-testid="login-required">
        <LogIn className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-3" style={{ fontFamily: "'Unbounded', sans-serif", color: "#FAFAFA" }}>
          Zaloguj się
        </h2>
        <p className="text-zinc-400 mb-6" style={{ fontFamily: "'Outfit', sans-serif" }}>
          Musisz być zalogowany, aby zobaczyć swoje aplikacje.
        </p>
        <button
          onClick={login}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:shadow-[0_0_16px_rgba(88,101,242,0.3)]"
          style={{ background: "#5865F2" }}
          data-testid="login-button-applications"
        >
          <SiDiscord className="w-4 h-4" />
          Zaloguj przez Discord
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="hs-animate-fade-up mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00E5FF] mb-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          Twoje zgłoszenia
        </p>
        <h1
          className="text-2xl sm:text-3xl font-bold tracking-tight uppercase"
          style={{ fontFamily: "'Unbounded', sans-serif", color: "#FAFAFA" }}
          data-testid="my-applications-title"
        >
          Moje Aplikacje
        </h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-20" data-testid="loading-applications">
          <Loader2 className="w-8 h-8 animate-spin text-[#00E5FF]" />
        </div>
      ) : applications.length === 0 ? (
        <div className="text-center py-16 rounded-xl bg-[#0F0F13] border border-white/5" data-testid="no-applications">
          <FileText className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-400 font-medium" style={{ fontFamily: "'Outfit', sans-serif" }}>
            Nie masz jeszcze żadnych aplikacji
          </p>
          <Link
            to="/"
            className="text-[#00E5FF] text-sm mt-3 inline-block hover:underline"
            data-testid="browse-recruitments-link"
          >
            Przeglądaj rekrutacje
          </Link>
        </div>
      ) : (
        <div className="space-y-3" data-testid="applications-list">
          {applications.map((app, i) => {
            const status = STATUS_CONFIG[app.status] || STATUS_CONFIG.nowe;
            return (
              <Link
                key={app.id}
                to={`/my-applications/${app.id}`}
                className="group block rounded-xl bg-[#141418] border border-white/10 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_15px_rgba(0,229,255,0.08)]"
                style={{ animationDelay: `${i * 0.06}s` }}
                data-testid={`application-item-${app.id}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-zinc-200 mb-1" style={{ fontFamily: "'Outfit', sans-serif" }}>
                      {app.recruitment_name}
                    </h3>
                    <div className="flex items-center gap-3">
                      <Badge className={`${status.classes} text-xs font-mono uppercase px-2 py-0.5`}>
                        {status.label}
                      </Badge>
                      <span className="text-xs text-zinc-600 flex items-center gap-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        <Clock className="w-3 h-3" />
                        {new Date(app.created_at).toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-[#00E5FF] transition-colors shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
