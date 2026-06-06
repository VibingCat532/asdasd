import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Separator } from "../components/ui/separator";
import { AlertTriangle, ArrowLeft, ChevronDown, Clock, Download, FileCode, History, Loader2, Search, UserRound } from "lucide-react";
import axios from "axios";
import { API } from "../lib/api";
import { parseVideoFromOptions } from "../lib/videoQuestion";
import VideoPlayer from "../components/VideoPlayer";

const STATUS_CFG = {
  nowe: { label: "Nowe", cls: "bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30" },
  zaakceptowane: { label: "Zaakceptowane", cls: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" },
  odrzucone: { label: "Odrzucone", cls: "bg-red-500/15 text-red-400 border border-red-500/30" },
};

function avatarUrl(user) {
  return user?.discord_avatar
    ? `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.discord_avatar}.png?size=96`
    : null;
}

function normalizeCodeFile(file) {
  if (!file || typeof file !== "object" || typeof file.content !== "string") return null;
  return {
    filename: file.filename || "code.txt",
    language: file.language || "Code",
    size: file.size || file.content.length,
    content: file.content,
  };
}

function parseCodeFiles(answerValue) {
  if (!answerValue) return [];
  try {
    const parsed = JSON.parse(answerValue);
    const files = Array.isArray(parsed) ? parsed : [parsed];
    return files.map(normalizeCodeFile).filter(Boolean);
  } catch {}
  return [];
}

function formatAnswer(question, answer) {
  const value = answer?.answer_value || "";
  if (question?.field_type === "multi_choice" && value) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.join(", ");
    } catch {}
  }
  return value;
}

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.round(bytes / 102.4) / 10} KB`;
}

function downloadCodeFile(code) {
  const blob = new Blob([code.content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = code.filename || "code.txt";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

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
          setError(err.response?.data?.error || "Nie udalo sie pobrac uzytkownikow");
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
        setError(err.response?.data?.error || "Nie udalo sie pobrac historii");
      })
      .finally(() => setLoadingHistory(false));
  }, [user, isManagement, selectedUserId]);

  const selectedUser = useMemo(
    () => history?.user || users.find((item) => item.id === selectedUserId),
    [history, users, selectedUserId],
  );

  if (authLoading) {
    return <div className="flex justify-center py-32"><Loader2 className="w-8 h-8 animate-spin text-[#00E5FF]" /></div>;
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <p className="text-zinc-400">Zaloguj sie, aby zobaczyc historie podan.</p>
      </div>
    );
  }

  if (!isManagement) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center" data-testid="history-no-access">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <p className="text-zinc-400">Dostep do historii podan ma tylko management.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8" data-testid="staff-application-history">
      <Link to="/staff" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-6">
        <ArrowLeft className="w-3.5 h-3.5" />Panel Staff
      </Link>

      <div className="hs-animate-fade-up mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00E5FF] mb-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          Opiekun Podań
        </p>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight uppercase" style={{ fontFamily: "'Unbounded', sans-serif", color: "#FAFAFA" }}>
          Historia podan
        </h1>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/5 border border-red-500/15 p-4 mb-6">
          <p className="text-sm text-red-400 flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5" />{error}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Szukaj po Discordzie..."
              className="bg-black/40 border-white/10 pl-9 text-zinc-100"
              data-testid="history-user-search"
            />
          </div>

          <div className="rounded-xl bg-[#0F0F13] border border-white/5 overflow-hidden">
            {loadingUsers ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-[#00E5FF]" />
              </div>
            ) : users.length === 0 ? (
              <div className="py-10 px-4 text-center text-sm text-zinc-500">
                Brak osob do wyswietlenia
              </div>
            ) : (
              <div className="max-h-[680px] overflow-y-auto">
                {users.map((item) => {
                  const isSelected = item.id === selectedUserId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedUserId(item.id)}
                      className={`w-full flex items-center gap-3 p-3 text-left border-b border-white/5 transition-colors ${
                        isSelected ? "bg-[#00E5FF]/10" : "hover:bg-white/[0.03]"
                      }`}
                      data-testid={`history-user-${item.discord_username}`}
                    >
                      <Avatar className="w-9 h-9 border border-white/10 shrink-0">
                        <AvatarImage src={avatarUrl(item)} />
                        <AvatarFallback className="bg-zinc-900 text-zinc-400 text-xs">
                          {(item.discord_global_name || item.discord_username || "?")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-zinc-200 truncate">{item.discord_global_name || item.discord_username}</span>
                        <span className="block text-xs text-zinc-500 truncate">@{item.discord_username}</span>
                      </span>
                      <Badge className="bg-white/5 text-zinc-500 border border-white/10 text-xs font-mono">
                        {item.application_count}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <main>
          {!selectedUserId ? (
            <div className="text-center py-20 rounded-xl bg-[#0F0F13] border border-white/5">
              <UserRound className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500">Wybierz osobe z listy</p>
            </div>
          ) : loadingHistory ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#00E5FF]" />
            </div>
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
    <div className="space-y-5" data-testid="history-details">
      <div className="rounded-xl bg-[#141418] border border-white/10 p-5">
        <div className="flex items-center gap-4">
          <Avatar className="w-12 h-12 border-2 border-[#00E5FF]/30">
            <AvatarImage src={avatarUrl(user)} />
            <AvatarFallback className="bg-zinc-900 text-[#00E5FF] font-bold">
              {(user?.discord_global_name || user?.discord_username || "?")[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-zinc-200 truncate" style={{ fontFamily: "'Outfit', sans-serif" }}>
              {user?.discord_global_name || user?.discord_username}
            </h2>
            <p className="text-sm text-zinc-500">@{user?.discord_username} · {user?.discord_id}</p>
          </div>
          <Badge className="ml-auto bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30 text-xs font-mono uppercase">
            {applications.length} podan
          </Badge>
        </div>
      </div>

      {applications.length === 0 ? (
        <div className="text-center py-16 rounded-xl bg-[#0F0F13] border border-white/5">
          <History className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500">Ta osoba nie ma zapisanych podan</p>
        </div>
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
  const status = STATUS_CFG[application.status] || STATUS_CFG.nowe;
  const questions = Array.isArray(application.questions_snapshot) ? application.questions_snapshot : [];
  const answers = Array.isArray(application.answers) ? application.answers : [];
  const answerMap = answers.reduce((map, answer) => {
    map[answer.question_id] = answer;
    return map;
  }, {});
  const shownQuestionIds = new Set(questions.map((question) => String(question.id)));
  const extraAnswers = answers.filter((answer) => !shownQuestionIds.has(String(answer.question_id)));
  const answerRows = [
    ...questions.map((question) => ({ question, answer: answerMap[question.id] })),
    ...extraAnswers.map((answer) => ({
      question: { id: answer.question_id, label: answer.question_label, field_type: answer.question_type },
      answer,
    })),
  ];

  return (
    <section className="rounded-xl bg-[#141418] border border-white/10 overflow-hidden" data-testid={`history-application-${application.id}`}>
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-0.5 w-10 rounded-full" style={{ background: application.recruitment?.theme_color || "#00E5FF" }} />
              {application.recruitment?.deleted && (
                <Badge className="bg-zinc-800/70 text-zinc-400 border border-zinc-700/50 text-[10px] font-mono uppercase">
                  usunieta rekrutacja
                </Badge>
              )}
            </div>
            <h3 className="text-base font-semibold text-zinc-100" style={{ fontFamily: "'Outfit', sans-serif" }}>
              {application.recruitment?.name || "Usunieta rekrutacja"}
            </h3>
            <p className="text-xs text-zinc-500 mt-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {new Date(application.created_at).toLocaleString("pl-PL")}
            </p>
          </div>
          <Badge className={`${status.cls} text-xs font-mono uppercase`}>{status.label}</Badge>
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-zinc-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />ID: {application.id}</span>
          <span>Kategoria: {application.recruitment?.category === "factions" ? "Frakcje" : "Ogolna"}</span>
          <span>{answerRows.length} odpowiedzi</span>
        </div>
      </div>

      <Separator className="border-white/5" />

      <div className="p-4">
        <button
          type="button"
          onClick={() => setIsOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/5 bg-black/20 px-4 py-3 text-left text-sm font-medium text-zinc-300 transition-colors hover:border-[#00E5FF]/25 hover:text-[#00E5FF]"
          data-testid={`toggle-history-answers-${application.id}`}
        >
          <span>{isOpen ? "Ukryj odpowiedzi" : "Pokaz odpowiedzi"} ({answerRows.length})</span>
          <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {isOpen && (
          <div className="mt-4 space-y-3" data-testid={`history-answers-${application.id}`}>
            {answerRows.map(({ question, answer }) => {
          const codeFiles = question.field_type === "code" ? parseCodeFiles(answer?.answer_value) : [];
          const questionVideo = question.field_type === "video" ? parseVideoFromOptions(question.options) : null;
          return (
            <div key={question.id} className="rounded-lg border border-white/5 bg-black/20 p-4">
              <p className="text-sm font-medium text-zinc-400 mb-2">{question.label}</p>
              {codeFiles.length > 0 ? (
                <div className="space-y-2">
                  {codeFiles.map((file, index) => (
                    <details key={`${file.filename}-${index}`} className="rounded-lg border border-white/10 bg-black/30" open={index === 0}>
                      <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2 text-sm text-zinc-200">
                        <FileCode className="w-4 h-4 text-[#00E5FF] shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{file.filename}</span>
                        <span className="text-xs text-zinc-500">{file.language} · {formatBytes(file.size)}</span>
                      </summary>
                      <div className="border-t border-white/5">
                        <pre className="max-h-[420px] overflow-auto p-4 text-xs leading-relaxed text-zinc-200" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                          <code>{file.content}</code>
                        </pre>
                        <div className="flex justify-end border-t border-white/5 px-3 py-2">
                          <button
                            type="button"
                            onClick={() => downloadCodeFile(file)}
                            className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/10"
                          >
                            <Download className="w-3.5 h-3.5" /> Pobierz plik
                          </button>
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
              ) : questionVideo?.src ? (
                <div className="space-y-4">
                  <VideoPlayer video={questionVideo} />
                  <p className="text-sm text-zinc-200 whitespace-pre-wrap">
                    {formatAnswer(question, answer) || <span className="text-zinc-600 italic">Brak odpowiedzi</span>}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-zinc-200 whitespace-pre-wrap">
                  {formatAnswer(question, answer) || <span className="text-zinc-600 italic">Brak odpowiedzi</span>}
                </p>
              )}
            </div>
          );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
