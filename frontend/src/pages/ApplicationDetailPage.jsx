import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { Loader2, ArrowLeft, Clock, FileText, FileCode, Download } from "lucide-react";
import axios from "axios";
import { API } from "../lib/api";
import { parseVideoFromOptions } from "../lib/videoQuestion";
import VideoPlayer from "../components/VideoPlayer";


const STATUS_CONFIG = {
  nowe: { label: "Nowe", classes: "bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30" },
  zaakceptowane: { label: "Zaakceptowane", classes: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" },
  odrzucone: { label: "Odrzucone", classes: "bg-red-500/15 text-red-400 border border-red-500/30" },
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
    // 
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

export default function ApplicationDetailPage() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    axios
      .get(`${API}/applications/${id}`, { withCredentials: true })
      .then((res) => setApplication(res.data))
      .catch((err) => setError(err.response?.data?.detail || "Nie udało się załadować aplikacji"))
      .finally(() => setLoading(false));
  }, [id, user]);

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-32" data-testid="application-detail-loading">
        <Loader2 className="w-8 h-8 animate-spin text-[#00E5FF]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-zinc-400">Zaloguj się, aby zobaczyć aplikację.</p>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-zinc-400 mb-4">{error || "Aplikacja nie znaleziona"}</p>
        <Link to="/my-applications" className="text-[#00E5FF] text-sm hover:underline">Powrót</Link>
      </div>
    );
  }

  const status = STATUS_CONFIG[application.status] || STATUS_CONFIG.nowe;

  const answerMap = {};
  for (const ans of application.answers) {
    answerMap[ans.question_id] = ans;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8" data-testid="application-detail">
      {/* Back link */}
      <Link
        to="/my-applications"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-6"
        data-testid="back-to-applications"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Moje zgłoszenia
      </Link>

      {/* Header */}
      <div className="hs-animate-fade-up mb-8">
        <div className="flex items-center gap-3 mb-3">
          <FileText className="w-5 h-5 text-[#00E5FF]" />
          <h1
            className="text-xl sm:text-2xl font-bold tracking-tight"
            style={{ fontFamily: "'Unbounded', sans-serif", color: "#FAFAFA" }}
            data-testid="application-recruitment-name"
          >
            {application.recruitment_name}
          </h1>
        </div>
        <div className="flex items-center gap-4 ml-8 flex-wrap">
          <Badge className={`${status.classes} text-xs font-mono uppercase px-2.5 py-0.5`} data-testid="application-status-badge">
            {status.label}
          </Badge>
          <span className="text-xs text-zinc-500 flex items-center gap-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            <Clock className="w-3 h-3" />
            {new Date(application.created_at).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" })}
          </span>
          {application.reviewer_name && application.status !== 'nowe' && (
            <span className="text-xs text-zinc-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              Sprawdził: {application.reviewer_name}
            </span>
          )}
        </div>
      </div>

      <Separator className="mb-8 border-white/5" />

      {/* Answers (read-only) */}
      <div className="space-y-4" data-testid="application-answers">
        {(application.questions_snapshot || []).map((q) => {
          const ans = answerMap[q.id];
          let displayValue = ans?.answer_value || "";
          const codeFiles = q.field_type === "code" ? parseCodeFiles(displayValue) : [];
          const questionVideo = q.field_type === "video" ? parseVideoFromOptions(q.options) : null;
          if (q.field_type === "multi_choice" && displayValue) {
            try {
              const parsed = JSON.parse(displayValue);
              if (Array.isArray(parsed)) displayValue = parsed.join(", ");
            } catch {
              // 
            }
          }

          return (
            <div key={q.id} className="rounded-xl bg-[#0F0F13] border border-white/5 p-5" data-testid={`answer-${q.id}`}>
              <p className="text-sm font-medium text-zinc-400 mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
                {q.label}
                {q.required && <span className="text-red-400/50 ml-1">*</span>}
              </p>
              {codeFiles.length > 0 ? (
                <div className="space-y-3">
                  {codeFiles.map((codeFile, index) => (
                    <details key={`${codeFile.filename}-${index}`} className="rounded-lg border border-white/10 bg-black/30">
                      <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2 text-sm text-zinc-200">
                        <FileCode className="w-4 h-4 text-[#00E5FF] shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{codeFile.filename}</span>
                        <span className="text-xs text-zinc-500">{codeFile.language} · {formatBytes(codeFile.size)}</span>
                      </summary>
                      <div className="border-t border-white/5">
                        <pre className="max-h-[420px] overflow-auto p-4 text-xs leading-relaxed text-zinc-200" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                          <code>{codeFile.content}</code>
                        </pre>
                        <div className="flex justify-end border-t border-white/5 px-3 py-2">
                          <button
                            type="button"
                            onClick={() => downloadCodeFile(codeFile)}
                            className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/10"
                            data-testid={`download-own-code-${q.id}-${index}`}
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
                  <VideoPlayer video={questionVideo} testId={`answer-video-${q.id}`} />
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

      {/* Footer note */}
      <div className="mt-8 text-center">
        <p className="text-xs text-zinc-600" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          Zgłoszenia nie mogą być edytowane po wysłaniu.
        </p>
      </div>
    </div>
  );
}
