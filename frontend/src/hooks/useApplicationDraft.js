import { useCallback, useEffect, useRef, useState } from "react";

// Drafts live in this browser only: they survive a closed tab, a crash or a lost connection,
// and are removed once the application is sent.
const DRAFT_VERSION = 1;
const SAVE_DELAY_MS = 500;

const draftKey = (userId, recruitmentId) => `hs-draft:v${DRAFT_VERSION}:${userId}:${recruitmentId}`;

function isFilled(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return typeof value.content === "string" && value.content.trim() !== "";
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function isCodeAnswer(value) {
  const files = Array.isArray(value) ? value : [value];
  return files.some((file) => file && typeof file === "object" && typeof file.content === "string");
}

function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function removeStorage(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage can be blocked entirely (private mode); there is nothing to remove then.
  }
}

function writeStorage(key, draft) {
  try {
    window.localStorage.setItem(key, JSON.stringify(draft));
    return "saved";
  } catch {
    // Usually the storage quota: code files can be large, so keep at least the typed answers.
    const textOnly = Object.fromEntries(Object.entries(draft.answers).filter(([, value]) => !isCodeAnswer(value)));
    try {
      window.localStorage.setItem(key, JSON.stringify({ ...draft, answers: textOnly }));
      return "partial";
    } catch {
      return "error";
    }
  }
}

/**
 * Keeps the answers of one application form in localStorage while it is being filled in.
 * `answers` must keep the identity of its initial empty object until something changes,
 * so the untouched form never overwrites a saved draft.
 */
export function useApplicationDraft({ userId, recruitmentId, questionIds, enabled, answers, sectionIndex, onRestore }) {
  const [status, setStatus] = useState("idle");
  const [savedAt, setSavedAt] = useState(null);
  const [restoredAt, setRestoredAt] = useState(null);
  const initialAnswersRef = useRef(answers);
  const latestRef = useRef({ answers, sectionIndex });
  // What was last written (or deliberately cleared), so a flush knows whether anything is pending.
  const writtenRef = useRef({ answers, sectionIndex });
  const timerRef = useRef(null);
  const restoredKeyRef = useRef(null);
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;
  latestRef.current = { answers, sectionIndex };

  const key = enabled && userId && recruitmentId ? draftKey(userId, recruitmentId) : null;
  const questionKey = (questionIds || []).join(",");

  useEffect(() => {
    if (!key || restoredKeyRef.current === key) return;
    restoredKeyRef.current = key;
    const raw = readStorage(key);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      const known = new Set(questionKey.split(","));
      // Questions may have changed since the draft was written; only matching answers come back.
      const restored = Object.fromEntries(
        Object.entries(draft.answers || {}).filter(([id, value]) => known.has(id) && isFilled(value)),
      );
      if (Object.keys(restored).length === 0) return;
      onRestoreRef.current?.({ answers: restored, sectionIndex: Number(draft.sectionIndex) || 0 });
      setRestoredAt(draft.savedAt || null);
      setSavedAt(draft.savedAt || null);
      setStatus("saved");
    } catch {
      removeStorage(key);
    }
  }, [key, questionKey]);

  const save = useCallback(() => {
    if (!key) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
    const { answers: current, sectionIndex: index } = latestRef.current;
    writtenRef.current = { answers: current, sectionIndex: index };
    const filled = Object.fromEntries(Object.entries(current || {}).filter(([, value]) => isFilled(value)));
    if (Object.keys(filled).length === 0) {
      removeStorage(key);
      setStatus("idle");
      setSavedAt(null);
      return;
    }
    const now = new Date().toISOString();
    const result = writeStorage(key, { answers: filled, sectionIndex: index, savedAt: now });
    setStatus(result);
    if (result !== "error") setSavedAt(now);
  }, [key]);

  useEffect(() => {
    if (!key || answers === initialAnswersRef.current) return undefined;
    setStatus((previous) => (previous === "error" ? previous : "saving"));
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(save, SAVE_DELAY_MS);
    return undefined;
  }, [key, answers, sectionIndex, save]);

  // Write the latest keystrokes at once when the page is hidden or closed, even when the
  // debounce has not been scheduled yet.
  useEffect(() => {
    if (!key) return undefined;
    const flush = () => {
      const latest = latestRef.current;
      const written = writtenRef.current;
      const pending = latest.answers !== written.answers || latest.sectionIndex !== written.sectionIndex;
      if (latest.answers !== initialAnswersRef.current && pending) save();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [key, save]);

  const clear = useCallback(() => {
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
    // The answers on screen now count as handled: leaving the page must not write them back.
    writtenRef.current = { ...latestRef.current };
    if (key) removeStorage(key);
    setStatus("idle");
    setSavedAt(null);
    setRestoredAt(null);
  }, [key]);

  return { status, savedAt, restoredAt, clear };
}
