import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { AlertTriangle, ArrowLeft, ChevronDown, History, Search, UserRound } from "lucide-react";
import axios from "axios";
import { API } from "../lib/api";
import AnswerList, { buildAnswerRows } from "../components/AnswerList";
import { EmptyState, PanelMark, Spinner, StatusPill, UserInitial } from "../components/hs";
import { CATEGORY_LABELS, discordAvatarUrl, pluralApplications } from "../lib/panels";

const avatarOf = (person, size) => discordAvatarUrl(person?.discord_id, person?.discord_avatar, size);
const nameOf = (person) => person?.discord_global_name || person?.discord_username || "?";

export default function StaffApplicationHistoryPage() {
  const { user, staffInfo, loading: authLoading } = useAuth();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [history, setHistory] = useState(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState(null);

  const isManagement = staffInfo?.is_management === true;

  useEffect(() => {
    if (!user || !isManagement) {
      setLoadingUsers(false);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setLoadingUsers(true);
      axios
        .get(`${API}/staff/application-history/users${query ? `?q=${encodeURIComponent(query)}` : ""}`, { withCredentials: true })
        .then((res) => {
          const list = Array.isArray(res.data) ? res.data : [];
          setUsers(list);
          setError(null);
          if (!selectedUserId && list.length > 0) {
            setSelectedUserId(list[0].id);
          }
        })
        .catch((err) => {
          setUsers([]);
          setError(err.response?.data?.error || "Nie udało się pobrać użytkowników");
        })
        .finally(() => setLoadingUsers(false));
    }, 250);

    return () => window.clearTimeout(timer);
  }, [user, isManagement, query, selectedUserId]);

  useEffect(() => {
    if (!user || !isManagement || !selectedUserId) return;

    setLoadingHistory(true);
    axios
      .get(`${API}/staff/application-history/users/${selectedUserId}`, { withCredentials: true })
      .then((res) => {
        setHistory(res.data);
        setError(null);
      })
      .catch((err) => {
        setHistory(null);
        setError(err.response?.data?.error || "Nie udało się pobrać historii");
      })
      .finally(() => setLoadingHistory(false));
  }, [user, isManagement, selectedUserId]);

  const selectedUser = useMemo(
    () => history?.user || users.find((item) => item.id === selectedUserId),
    [history, users, selectedUserId],
  );

  if (authLoading) {
    return <Spinner />;
  }

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <AlertTriangle className="w-10 h-10 text-hs-notice mx-auto mb-4" strokeWidth={1.6} />
        <p className="text-hs-chrome">Zaloguj się, aby zobaczyć historię podań.</p>
      </div>
    );
  }

  if (!isManagement) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center" data-testid="history-no-access">
        <AlertTriangle className="w-10 h-10 text-hs-notice mx-auto mb-4" strokeWidth={1.6} />
        <p className="text-hs-chrome">Dostęp do historii podań ma tylko management.</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1240px] mx-auto px-4 sm:px-8 pt-6 sm:pt-8 pb-16" data-testid="staff-application-history">
      <Link to="/staff" className="hs-back">
        <ArrowLeft className="w-4 h-4" strokeWidth={1.8} />Panel staff
      </Link>

      <h1 className="mt-6 hs-display text-[40px] sm:text-[44px] leading-[0.95]">Historia podań</h1>
      <p className="mt-2.5 text-base text-hs-chrome">Wszystkie zgłoszenia jednej osoby, we wszystkich panelach.</p>

      {error && <p className="mt-6 hs-note hs-note-bad" role="alert"><AlertTriangle className="w-4 h-4 mt-0.5 flex-none" />{error}</p>}

      <div className="mt-8 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-3">
          <div className="relative">
            <label htmlFor="history-search" className="sr-only">Szukaj osoby</label>
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-hs-meta pointer-events-none" strokeWidth={1.8} />
            <input
              id="history-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nick lub Discord ID"
              className="hs-field h-10 rounded-full bg-hs-sunken pl-10 text-sm"
              data-testid="history-user-search"
            />
          </div>

          <div className="hs-card overflow-hidden">
            {loadingUsers ? (
              <Spinner className="py-10" />
            ) : users.length === 0 ? (
              <p className="py-10 px-4 text-center text-[15px] text-hs-meta">Brak osób do wyświetlenia</p>
            ) : (
              <ul className="max-h-[680px] overflow-y-auto p-1.5">
                {users.map((item) => {
                  const isSelected = item.id === selectedUserId;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedUserId(item.id)}
                        aria-current={isSelected ? "true" : undefined}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors ${isSelected ? "bg-hs-raised" : "hover:bg-[#12171A]"}`}
                        data-testid={`history-user-${item.discord_username}`}
                      >
                        <Avatar className="w-9 h-9 flex-none">
                          <AvatarImage src={avatarOf(item, 96)} alt="" />
                          <AvatarFallback className="bg-transparent p-0"><UserInitial name={nameOf(item)} size={36} /></AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-medium truncate">{nameOf(item)}</span>
                          <span className="block text-[13px] text-hs-meta truncate">@{item.discord_username}</span>
                        </span>
                        <span className="text-sm text-hs-meta tabular-nums">{item.application_count}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        <main className="min-w-0">
          {!selectedUserId ? (
            <EmptyState icon={UserRound} title="Wybierz osobę z listy" />
          ) : loadingHistory ? (
            <Spinner className="py-20" />
          ) : history ? (
            <HistoryDetails user={selectedUser} applications={history.applications || []} />
          ) : null}
        </main>
      </div>
    </div>
  );
}

function HistoryDetails({ user, applications }) {
  return (
    <div className="flex flex-col gap-4" data-testid="history-details">
      <div className="hs-card p-5 flex items-center gap-4">
        <Avatar className="w-12 h-12 flex-none">
          <AvatarImage src={avatarOf(user, 96)} alt="" />
          <AvatarFallback className="bg-transparent p-0"><UserInitial name={nameOf(user)} size={48} /></AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold truncate">{nameOf(user)}</h2>
          <p className="text-sm text-hs-meta truncate">@{user?.discord_username} · <span className="font-mono text-[13px]">{user?.discord_id}</span></p>
        </div>
        <span className="hs-pill hs-pill-neutral">{applications.length} {pluralApplications(applications.length)}</span>
      </div>

      {applications.length === 0 ? (
        <EmptyState icon={History} title="Ta osoba nie ma zapisanych zgłoszeń" />
      ) : (
        applications.map((application) => (
          <HistoryApplication key={application.id} application={application} />
        ))
      )}
    </div>
  );
}

function HistoryApplication({ application }) {
  const [isOpen, setIsOpen] = useState(false);
  const recruitment = application.recruitment || {};
  const rows = buildAnswerRows(application.questions_snapshot, application.answers);

  return (
    <section className="hs-card" data-testid={`history-application-${application.id}`}>
      <div className="p-5 flex items-start gap-4">
        <PanelMark name={recruitment.name} themeColor={recruitment.theme_color} category={recruitment.category} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h3 className="text-[17px] font-semibold">{recruitment.name || "Usunięta rekrutacja"}</h3>
            {recruitment.deleted && <span className="hs-pill hs-pill-neutral">usunięty panel</span>}
            <StatusPill status={application.status} className="ml-auto" />
          </div>
          <p className="mt-1 text-sm text-hs-meta">
            {CATEGORY_LABELS[recruitment.category] || CATEGORY_LABELS.general} · {new Date(application.created_at).toLocaleString("pl-PL")} · {rows.length} odpowiedzi
          </p>
          {application.status === "odrzucone" && application.rejection_reason && (
            <p className="mt-2 text-sm text-hs-negative whitespace-pre-wrap" data-testid={`history-rejection-reason-${application.id}`}>
              Powód: {application.rejection_reason}
            </p>
          )}
        </div>
      </div>

      <div className="px-5 pb-5">
        <button
          type="button"
          onClick={() => setIsOpen((value) => !value)}
          aria-expanded={isOpen}
          className="flex w-full items-center justify-between gap-3 rounded-lg bg-hs-sunken px-4 h-11 text-left text-[15px] font-medium text-hs-chrome transition-colors hover:text-white"
          data-testid={`toggle-history-answers-${application.id}`}
        >
          <span>{isOpen ? "Ukryj odpowiedzi" : "Pokaż odpowiedzi"} ({rows.length})</span>
          <ChevronDown className={`w-4 h-4 flex-none transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {isOpen && (
          <div className="mt-3" data-testid={`history-answers-${application.id}`}>
            <AnswerList rows={rows} nested itemTestId={`history-answer-${application.id}`} downloadTestId={`history-download-${application.id}`} />
          </div>
        )}
      </div>
    </section>
  );
}
