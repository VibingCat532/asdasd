import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Loader2, ArrowLeft, FileText, Clock, AlertTriangle, Search, X } from "lucide-react";
import axios from "axios";
import { API } from "../lib/api";


const STATUS_CFG = {
  nowe: { label: "Nowe", cls: "bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30" },
  zaakceptowane: { label: "Zaakceptowane", cls: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" },
  odrzucone: { label: "Odrzucone", cls: "bg-red-500/15 text-red-400 border border-red-500/30" },
};

export default function StaffApplicationsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [recName, setRecName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    Promise.all([
      axios.get(`${API}/staff/recruitments/${id}`, { withCredentials: true }),
      axios.get(`${API}/staff/recruitments/${id}/applications`, { withCredentials: true }),
    ]).then(([recRes, appRes]) => {
      setRecName(recRes.data.name);
      setApplications(appRes.data);
    }).catch(err => setError(err.response?.data?.detail || "Brak dostępu"))
      .finally(() => setLoading(false));
  }, [id, user]);

  const searchTerm = search.trim().replace(/^@/, "").toLowerCase();
  const matchingApplications = applications.filter(application => (
    !searchTerm || [application.applicant_username, application.applicant_global_name, application.applicant_discord_id]
      .some(value => String(value || "").toLowerCase().includes(searchTerm))
  ));
  const filtered = filter === "all" ? matchingApplications : matchingApplications.filter(a => a.status === filter);

  if (loading) return <div className="flex justify-center py-32"><Loader2 className="w-8 h-8 animate-spin text-[#00E5FF]" /></div>;
  if (error) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
      <p className="text-zinc-400">{error}</p>
      <Link to="/staff" className="text-[#00E5FF] text-sm mt-3 inline-block hover:underline">Powrót do panelu</Link>
    </div>
  );

  const counts = { all: matchingApplications.length, nowe: 0, zaakceptowane: 0, odrzucone: 0 };
  matchingApplications.forEach(a => { if (counts[a.status] !== undefined) counts[a.status]++; });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8" data-testid="staff-applications-page">
      <Link to="/staff" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-6" data-testid="back-to-staff">
        <ArrowLeft className="w-3.5 h-3.5" />Panel Staff
      </Link>

      <div className="hs-animate-fade-up mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00E5FF] mb-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Przegląd zgłoszeń</p>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight" style={{ fontFamily: "'Unbounded', sans-serif", color: "#FAFAFA" }} data-testid="applications-rec-name">{recName}</h1>
      </div>

      <div className="mb-4">
        <label htmlFor="application-search" className="block text-sm text-zinc-400 mb-2">Szukaj osoby</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
          <Input
            id="application-search"
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Nick lub Discord ID..."
            className="bg-black/40 border-white/10 text-zinc-100 pl-10 pr-10"
            data-testid="application-search"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Wyczyść wyszukiwanie"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200"
              data-testid="clear-application-search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-6 flex-wrap" data-testid="status-filter">
        {[
          { key: "all", label: "Wszystkie" },
          { key: "nowe", label: "Nowe" },
          { key: "zaakceptowane", label: "Zaakceptowane" },
          { key: "odrzucone", label: "Odrzucone" },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === f.key ? "bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30" : "text-zinc-500 border border-white/5 hover:text-zinc-300 hover:border-white/10"
            }`}
            data-testid={`filter-${f.key}`}>
            {f.label} ({counts[f.key]})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 rounded-xl bg-[#0F0F13] border border-white/5" data-testid="no-applications">
          <FileText className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-400">
            {searchTerm ? "Brak zgłoszeń pasujących do wyszukiwania" : "Brak zgłoszeń"}
            {filter !== "all" ? ` ze statusem „${STATUS_CFG[filter].label}”` : ""}
          </p>
        </div>
      ) : (
        <div className="space-y-3" data-testid="applications-list">
          {filtered.map(app => {
            const st = STATUS_CFG[app.status] || STATUS_CFG.nowe;
            const avatarUrl = app.applicant_avatar
              ? `https://cdn.discordapp.com/avatars/${app.applicant_discord_id}/${app.applicant_avatar}.png?size=64`
              : null;
            return (
              <Link key={app.id} to={`/staff/recruitments/${id}/applications/${app.id}`}
                className="group flex items-center gap-4 rounded-xl bg-[#141418] border border-white/10 p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_0_15px_rgba(0,229,255,0.08)]"
                data-testid={`app-row-${app.id}`}>
                <Avatar className="w-10 h-10 border border-white/10 shrink-0">
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback className="bg-zinc-900 text-zinc-400 text-sm">
                    {(app.applicant_global_name || app.applicant_username || "?")[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-200 truncate" style={{ fontFamily: "'Outfit', sans-serif" }}>
                    {app.applicant_global_name || app.applicant_username}
                  </p>
                  <p className="text-xs text-zinc-500">@{app.applicant_username}</p>
                  <p className="text-xs text-zinc-600 break-all">Discord ID: {app.applicant_discord_id}</p>
                </div>
                <Badge className={`${st.cls} text-xs font-mono uppercase shrink-0`}>{st.label}</Badge>
                <span className="text-xs text-zinc-600 shrink-0 hidden sm:flex items-center gap-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  <Clock className="w-3 h-3" />
                  {new Date(app.created_at).toLocaleDateString("pl-PL", { day: "numeric", month: "short" })}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
