import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Loader2, ArrowLeft, CheckCircle, XCircle, Clock, AlertTriangle, FileCode, Download, Trash2 } from "lucide-react";
import axios from "axios";
import { API } from "../lib/api";
import { parseVideoFromOptions } from "../lib/videoQuestion";
import VideoPlayer from "../components/VideoPlayer";


const STATUS_CFG = {
  nowe: { label: "Nowe", cls: "bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30" },
  zaakceptowane: { label: "Zaakceptowane", cls: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" },
  odrzucone: { label: "Odrzucone", cls: "bg-red-500/15 text-red-400 border border-red-500/30" },
};

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
  } catch {
    // keep as plain answer
  }
  return [];
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

export default function StaffApplicationDetailPage() {
  const { recId, appId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [changing, setChanging] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchApp = () => {
    if (!user) { setLoading(false); return; }
    axios.get(`${API}/staff/recruitments/${recId}/applications/${appId}`, { withCredentials: true })
      .then(res => setApp(res.data))
      .catch(err => setError(err.response?.data?.detail || "Nie udało się załadować"))
      .finally(() => setLoading(false));
  };

  useEffect(fetchApp, [recId, appId, user]);

  const changeStatus = async (newStatus) => {
    setChanging(true);
    try {
      const res = await axios.patch(`${API}/staff/recruitments/${recId}/applications/${appId}/status`,
        { status: newStatus }, { withCredentials: true });
      setApp(prev => ({ ...prev, status: newStatus, discord_role_result: res.data.discord_role_result }));
    } catch (err) {
      setError(err.response?.data?.detail || "Błąd zmiany statusu");
    } finally {
      setChanging(false);
    }
  };

  const deleteApplication = async () => {
    if (!window.confirm("Na pewno usunac to podanie? Tej akcji nie mozna cofnac.")) return;

    setDeleting(true);
    setError(null);
    try {
      await axios.delete(`${API}/staff/recruitments/${recId}/applications/${appId}`, { withCredentials: true });
      navigate(`/staff/recruitments/${recId}/applications`);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || "Nie udalo sie usunac podania");
      setDeleting(false);
    }
  };

  if (loading) return <div className="flex justify-center py-32"><Loader2 className="w-8 h-8 animate-spin text-[#00E5FF]" /></div>;
  if (error && !app) return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
      <p className="text-zinc-400 mb-3">{error}</p>
      <Link to={`/staff/recruitments/${recId}/applications`} className="text-[#00E5FF] text-sm hover:underline">Powrót</Link>
    </div>
  );
  if (!app) return null;

  const st = STATUS_CFG[app.status] || STATUS_CFG.nowe;
  const avatarUrl = app.applicant_avatar
    ? `https://cdn.discordapp.com/avatars/${app.applicant_discord_id}/${app.applicant_avatar}.png?size=128`
    : null;

  const answerMap = {};
  for (const a of app.answers) answerMap[a.question_id] = a;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8" data-testid="staff-app-detail">
      <Link to={`/staff/recruitments/${recId}/applications`}
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-6"
        data-testid="back-to-apps-list">
        <ArrowLeft className="w-3.5 h-3.5" />Aplikacje — {app.recruitment_name}
      </Link>

      {/* Applicant header */}
      <div className="hs-animate-fade-up rounded-xl bg-[#141418] border border-white/10 p-6 mb-6" data-testid="applicant-header">
        <div className="flex items-center gap-4 mb-4">
          <Avatar className="w-14 h-14 border-2 border-[#00E5FF]/30">
            <AvatarImage src={avatarUrl} />
            <AvatarFallback className="bg-zinc-900 text-[#00E5FF] text-xl font-bold">
              {(app.applicant_global_name || app.applicant_username || "?")[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-lg font-semibold text-zinc-200" style={{ fontFamily: "'Outfit', sans-serif" }}
              data-testid="applicant-name">
              {app.applicant_global_name || app.applicant_username}
            </h2>
            <p className="text-sm text-zinc-500">@{app.applicant_username} &middot; {app.applicant_discord_id}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <Badge className={`${st.cls} text-xs font-mono uppercase`} data-testid="app-status-badge">{st.label}</Badge>
          <span className="text-xs text-zinc-500 flex items-center gap-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            <Clock className="w-3 h-3" />
            {new Date(app.created_at).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" })}
          </span>
        </div>

        {/* Status change actions */}
        {app.status === "nowe" && (
          <div className="flex gap-3 mt-5 pt-4 border-t border-white/5">
            <button onClick={() => changeStatus("zaakceptowane")} disabled={changing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
              data-testid="accept-button">
              <CheckCircle className="w-4 h-4" />{changing ? "..." : "Zaakceptuj"}
            </button>
            <button onClick={() => changeStatus("odrzucone")} disabled={changing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-colors disabled:opacity-50"
              data-testid="reject-button">
              <XCircle className="w-4 h-4" />{changing ? "..." : "Odrzuć"}
            </button>
          </div>
        )}

        {app.can_delete_application && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={deleteApplication}
              disabled={deleting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-red-500/10 text-red-300 border border-red-500/25 hover:bg-red-500/20 transition-colors disabled:opacity-50"
              data-testid="delete-application-button"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {deleting ? "Usuwanie..." : "Usun podanie"}
            </button>
          </div>
        )}

        {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
        {app.discord_role_result?.attempted && !app.discord_role_result?.success && (
          <p className="text-sm text-amber-400 mt-3">
            Aplikacja zaakceptowana, ale Discord nie potwierdzil nadania roli.
          </p>
        )}
      </div>

      <Separator className="mb-6 border-white/5" />

      {/* Answers */}
      <div className="space-y-4" data-testid="staff-answers">
        {(app.questions_snapshot || []).map(q => {
          const ans = answerMap[q.id];
          let displayValue = ans?.answer_value || "";
          const codeFiles = q.field_type === "code" ? parseCodeFiles(displayValue) : [];
          const questionVideo = q.field_type === "video" ? parseVideoFromOptions(q.options) : null;
          if (q.field_type === "multi_choice" && displayValue) {
            try { const p = JSON.parse(displayValue); if (Array.isArray(p)) displayValue = p.join(", "); } catch {}
          }
          return (
            <div key={q.id} className="rounded-xl bg-[#0F0F13] border border-white/5 p-5" data-testid={`staff-answer-${q.id}`}>
              <p className="text-sm font-medium text-zinc-400 mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                {q.label}{q.required && <span className="text-red-400/50 ml-1">*</span>}
              </p>
              {codeFiles.length > 0 ? (
                <div className="space-y-3">
                  {codeFiles.map((codeFile, index) => (
                    <details key={`${codeFile.filename}-${index}`} className="group rounded-lg border border-white/10 bg-black/30" open={index === 0}>
                      <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2 text-sm text-zinc-200">
                        <FileCode className="w-4 h-4 text-[#00E5FF] shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{codeFile.filename}</span>
                        <span className="text-xs text-zinc-500">{codeFile.language} · {formatBytes(codeFile.size)}</span>
                      </summary>
                      <div className="border-t border-white/5">
                        <pre className="max-h-[520px] overflow-auto p-4 text-xs leading-relaxed text-zinc-200" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                          <code>{codeFile.content}</code>
                        </pre>
                        <div className="flex justify-end border-t border-white/5 px-3 py-2">
                          <button
                            type="button"
                            onClick={() => downloadCodeFile(codeFile)}
                            className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/10"
                            data-testid={`download-code-${q.id}-${index}`}
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
                  <VideoPlayer video={questionVideo} testId={`staff-answer-video-${q.id}`} />
                  <p className="text-sm text-zinc-200 whitespace-pre-wrap" style={{ fontFamily: "'Outfit', sans-serif" }}>
                    {displayValue || <span className="text-zinc-600 italic">Brak odpowiedzi</span>}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-zinc-200 whitespace-pre-wrap" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  {displayValue || <span className="text-zinc-600 italic">Brak odpowiedzi</span>}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
