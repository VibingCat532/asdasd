import { Download, FileCode } from "lucide-react";
import { parseVideoFromOptions } from "../lib/videoQuestion";
import VideoPlayer from "./VideoPlayer";

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
    // Not a code answer after all: shown as plain text.
  }
  return [];
}

function formatAnswer(question, answer) {
  const value = answer?.answer_value || "";
  if (question?.field_type === "multi_choice" && value) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.join(", ");
    } catch {
      // Older answers were stored as plain text.
    }
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

// Questions from the snapshot first, then answers whose question no longer exists in it.
export function buildAnswerRows(questions, answers) {
  const questionList = Array.isArray(questions) ? questions : [];
  const answerList = Array.isArray(answers) ? answers : [];
  const answerMap = answerList.reduce((map, answer) => {
    map[answer.question_id] = answer;
    return map;
  }, {});
  const shownIds = new Set(questionList.map((question) => String(question.id)));
  return [
    ...questionList.map((question) => ({ question, answer: answerMap[question.id] })),
    ...answerList
      .filter((answer) => !shownIds.has(String(answer.question_id)))
      .map((answer) => ({
        question: { id: answer.question_id, label: answer.question_label, field_type: answer.question_type },
        answer,
      })),
  ];
}

function groupBySection(rows) {
  const groups = [];
  for (const row of rows) {
    const title = (row.question.section_title || "").trim();
    const last = groups[groups.length - 1];
    if (last && last.title === title) last.rows.push(row);
    else groups.push({ title, rows: [row] });
  }
  return groups;
}

export default function AnswerList({ rows, testId, itemTestId = "answer", downloadTestId = "download-code", videoTestId = "answer-video", nested = false }) {
  const groups = groupBySection(rows);
  const showTitles = groups.length > 1;

  return (
    <div className="flex flex-col gap-4" data-testid={testId}>
      {groups.map((group, groupIndex) => (
        <section key={`${group.title}-${groupIndex}`} className={`rounded-xl px-5 sm:px-7 py-2 ${nested ? "bg-hs-sunken" : "bg-hs-surface"}`}>
          {showTitles && (
            <h2 className="pt-4 pb-1 text-lg font-semibold">
              {group.title || "Ogólne"} <span className="text-sm font-normal text-hs-meta">· {group.rows.length} {group.rows.length === 1 ? "odpowiedź" : "odpowiedzi"}</span>
            </h2>
          )}
          <dl>
            {group.rows.map(({ question, answer }, index) => {
              const value = formatAnswer(question, answer);
              const codeFiles = question.field_type === "code" ? parseCodeFiles(answer?.answer_value) : [];
              const questionVideo = question.field_type === "video" ? parseVideoFromOptions(question.options) : null;
              return (
                <div
                  key={question.id}
                  className={`py-[18px] ${index < group.rows.length - 1 ? "border-b border-hs-raised" : ""}`}
                  data-testid={`${itemTestId}-${question.id}`}
                >
                  <dt className="text-sm text-hs-meta">{question.label}</dt>
                  <dd className="mt-1.5">
                    {codeFiles.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {codeFiles.map((codeFile, fileIndex) => (
                          <details key={`${codeFile.filename}-${fileIndex}`} className={`rounded-lg ${nested ? "bg-hs-surface" : "bg-hs-sunken"}`} open={fileIndex === 0}>
                            <summary className="flex cursor-pointer list-none items-center gap-3 px-3.5 py-2.5 text-[15px]">
                              <FileCode className="w-4 h-4 text-hs-accent flex-none" strokeWidth={1.8} />
                              <span className="min-w-0 flex-1 truncate">{codeFile.filename}</span>
                              <span className="text-[13px] text-hs-meta">{codeFile.language} · {formatBytes(codeFile.size)}</span>
                            </summary>
                            <div className="border-t border-hs-raised">
                              <pre className="max-h-[520px] overflow-auto p-4 text-[13px] leading-relaxed text-hs-ink"><code>{codeFile.content}</code></pre>
                              <div className="flex justify-end border-t border-hs-raised px-3 py-2">
                                <button
                                  type="button"
                                  onClick={() => downloadCodeFile(codeFile)}
                                  className="hs-btn hs-btn-ghost hs-btn-sm"
                                  data-testid={`${downloadTestId}-${question.id}-${fileIndex}`}
                                >
                                  <Download className="w-3.5 h-3.5" strokeWidth={1.8} /> Pobierz plik
                                </button>
                              </div>
                            </div>
                          </details>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {questionVideo?.src && <VideoPlayer video={questionVideo} testId={`${videoTestId}-${question.id}`} />}
                        <p className={`text-base whitespace-pre-wrap max-w-[68ch] ${value ? "text-hs-ink" : "text-hs-meta"}`}>
                          {value || "— brak odpowiedzi"}
                        </p>
                      </div>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
    </div>
  );
}
