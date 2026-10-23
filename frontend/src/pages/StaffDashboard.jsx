import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Switch } from "../components/ui/switch";
import { Loader2, Plus, ShieldCheck, AlertTriangle, Lock, Trash2, History, BarChart3, Pencil } from "lucide-react";
import axios from "axios";
import { API } from "../lib/api";
import { EmptyState, PanelMark, Spinner } from "../components/hs";
import { CATEGORY_LABELS, getCategory } from "../lib/panels";

const ROLE_LABELS = {
  management: "Management",
  opiekun: "Opiekun",
  opiekun_administracji: "Opiekun Administracji",
  accepted_adm: "Accepted ADM",
};

const PERMISSION_LABELS = {
  full: "pełne",
  all: "ALL",
  editor: "edytor",
  reviewer: "recenzent",
  deleter: "usuwanie podań",
  statistics: "statystyki",
};

const formatNumber = (value) => Number(value || 0).toLocaleString("pl-PL");

function newApplicationsText(count) {
  if (count === 1) return "1 nowe zgłoszenie czeka";
  const lastDigit = count % 10;
  const lastTwo = count % 100;
  const few = lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14);
  return `${count} ${few ? "nowe zgłoszenia czekają" : "nowych zgłoszeń czeka"}`;
}

export default function StaffDashboard() {
  const { user, staffInfo, loading: authLoading, refetchStaff } = useAuth();
  const [recruitments, setRecruitments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);

  useEffect(() => {
    if (!user || !staffInfo?.is_staff) {
      setLoading(false);
      return;
    }

    setLoading(true);
    axios
      .get(`${API}/staff/recruitments`, { withCredentials: true })
      .then((res) => setRecruitments(Array.isArray(res.data) ? res.data : []))
      .catch(() => setRecruitments([]))
      .finally(() => setLoading(false));
  }, [user, staffInfo]);

  if (authLoading) {
    return <Spinner />;
  }

  const diagnostics = `Role Discord: ${staffInfo?.discord_role_count ?? 0} · źródło: ${staffInfo?.role_resolution_source || "nieznane"} · serwer ${staffInfo?.configured_guild_id || "nieznany"}`;

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center" data-testid="staff-login-required">
        <Lock className="w-10 h-10 text-hs-faint mx-auto mb-4" strokeWidth={1.6} />
        <p className="text-lg text-hs-chrome">Zaloguj się, aby uzyskać dostęp do panelu.</p>
      </div>
    );
  }

  if (!staffInfo?.is_staff) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center" data-testid="staff-no-access">
        <AlertTriangle className="w-10 h-10 text-hs-notice mx-auto mb-4" strokeWidth={1.6} />
        <h1 className="hs-display text-[40px]">Brak dostępu</h1>
        <p className="mt-3 text-hs-chrome">Twoje konto Discord nie ma roli uprawniającej do panelu staff.</p>
        <p className="mt-2 text-[15px] text-hs-meta">Wymagana rola: management, opiekun lub opiekun administracji.</p>
        <p className="mt-5 text-[13px] text-hs-faint">{diagnostics}</p>
      </div>
    );
  }

  const mappedRoles = Array.isArray(staffInfo.roles) ? staffInfo.roles : [];
  const isManagement = staffInfo?.is_management === true;

  const handleDeleteRecruitment = async (rec) => {
    if (!window.confirm(`Usunąć panel "${rec.name}"? Zgłoszenia zostaną w historii, ale panel zniknie.`)) return;

    setDeletingId(rec.id);
    try {
      await axios.delete(API + "/staff/recruitments/" + rec.id, { withCredentials: true });
      setRecruitments(prev => prev.filter(item => item.id !== rec.id));
      refetchStaff?.();
    } catch (err) {
      window.alert(err.response?.data?.error || "Nie udało się usunąć panelu");
    } finally {
      setDeletingId(null);
    }
  };

  const handleStatusToggle = async (rec, checked) => {
    const nextStatus = checked ? "active" : "inactive";
    setUpdatingStatusId(rec.id);
    try {
      const res = await axios.patch(
        API + "/staff/recruitments/" + rec.id + "/status",
        { status: nextStatus },
        { withCredentials: true }
      );
      setRecruitments(prev => prev.map(item => (
        item.id === rec.id ? { ...item, status: res.data.status || nextStatus } : item
      )));
    } catch (err) {
      window.alert(err.response?.data?.error || "Nie udało się zmienić statusu panelu");
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Panels with new applications come first: that is the work waiting.
  const panels = [...recruitments].sort((a, b) => (b.pending_count || 0) - (a.pending_count || 0));
  const pendingTotal = recruitments.reduce((sum, rec) => sum + (rec.pending_count || 0), 0);
  const applicationTotal = recruitments.reduce((sum, rec) => sum + (rec.app_count || 0), 0);
  const openCount = recruitments.filter((rec) => rec.status === "active").length;
  const openComplaints = recruitments.filter((rec) => rec.status === "active" && getCategory(rec) === "complaints").length;
  const queue = panels.filter((rec) => rec.pending_count > 0 && (rec.can_review_applications || rec.can_delete_applications));
  const panelsWithPending = recruitments.filter((rec) => rec.pending_count > 0).length;

  return (
    <div className="max-w-[1240px] mx-auto px-4 sm:px-8 pt-8 sm:pt-10 pb-16" data-testid="staff-dashboard">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
        <div>
          <div className="flex flex-wrap items-center gap-3.5">
            <h1 className="hs-display text-[40px] sm:text-[44px] leading-[0.95]" data-testid="staff-title">Panel staff</h1>
            {mappedRoles.map((role) => (
              <span key={role} className="hs-pill hs-pill-neutral">{ROLE_LABELS[role] || role}</span>
            ))}
          </div>
          {!loading && (
            <p className="mt-2.5 text-base text-hs-chrome">
              {pendingTotal > 0
                ? `${newApplicationsText(pendingTotal)} na decyzję w ${panelsWithPending} ${panelsWithPending === 1 ? "panelu" : "panelach"}.`
                : "Wszystkie zgłoszenia są rozpatrzone."}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {isManagement && (
            <Link to="/staff/history" className="hs-btn hs-btn-ghost" data-testid="application-history-button">
              <History className="w-4 h-4" strokeWidth={1.8} /> Historia podań
            </Link>
          )}
          {staffInfo.can_create_recruitment && (
            <Link to="/staff/recruitments/new?category=complaints" className="hs-btn hs-btn-ghost" data-testid="create-complaint-panel-button">
              <Plus className="w-4 h-4" strokeWidth={1.8} /> Nowy panel skarg
            </Link>
          )}
          {staffInfo.can_create_recruitment ? (
            <Link to="/staff/recruitments/new" className="hs-btn hs-btn-primary" data-testid="create-recruitment-button">
              <Plus className="w-4 h-4" strokeWidth={2} /> Nowa rekrutacja
            </Link>
          ) : staffInfo.creation_limit_reached ? (
            <p className="self-center text-sm text-hs-meta" data-testid="creation-limit-reached">
              Osiągnięto limit rekrutacji (maks. 1 dla opiekuna)
            </p>
          ) : null}
        </div>
      </div>

      {loading ? (
        <Spinner className="py-20" />
      ) : recruitments.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon={ShieldCheck} title="Nie masz jeszcze dostępu do żadnego panelu" data-testid="no-staff-recruitments" />
        </div>
      ) : (
        <div className="mt-8 flex flex-col lg:flex-row gap-6 lg:items-start">
          <div className="flex-1 min-w-0 flex flex-col gap-4">
            <dl className="hs-card grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-hs-line">
              <div className="px-6 py-5">
                <dt className="text-sm text-hs-meta">Nowe zgłoszenia</dt>
                <dd className="mt-1.5 text-[32px] font-semibold leading-none tabular-nums text-hs-accent-soft">{formatNumber(pendingTotal)}</dd>
                <dd className="mt-1.5 text-[13px] text-hs-meta">w {panelsWithPending} z {recruitments.length} paneli</dd>
              </div>
              <div className="px-6 py-5">
                <dt className="text-sm text-hs-meta">Wszystkie zgłoszenia</dt>
                <dd className="mt-1.5 text-2xl font-medium leading-none tabular-nums">{formatNumber(applicationTotal)}</dd>
                <dd className="mt-1.5 text-[13px] text-hs-meta">w Twoich panelach</dd>
              </div>
              <div className="px-6 py-5">
                <dt className="text-sm text-hs-meta">Przyjmują zgłoszenia</dt>
                <dd className="mt-1.5 text-2xl font-medium leading-none tabular-nums">{openCount} <span className="text-[15px] text-hs-meta">/ {recruitments.length} paneli</span></dd>
                <dd className="mt-1.5 text-[13px] text-hs-meta">{openCount - openComplaints} rekrutacji, {openComplaints} skarg</dd>
              </div>
            </dl>

            <section aria-labelledby="panele-h" className="hs-card pt-2 pb-1" data-testid="staff-recruitments-list">
              <h2 id="panele-h" className="px-5 sm:px-6 pt-3 pb-2 text-base font-semibold">Twoje panele</h2>

              <table className="hidden md:table w-full text-[15px]">
                <thead>
                  <tr className="text-left text-[13px] text-hs-meta">
                    <th scope="col" className="font-normal px-6 py-2.5 border-b border-hs-line">Panel</th>
                    <th scope="col" className="font-normal px-3 py-2.5 text-right border-b border-hs-line">Zgłoszenia</th>
                    <th scope="col" className="font-normal px-3 py-2.5 text-right border-b border-hs-line">Nowe</th>
                    <th scope="col" className="font-normal px-3 py-2.5 border-b border-hs-line">Przyjmowanie</th>
                    <th scope="col" className="px-6 py-2.5 border-b border-hs-line"><span className="sr-only">Akcje</span></th>
                  </tr>
                </thead>
                <tbody>
                  {panels.map((rec, index) => (
                    <PanelRow
                      key={rec.id}
                      rec={rec}
                      last={index === panels.length - 1}
                      deleting={deletingId === rec.id}
                      updating={updatingStatusId === rec.id}
                      onToggle={handleStatusToggle}
                      onDelete={handleDeleteRecruitment}
                    />
                  ))}
                </tbody>
              </table>

              <ul className="md:hidden">
                {panels.map((rec) => (
                  <PanelCard
                    key={rec.id}
                    rec={rec}
                    deleting={deletingId === rec.id}
                    updating={updatingStatusId === rec.id}
                    onToggle={handleStatusToggle}
                    onDelete={handleDeleteRecruitment}
                  />
                ))}
              </ul>
            </section>
          </div>

          <aside aria-labelledby="kolejka" className="lg:w-[340px] flex-none">
            <h2 id="kolejka" className="mb-2 text-base font-semibold">Do rozpatrzenia</h2>
            {queue.length === 0 ? (
              <p className="hs-card px-5 py-4 text-[15px] text-hs-meta">Nie ma nowych zgłoszeń w Twoich panelach.</p>
            ) : (
              <ul className="hs-card px-5 py-2">
                {queue.map((rec, index) => (
                  <li key={rec.id} className={`flex items-center gap-3 py-3 ${index < queue.length - 1 ? "border-b border-hs-raised" : ""}`}>
                    <PanelMark recruitment={rec} size={36} />
                    <span className="flex-1 min-w-0">
                      <span className="block font-semibold leading-snug">{rec.name}</span>
                      <span className="block text-[13px] text-hs-meta">{rec.pending_count} nowe · {formatNumber(rec.app_count)} w panelu</span>
                    </span>
                    <Link to={`/staff/recruitments/${rec.id}/applications?status=nowe`} className="hs-btn hs-btn-ghost hs-btn-sm">Rozpatrz</Link>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      )}

      <p className="mt-10 text-[13px] text-hs-faint">{diagnostics}</p>
    </div>
  );
}

function panelSubline(rec) {
  const category = CATEGORY_LABELS[getCategory(rec)] || CATEGORY_LABELS.general;
  const permission = PERMISSION_LABELS[rec.permission_level];
  return permission ? `${category} · uprawnienia: ${permission}` : category;
}

function StatusToggle({ rec, updating, onToggle }) {
  const isOpen = rec.status === "active";
  if (!rec.can_update_status) {
    return <span className={`text-sm ${isOpen ? "text-hs-chrome" : "text-hs-meta"}`}>{isOpen ? "Otwarte" : "Zamknięte"}</span>;
  }
  return (
    <span className="inline-flex items-center gap-2.5">
      <Switch
        checked={isOpen}
        disabled={updating}
        onCheckedChange={(checked) => onToggle(rec, checked)}
        className="data-[state=checked]:bg-[#2E9C63] data-[state=unchecked]:bg-hs-control"
        aria-label={`Przyjmowanie zgłoszeń: ${rec.name}`}
        data-testid={`toggle-rec-status-${rec.slug}`}
      />
      <span className={`text-sm ${isOpen ? "text-hs-chrome" : "text-hs-meta"}`}>{isOpen ? "Otwarte" : "Zamknięte"}</span>
    </span>
  );
}

function PanelActions({ rec, deleting, onDelete }) {
  const isComplaint = getCategory(rec) === "complaints";
  return (
    <div className="flex items-center justify-end gap-1">
      {(rec.can_review_applications || rec.can_delete_applications) && (
        <Link to={`/staff/recruitments/${rec.id}/applications`} className="hs-btn hs-btn-ghost hs-btn-sm mr-1" data-testid={`review-apps-${rec.slug}`}>
          {isComplaint ? "Skargi" : "Zgłoszenia"}
        </Link>
      )}
      {(rec.can_edit_questions || rec.can_update_status) && (
        <Link to={`/staff/recruitments/${rec.id}/edit`} className="hs-icon-btn" aria-label={`Edytuj panel ${rec.name}`} title="Edytuj" data-testid={`edit-rec-${rec.slug}`}>
          <Pencil className="w-4 h-4" strokeWidth={1.8} />
        </Link>
      )}
      {rec.can_view_statistics && (
        <Link to={`/staff/recruitments/${rec.id}/statistics`} className="hs-icon-btn" aria-label={`Statystyki panelu ${rec.name}`} title="Statystyki" data-testid={`statistics-${rec.slug}`}>
          <BarChart3 className="w-4 h-4" strokeWidth={1.8} />
        </Link>
      )}
      {rec.can_delete_recruitment && (
        <button
          type="button"
          onClick={() => onDelete(rec)}
          disabled={deleting}
          className="hs-icon-btn hover:text-hs-negative"
          aria-label={`Usuń panel ${rec.name}`}
          title="Usuń panel"
          data-testid={"delete-rec-" + rec.slug}
        >
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" strokeWidth={1.8} />}
        </button>
      )}
    </div>
  );
}

function PanelRow({ rec, last, deleting, updating, onToggle, onDelete }) {
  const cell = last ? "" : "border-b border-hs-raised";
  return (
    <tr className="transition-colors hover:bg-[#111618]" data-testid={`staff-rec-${rec.slug}`}>
      <td className={`px-6 py-3.5 ${cell}`}>
        <div className="flex items-center gap-3">
          <PanelMark recruitment={rec} size={36} />
          <div className="min-w-0">
            <p className="font-semibold">{rec.name}</p>
            <p className="text-[13px] text-hs-meta">{panelSubline(rec)}</p>
          </div>
        </div>
      </td>
      <td className={`px-3 py-3.5 text-right tabular-nums text-hs-chrome ${cell}`}>{formatNumber(rec.app_count)}</td>
      <td className={`px-3 py-3.5 text-right tabular-nums ${cell}`}>
        {rec.pending_count > 0 ? <span className="font-semibold text-hs-accent-soft">{rec.pending_count}</span> : <span className="text-hs-meta">0</span>}
      </td>
      <td className={`px-3 py-3.5 ${cell}`}><StatusToggle rec={rec} updating={updating} onToggle={onToggle} /></td>
      <td className={`px-6 py-3.5 ${cell}`}><PanelActions rec={rec} deleting={deleting} onDelete={onDelete} /></td>
    </tr>
  );
}

function PanelCard({ rec, deleting, updating, onToggle, onDelete }) {
  return (
    <li className="px-5 py-4 border-t border-hs-raised first:border-t-0" data-testid={`staff-rec-${rec.slug}`}>
      <div className="flex items-center gap-3">
        <PanelMark recruitment={rec} size={40} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold">{rec.name}</p>
          <p className="text-[13px] text-hs-meta">
            {formatNumber(rec.app_count)} zgłoszeń
            {rec.pending_count > 0 && <span className="text-hs-accent-soft font-semibold"> · {rec.pending_count} nowe</span>}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
        <StatusToggle rec={rec} updating={updating} onToggle={onToggle} />
        <PanelActions rec={rec} deleting={deleting} onDelete={onDelete} />
      </div>
    </li>
  );
}
