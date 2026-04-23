import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Badge } from "../components/ui/badge";
import { CheckCircle, XCircle, Clock, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function HomePage() {
  const { user } = useAuth();
  const [recruitments, setRecruitments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const authParam = searchParams.get("auth");
    const msg = searchParams.get("message");
    if (authParam === "success") {
      setToast({ type: "success", text: "Zalogowano pomyślnie" });
      setSearchParams({}, { replace: true });
    } else if (authParam === "error") {
      setToast({ type: "error", text: msg || "Logowanie nie powiodło się" });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    axios
      .get(`${API}/recruitments`)
      .then((res) => setRecruitments(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const active = recruitments.filter((r) => r.status === "active");
  const closed = recruitments.filter((r) => r.status === "closed");

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Toast */}
      {toast && (
        <div className="max-w-5xl mx-auto px-4 pt-4">
          <div
            data-testid="home-toast"
            className={`px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 hs-animate-fade-up ${
              toast.type === "error"
                ? "bg-red-500/10 border border-red-500/20 text-red-400"
                : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
            }`}
          >
            {toast.type === "error" ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
            {toast.text}
            <button onClick={() => setToast(null)} className="ml-auto opacity-60 hover:opacity-100">&times;</button>
          </div>
        </div>
      )}

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#00E5FF]/5 via-transparent to-transparent" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-16 pb-12 relative">
          <div className="hs-animate-fade-up">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00E5FF] mb-4" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              System Rekrutacji
            </p>
            <h1
              className="text-4xl sm:text-5xl font-black tracking-tighter uppercase mb-4"
              style={{ fontFamily: "'Unbounded', sans-serif", color: "#FAFAFA" }}
              data-testid="hero-title"
            >
              HoodStories
            </h1>
            <p className="text-base text-zinc-400 max-w-lg leading-relaxed" style={{ fontFamily: "'Outfit', sans-serif" }}>
              Przeglądaj dostępne rekrutacje i dołącz do naszego zespołu.
              {!user && " Zaloguj się kontem Discord, aby złożyć aplikację."}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
        {loading ? (
          <div className="flex justify-center py-20" data-testid="loading-recruitments">
            <Loader2 className="w-8 h-8 animate-spin text-[#00E5FF]" />
          </div>
        ) : (
          <>
            {/* Active */}
            {active.length > 0 && (
              <section className="mb-12 hs-animate-fade-up" data-testid="active-recruitments-section">
                <div className="flex items-center gap-3 mb-6">
                  <ShieldCheck className="w-5 h-5 text-[#00E5FF]" />
                  <h2
                    className="text-xl sm:text-2xl font-bold tracking-tight uppercase"
                    style={{ fontFamily: "'Unbounded', sans-serif", color: "#FAFAFA" }}
                  >
                    Aktywne Rekrutacje
                  </h2>
                  <Badge className="bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30 text-xs font-mono uppercase">
                    {active.length}
                  </Badge>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {active.map((rec, i) => (
                    <RecruitmentCard key={rec.id} recruitment={rec} index={i} />
                  ))}
                </div>
              </section>
            )}

            {/* Closed */}
            {closed.length > 0 && (
              <section className="hs-animate-fade-up" data-testid="closed-recruitments-section">
                <div className="flex items-center gap-3 mb-6">
                  <Clock className="w-5 h-5 text-zinc-500" />
                  <h2
                    className="text-xl sm:text-2xl font-bold tracking-tight uppercase"
                    style={{ fontFamily: "'Unbounded', sans-serif", color: "#71717A" }}
                  >
                    Zakończone
                  </h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {closed.map((rec, i) => (
                    <RecruitmentCard key={rec.id} recruitment={rec} index={i} closed />
                  ))}
                </div>
              </section>
            )}

            {recruitments.length === 0 && (
              <div className="text-center py-20 text-zinc-500" data-testid="no-recruitments">
                <p className="text-lg">Brak dostępnych rekrutacji</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function RecruitmentCard({ recruitment, index, closed }) {
  const r = recruitment;
  return (
    <Link
      to={`/recruitment/${r.id}`}
      className={`group block rounded-xl border transition-all duration-300 ${
        closed
          ? "bg-[#0F0F13] border-white/5 opacity-60 hover:opacity-80"
          : "bg-[#141418] border-white/10 hover:-translate-y-1 hover:shadow-[0_0_20px_rgba(0,229,255,0.1)]"
      }`}
      style={{ animationDelay: `${index * 0.08}s` }}
      data-testid={`recruitment-card-${r.slug}`}
    >
      <div className="p-6">
        {/* Top accent line */}
        {!closed && (
          <div
            className="h-0.5 w-12 rounded-full mb-4 transition-all duration-300 group-hover:w-20"
            style={{ background: r.theme_color }}
          />
        )}

        <div className="flex items-start justify-between gap-3 mb-3">
          <h3
            className="text-lg font-semibold tracking-tight"
            style={{ fontFamily: "'Outfit', sans-serif", color: closed ? "#71717A" : "#FAFAFA" }}
          >
            {r.name}
          </h3>
          <Badge
            className={
              closed
                ? "bg-zinc-800/50 text-zinc-500 border border-zinc-700/30 text-xs font-mono uppercase shrink-0"
                : "bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30 text-xs font-mono uppercase shrink-0"
            }
          >
            {closed ? "zamknięta" : "otwarta"}
          </Badge>
        </div>

        <p
          className="text-sm leading-relaxed mb-4 line-clamp-2"
          style={{ color: closed ? "#52525B" : "#A1A1AA", fontFamily: "'Outfit', sans-serif" }}
        >
          {r.description}
        </p>

        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-600" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {r.question_count} {r.question_count === 1 ? "pytanie" : r.question_count < 5 ? "pytania" : "pytań"}
          </span>
          {!closed && (
            <span className="flex items-center gap-1 text-xs font-medium text-[#00E5FF] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              Aplikuj <ArrowRight className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
