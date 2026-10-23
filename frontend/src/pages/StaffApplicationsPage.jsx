import { useState, useEffect } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { ArrowLeft, FileText, AlertTriangle, Search, X, Copy, Check, BarChart3, Pencil } from "lucide-react";
import axios from "axios";
import { API } from "../lib/api";
import { EmptyState, PanelMark, Spinner, StatusPill, UserInitial } from "../components/hs";
import { CATEGORY_LABELS, discordAvatarUrl, getCategory } from "../lib/panels";

const FILTERS = [
  { key: "all", label: "Wszystkie", heading: "Wszystkie zgłoszenia" },
  { key: "nowe", label: "Nowe", heading: "Nowe zgłoszenia" },
  { key: "zaakceptowane", label: "Zaakceptowane", heading: "Zaakceptowane" },
  { key: "odrzucone", label: "Odrzucone", heading: "Odrzucone" },
];

const formatSent = (iso) => new Date(iso).toLocaleString("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function StaffApplicationsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [applications, setApplications] = useState([]);
  const [recruitment, setRecruitment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState(() => (FILTERS.some((f) => f.key === searchParams.get("status")) ? searchParams.get("status") : "all"));
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    Promise.all([
      axios.get(`${API}/staff/recruitments/${id}`, { withCredentials: true }),
      axios.get(`${API}/staff/recruitments/${id}/applications`, { withCredentials: true }),
    ]).then(([recRes, appRes]) => {
      setRecruitment(recRes.data);
      setApplications(appRes.data);
    }).catch(err => setError(err.response?.data?.error || err.response?.data?.detail || "Brak dostępu"))
      .finally(() => setLoading(false));
  }, [id, user]);

  const searchTerm = search.trim().replace(/^@/, "").toLowerCase();
  const matchingApplications = applications.filter(application => (
    !searchTerm || [application.applicant_username, application.applicant_global_name, application.applicant_discord_id]
      .some(value => String(value || "").toLowerCase().includes(searchTerm))
  ));
  const filtered = filter === "all" ? matchingApplications : matchingApplications.filter(a => a.status === filter);

  if (loading) return <Spinner />;
  if (error) return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center">
      <AlertTriangle className="w-9 h-9 text-hs-notice mx-auto mb-3" strokeWidth={1.6} />
      <p className="text-hs-chrome">{error}</p>
      <Link to="/staff" className="hs-link text-[15px] mt-3 inline-block">Wróć do panelu staff</Link>
    </div>
  );

  const counts = { all: matchingApplications.length, nowe: 0, zaakceptowane: 0, odrzucone: 0 };
  matchingApplications.forEach(a => { if (counts[a.status] !== undefined) counts[a.status]++; });
  const category = getCategory(recruitment);
  const activeFilter = FILTERS.find((f) => f.key === filter) || FILTERS[0];

  return (
    <div className="max-w-[1240px] mx-auto px-4 sm:px-8 pt-6 sm:pt-8 pb-16" data-testid="staff-applications-page">
      <Link to="/staff" className="hs-back" data-testid="back-to-staff">
        <ArrowLeft className="w-4 h-4" strokeWidth={1.8} />Panel staff
      </Link>

      <div className="mt-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        <div className="flex items-center gap-4">
          <PanelMark recruitment={recruitment} size={56} />
          <div className="min-w-0">
            <h1 className="hs-display text-[34px] sm:text-[44px] leading-[0.95] break-words" data-testid="applications-rec-name">{recruitment?.name}</h1>
            <p className="mt-1.5 text-[15px] text-hs-meta">
              {category === "complaints" ? "Skargi" : "Zgłoszenia"} · {(CATEGORY_LABELS[category] || CATEGORY_LABELS.general).toLowerCase()} · {recruitment?.status === "active" ? "przyjmuje zgłoszenia" : "zamknięty"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {recruitment?.can_view_statistics && (
            <Link to={`/staff/recruitments/${id}/statistics`} className="hs-btn hs-btn-ghost">
              <BarChart3 className="w-4 h-4" strokeWidth={1.8} /> Statystyki
            </Link>
          )}
          {(recruitment?.can_edit_recruitment || recruitment?.can_edit_questions) && (
            <Link to={`/staff/recruitments/${id}/edit`} className="hs-btn hs-btn-ghost">
              <Pencil className="w-4 h-4" strokeWidth={1.8} /> Edytuj panel
            </Link>
          )}
        </div>
      </div>

      <div role="group" aria-label="Filtr statusu" className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-2" data-testid="status-filter">
        {FILTERS.map(f => {
          const selected = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={selected}
              onClick={() => setFilter(f.key)}
              className={`text-left px-4 py-3 rounded-[10px] transition-colors ${
                selected ? "bg-[#0C2A2E] shadow-[inset_0_0_0_1.5px_#4CC6D1]" : "bg-hs-surface hover:bg-[#12171A]"
              }`}
              data-testid={`filter-${f.key}`}
            >
              <span className={`block text-[13px] ${selected ? "text-[#A7E3E9]" : "text-hs-meta"}`}>{f.label}</span>
              <span className="block text-xl font-semibold tabular-nums">{counts[f.key]}</span>
            </button>
          );
        })}
      </div>

      <section aria-labelledby="lista-h" className="mt-4 hs-card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 sm:px-6 pt-4 pb-3">
          <h2 id="lista-h" className="text-base font-semibold">
            {activeFilter.heading} <span className="font-normal text-hs-meta">· {filtered.length}</span>
          </h2>
          <div className="relative w-full sm:w-[320px]">
            <label htmlFor="application-search" className="sr-only">Szukaj osoby</label>
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-hs-meta pointer-events-none" strokeWidth={1.8} />
            <input
              id="application-search"
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Nick lub Discord ID"
              className="hs-field h-10 rounded-full bg-hs-sunken pl-10 pr-10 text-sm"
              data-testid="application-search"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Wyczyść wyszukiwanie"
                className="absolute right-2 top-1/2 -translate-y-1/2 hs-icon-btn w-7 h-7"
                data-testid="clear-application-search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-6 pb-8 pt-2" data-testid="no-applications">
            <EmptyState icon={FileText} title={searchTerm ? "Brak zgłoszeń pasujących do wyszukiwania" : "Brak zgłoszeń"}>
              {filter !== "all" ? `Filtr: ${activeFilter.label.toLowerCase()}.` : null}
            </EmptyState>
          </div>
        ) : (
          <>
            <div className="hidden md:grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_32px] gap-3 px-6 py-2.5 text-[13px] text-hs-meta border-b border-hs-line">
              <span>Osoba</span><span>Discord ID</span><span>Status</span><span className="text-right">Wysłane</span><span />
            </div>
            <ul data-testid="applications-list">
              {filtered.map((app, index) => (
                <ApplicationRow key={app.id} app={app} recruitmentId={id} last={index === filtered.length - 1} />
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

function ApplicationRow({ app, recruitmentId, last }) {
  const [copied, setCopied] = useState(false);
  const name = app.applicant_global_name || app.applicant_username;

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(app.applicant_discord_id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the ID is still selectable.
    }
  };

  return (
    <li
      className={`group relative grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_32px] items-center gap-x-3 gap-y-1.5 px-5 md:px-6 py-3 transition-colors hover:bg-[#111618] ${last ? "rounded-b-xl" : "border-b border-hs-raised"}`}
      data-testid={`app-row-${app.id}`}
    >
      <Link to={`/staff/recruitments/${recruitmentId}/applications/${app.id}`} className="flex items-center gap-3 min-w-0 text-hs-ink after:absolute after:inset-0 after:content-['']">
        <Avatar className="w-9 h-9 flex-none">
          <AvatarImage src={discordAvatarUrl(app.applicant_discord_id, app.applicant_avatar)} alt="" />
          <AvatarFallback className="bg-transparent p-0"><UserInitial name={name} size={36} /></AvatarFallback>
        </Avatar>
        <span className="min-w-0">
          <span className="block font-semibold truncate">{name}</span>
          <span className="block text-[13px] text-hs-meta truncate">@{app.applicant_username}</span>
        </span>
      </Link>
      <span className="hidden md:inline-flex items-center gap-2 font-mono text-[13px] text-hs-muted min-w-0">
        <span className="truncate" title={app.applicant_discord_id}>{app.applicant_discord_id}</span>
        <button type="button" onClick={copyId} className="relative z-10 text-hs-faint hover:text-hs-ink" aria-label="Kopiuj Discord ID" title={copied ? "Skopiowano" : "Kopiuj"}>
          {copied ? <Check className="w-3.5 h-3.5 text-hs-positive" /> : <Copy className="w-3.5 h-3.5" strokeWidth={1.8} />}
        </button>
      </span>
      <span className="justify-self-end md:justify-self-start"><StatusPill status={app.status} /></span>
      <span className="col-span-2 md:col-span-1 md:text-right text-[13px] md:text-[15px] text-hs-meta md:text-hs-chrome tabular-nums whitespace-nowrap pl-12 md:pl-0">{formatSent(app.created_at)}</span>
      <span aria-hidden="true" className="hidden md:block text-right text-hs-faint group-hover:text-hs-ink">→</span>
    </li>
  );
}
