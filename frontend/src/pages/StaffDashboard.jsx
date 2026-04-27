import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import { Loader2, Plus, ShieldCheck, Users, FileText, Settings, AlertTriangle, Lock, Trash2 } from "lucide-react";
import axios from "axios";
import { API } from "../lib/api";

const ROLE_LABELS = {
  management: "Management",
  opiekun: "Opiekun",
  opiekun_administracji: "Opiekun Administracji",
  accepted_adm: "Accepted ADM",
};

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
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-[#00E5FF]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center" data-testid="staff-login-required">
        <Lock className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
        <p className="text-zinc-400 text-lg">Zaloguj sie, aby uzyskac dostep do panelu.</p>
      </div>
    );
  }

  if (!staffInfo?.is_staff) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center" data-testid="staff-no-access">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-zinc-200 mb-2" style={{ fontFamily: "'Unbounded', sans-serif" }}>
          Brak dostepu
        </h2>
        <p className="text-zinc-400">Twoje konto Discord nie posiada roli uprawniajacej do panelu staff.</p>
        <p className="text-zinc-500 text-sm mt-2">
          Wymagana rola: management, opiekun lub opiekun administracji.
        </p>
        <p className="text-zinc-600 text-xs mt-4" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          Discord roles: {staffInfo?.discord_role_count ?? 0} | source: {staffInfo?.role_resolution_source || "unknown"} | guild: {staffInfo?.configured_guild_id || "unknown"}
        </p>
      </div>
    );
  }

  const mappedRoles = Array.isArray(staffInfo.roles) ? staffInfo.roles : [];

  const handleDeleteRecruitment = async (rec) => {
    if (!window.confirm('Usunac rekrutacje "' + rec.name + '"?')) return;

    setDeletingId(rec.id);
    try {
      await axios.delete(API + "/staff/recruitments/" + rec.id, { withCredentials: true });
      setRecruitments(prev => prev.filter(item => item.id !== rec.id));
      refetchStaff?.();
    } catch (err) {
      window.alert(err.response?.data?.error || "Nie udalo sie usunac rekrutacji");
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
      window.alert(err.response?.data?.error || "Nie udalo sie zmienic statusu rekrutacji");
    } finally {
      setUpdatingStatusId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8" data-testid="staff-dashboard">
      <div className="hs-animate-fade-up mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#00E5FF] mb-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          Panel Staff
        </p>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight uppercase" style={{ fontFamily: "'Unbounded', sans-serif", color: "#FAFAFA" }} data-testid="staff-title">
            Dashboard
          </h1>
          {mappedRoles.map((role) => (
            <Badge key={role} className="bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30 text-xs font-mono uppercase">
              {ROLE_LABELS[role] || role}
            </Badge>
          ))}
        </div>

        <p className="text-xs text-zinc-500 mb-4" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          Discord roles: {staffInfo.discord_role_count ?? 0} | source: {staffInfo.role_resolution_source || "unknown"} | guild: {staffInfo.configured_guild_id || "unknown"}
        </p>

        {staffInfo.can_create_recruitment ? (
          <Link
            to="/staff/recruitments/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-[#00E5FF] text-black hover:bg-[#00E5FF]/90 transition-colors"
            data-testid="create-recruitment-button"
          >
            <Plus className="w-4 h-4" /> Nowa Rekrutacja
          </Link>
        ) : staffInfo.creation_limit_reached ? (
          <p className="text-sm text-zinc-500" data-testid="creation-limit-reached">
            Osiagnieto limit rekrutacji (max 1 dla opiekuna)
          </p>
        ) : null}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#00E5FF]" />
        </div>
      ) : recruitments.length === 0 ? (
        <div className="text-center py-16 rounded-xl bg-[#0F0F13] border border-white/5" data-testid="no-staff-recruitments">
          <ShieldCheck className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-400">Brak dostepnych rekrutacji</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2" data-testid="staff-recruitments-list">
          {recruitments.map((rec) => (
            <div key={rec.id} className="rounded-xl bg-[#141418] border border-white/10 p-5 group" data-testid={`staff-rec-${rec.slug}`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="h-0.5 w-10 rounded-full mb-2" style={{ background: rec.theme_color }} />
                  <h3 className="text-base font-semibold text-zinc-200" style={{ fontFamily: "'Outfit', sans-serif" }}>
                    {rec.name}
                  </h3>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Badge
                    className={
                      rec.status === "active"
                        ? "bg-[#00E5FF]/15 text-[#00E5FF] border border-[#00E5FF]/30 text-xs font-mono uppercase"
                        : "bg-zinc-800/50 text-zinc-500 border border-zinc-700/30 text-xs font-mono uppercase"
                    }
                  >
                    {rec.status === "active" ? "aktywna" : "nieaktywna"}
                  </Badge>
                  <Badge
                    className={
                      rec.permission_level === "full"
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-mono uppercase"
                        : "bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs font-mono uppercase"
                    }
                  >
                    {rec.permission_level === "full" ? "pelny" : "recenzent"}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center gap-4 mb-4 text-xs text-zinc-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" /> {rec.app_count} aplikacji
                </span>
                {rec.pending_count > 0 && (
                  <span className="flex items-center gap-1 text-[#00E5FF]">
                    <FileText className="w-3 h-3" /> {rec.pending_count} nowych
                  </span>
                )}
              </div>

              {rec.can_update_status && (
                <div className="flex items-center justify-between gap-3 mb-4 rounded-lg border border-white/5 bg-black/20 px-3 py-2">
                  <span className="text-xs font-medium text-zinc-400">Aktywna rekrutacja</span>
                  <Switch
                    checked={rec.status === "active"}
                    disabled={updatingStatusId === rec.id}
                    onCheckedChange={(checked) => handleStatusToggle(rec, checked)}
                    className="data-[state=checked]:bg-[#00E5FF] data-[state=unchecked]:bg-zinc-800"
                    data-testid={`toggle-rec-status-${rec.slug}`}
                    title={rec.status === "active" ? "Ustaw jako nieaktywna" : "Ustaw jako aktywna"}
                  />
                </div>
              )}

              <div className="flex gap-2">
                <Link
                  to={`/staff/recruitments/${rec.id}/applications`}
                  className="flex-1 text-center px-3 py-2 rounded-lg text-xs font-medium bg-white/5 text-zinc-300 hover:bg-white/10 transition-colors"
                  data-testid={`review-apps-${rec.slug}`}
                >
                  <FileText className="w-3 h-3 inline mr-1" />Aplikacje
                </Link>
                <Link
                  to={`/staff/recruitments/${rec.id}/edit`}
                  className="flex-1 text-center px-3 py-2 rounded-lg text-xs font-medium bg-white/5 text-zinc-300 hover:bg-white/10 transition-colors"
                  data-testid={`edit-rec-${rec.slug}`}
                >
                  <Settings className="w-3 h-3 inline mr-1" />Edytuj
                </Link>
                {rec.can_delete_recruitment && (
                  <button
                    onClick={() => handleDeleteRecruitment(rec)}
                    disabled={deletingId === rec.id}
                    className="px-3 py-2 rounded-lg text-xs font-medium bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    data-testid={"delete-rec-" + rec.slug}
                    title="Usun rekrutacje"
                  >
                    {deletingId === rec.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
