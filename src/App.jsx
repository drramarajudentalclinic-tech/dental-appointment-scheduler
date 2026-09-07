
import React, { useState } from "react";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "./lib/supabase";

const CLINIC_NAME_PRIMARY = "Sri Satya Sai";
const CLINIC_NAME_SECONDARY = "Oral Health Center & Dental Clinic";

const EMPTY_FORM = {
  name: "",
  mobile: "",
  appointment_date: "",
  appointment_time: "",
  doctor_name: "",
  age: "",
  treatment: "",
  case_no: "",
};

const STATUS = {
  SCHEDULED: "SCHEDULED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
};

const ROLE = {
  JUNIOR_DOCTOR: "junior_doctor",
};

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase().replace(/[- ]+/g, "_");
}

function isJuniorDoctor(profile) {
  const role = normalizeRole(profile?.role);
  return [ROLE.JUNIOR_DOCTOR, "junior", "juniordoctor"].includes(role);
}

// Android Web Push configuration. Only the public VAPID key belongs in the frontend.
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";
const PUSH_FUNCTION_NAME = "send-appointment-notification";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function enablePushNotifications(userId) {
  if (!userId) throw new Error("User is not signed in.");
  if (!VAPID_PUBLIC_KEY) {
    throw new Error("VITE_VAPID_PUBLIC_KEY is missing from .env.local.");
  }
  if (!("Notification" in window)) {
    throw new Error("Notifications are not supported by this browser.");
  }
  if (!("PushManager" in window)) {
    throw new Error("Push notifications are not supported by this browser.");
  }
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service workers are not supported by this browser.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const subscriptionJson = subscription.toJSON();
  const endpoint = subscriptionJson.endpoint;
  const p256dh = subscriptionJson.keys?.p256dh;
  const auth = subscriptionJson.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    throw new Error("The browser returned an invalid push subscription.");
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,endpoint" }
  );

  if (error) throw error;
  return subscription;
}

async function sendAppointmentPush(appointment, event, senderUserId) {
  if (!appointment?.id || !supabase) return;

  try {
    const { data, error } = await supabase.functions.invoke(
      PUSH_FUNCTION_NAME,
      {
        body: {
          appointment,
          event,
          sender_user_id: senderUserId,
        },
      }
    );

    if (error) {
      console.error("Appointment push request failed:", error);
      return { ok: false, error };
    }

    return { ok: true, data };
  } catch (error) {
    console.error("Appointment push request failed:", error);
    return { ok: false, error };
  }
}


function localDateString(date = new Date()) {
  const d = new Date(date);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}

function formatDate(date) {
  if (!date) return "-";
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(time) {
  if (!time) return "-";
  const [h, m] = time.split(":");
  const d = new Date();
  d.setHours(Number(h), Number(m), 0, 0);
  return d.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getInitials(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase())
    .join("") || "?";
}

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id || !supabase) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data || null))
      .finally(() => setProfileLoading(false));
  }, [session]);

  if (!isSupabaseConfigured) return <SetupScreen />;
  if (authLoading) return <LoadingScreen />;
  if (!session) return <LoginScreen />;
  if (profileLoading) return <LoadingScreen />;

  return (
    <Dashboard
      session={session}
      profile={profile}
      onSignOut={() => supabase.auth.signOut()}
    />
  );
}

function SetupScreen() {
  return (
    <div className="center-page">
      <div className="setup-card">
        <div
          className="brand-mark"
          style={{ fontSize: "clamp(11px, 3vw, 15px)", letterSpacing: "-0.02em" }}
        >
          SS
        </div>
        <h1 style={{ fontSize: "clamp(18px, 5vw, 22px)", lineHeight: 1.25 }}>
          {CLINIC_NAME_PRIMARY}
        </h1>
        <p
          style={{
            fontSize: "clamp(11px, 3vw, 13.5px)",
            fontWeight: 600,
            color: "#3d6f63",
            marginTop: -8,
          }}
        >
          {CLINIC_NAME_SECONDARY}
        </p>
        <p className="muted">
          Supabase is not configured yet. Add your Supabase URL and publishable
          key to the <code>.env.local</code> file.
        </p>
        <div className="code-box">
          VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
          <br />
          VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_KEY
        </div>
        <p className="muted small">
          Then restart <code>npm run dev</code>.
        </p>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="center-page">
      <div className="spinner" />
      <p>Loading...</p>
    </div>
  );
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function login(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (loginError) setError(loginError.message);
  }

  return (
    <div className="center-page login-bg">
      <div className="login-card">
        <div
          className="brand-mark large"
          style={{ fontSize: "clamp(16px, 4vw, 22px)", letterSpacing: "-0.02em" }}
        >
          SS
        </div>
        <h1
          style={{
            fontSize: "clamp(22px, 6vw, 30px)",
            lineHeight: 1.15,
            marginBottom: 4,
            letterSpacing: "-0.01em",
          }}
        >
          {CLINIC_NAME_PRIMARY}
        </h1>
        <p
          style={{
            fontSize: "clamp(13px, 3.4vw, 15.5px)",
            fontWeight: 600,
            color: "#3d6f63",
            margin: "0 0 14px",
          }}
        >
          {CLINIC_NAME_SECONDARY}
        </p>
        <p className="muted">Doctor & Reception Appointment Management</p>

        <form onSubmit={login} className="form-stack">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="doctor@example.com"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </label>

          {error && <div className="alert error">{error}</div>}

          <button className="primary-btn full" disabled={busy}>
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="small muted login-note">
          Create doctor/receptionist accounts from Supabase Authentication.
        </p>
      </div>
    </div>
  );
}

function Dashboard({ session, profile, onSignOut }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [view, setView] = useState("today");
  const [selectedDate, setSelectedDate] = useState(localDateString());
  const [search, setSearch] = useState("");
  const [doctorFilter, setDoctorFilter] = useState("ALL");
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [doctorOptions, setDoctorOptions] = useState([]);
  const [treatmentOptions, setTreatmentOptions] = useState([]);
  const [showManageDoctors, setShowManageDoctors] = useState(false);

  const userName =
    profile?.full_name || session.user.user_metadata?.full_name || session.user.email;

  const juniorDoctor = isJuniorDoctor(profile);

  const doctors = useMemo(() => {
    return [...new Set(appointments.map((a) => a.doctor_name).filter(Boolean))].sort();
  }, [appointments]);

  // Merge the saved doctors/treatments lookup lists with any legacy free-text
  // values already present in appointments, so nothing already in use is lost.
  const allDoctorNames = useMemo(() => {
    const merged = new Map();
    for (const name of doctorOptions) merged.set(name.toLowerCase(), name);
    for (const name of doctors) {
      if (!merged.has(name.toLowerCase())) merged.set(name.toLowerCase(), name);
    }
    return [...merged.values()].sort((a, b) => a.localeCompare(b));
  }, [doctorOptions, doctors]);

  const legacyTreatments = useMemo(() => {
    return [...new Set(appointments.map((a) => a.treatment).filter(Boolean))].sort();
  }, [appointments]);

  const allTreatmentNames = useMemo(() => {
    const merged = new Map();
    for (const name of treatmentOptions) merged.set(name.toLowerCase(), name);
    for (const name of legacyTreatments) {
      if (!merged.has(name.toLowerCase())) merged.set(name.toLowerCase(), name);
    }
    return [...merged.values()].sort((a, b) => a.localeCompare(b));
  }, [treatmentOptions, legacyTreatments]);

  const visibleAppointments = useMemo(() => {
    const term = search.trim().toLowerCase();

    return appointments.filter((a) => {
      if (view === "today" && a.appointment_date !== selectedDate) return false;
      if (view === "future" && a.appointment_date <= selectedDate) return false;
      if (view === "completed" && a.status !== STATUS.COMPLETED) return false;
      if (doctorFilter !== "ALL" && a.doctor_name !== doctorFilter) return false;

      if (term) {
        const haystack = [
          a.name,
          ...(juniorDoctor ? [] : [a.mobile]),
          a.case_no,
          a.treatment,
          a.doctor_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(term)) return false;
      }

      return true;
    });
  }, [appointments, view, selectedDate, search, doctorFilter, juniorDoctor]);

  const counts = useMemo(() => {
    const today = appointments.filter(
      (a) => a.appointment_date === selectedDate && a.status !== STATUS.CANCELLED
    ).length;

    const future = appointments.filter(
      (a) => a.appointment_date > selectedDate && a.status === STATUS.SCHEDULED
    ).length;

    const completed = appointments.filter(
      (a) => a.appointment_date === selectedDate && a.status === STATUS.COMPLETED
    ).length;

    return { today, future, completed };
  }, [appointments, selectedDate]);

  useEffect(() => {
    async function checkPushStatus() {
      if (
        !session?.user?.id ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) return;

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setPushEnabled(Boolean(subscription));
      } catch (error) {
        console.error("Unable to check push status:", error);
      }
    }

    checkPushStatus();
  }, [session?.user?.id]);

  async function handleEnableNotifications() {
    if (pushBusy || !session?.user?.id) return;
    setPushBusy(true);

    try {
      await enablePushNotifications(session.user.id);
      setPushEnabled(true);
      setToast({ type: "success", message: "Phone notifications enabled." });
    } catch (error) {
      console.error("Unable to enable phone notifications:", error);
      setToast({
        type: "error",
        message: error?.message || "Unable to enable phone notifications.",
      });
    } finally {
      setPushBusy(false);
    }
  }

  useEffect(() => {
    if (profileLoading) return;

    loadAppointments();

    // Junior Doctors use the secure database view and do not subscribe to raw
    // appointment payloads, because realtime payloads can contain mobile.
    if (juniorDoctor) return undefined;

    const channel = supabase
      .channel("appointments-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const appointment = payload.new;
            const bookedByMe = appointment.created_by === session.user.id;

            if (!bookedByMe) {
              const body = `${appointment.name}${
                appointment.doctor_name ? ` with ${appointment.doctor_name}` : ""
              } on ${formatDate(appointment.appointment_date)} at ${formatTime(
                appointment.appointment_time
              )}`;
              setToast({
                type: "success",
                message: `New appointment booked: ${body}`,
              });
            }
          }

          loadAppointments(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [juniorDoctor, profileLoading, session.user.id]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    loadLookupLists();
  }, []);

  async function loadLookupLists() {
    const [doctorsRes, treatmentsRes] = await Promise.all([
      supabase.from("doctors").select("name").order("name", { ascending: true }),
      supabase.from("treatments").select("name").order("name", { ascending: true }),
    ]);

    if (!doctorsRes.error) {
      setDoctorOptions((doctorsRes.data || []).map((row) => row.name).filter(Boolean));
    } else {
      console.error("Unable to load doctors list:", doctorsRes.error);
    }

    if (!treatmentsRes.error) {
      setTreatmentOptions(
        (treatmentsRes.data || []).map((row) => row.name).filter(Boolean)
      );
    } else {
      console.error("Unable to load treatments list:", treatmentsRes.error);
    }
  }

  async function addDoctorOption(name) {
    const trimmed = name.trim();
    if (!trimmed) return trimmed;

    setDoctorOptions((current) =>
      current.some((n) => n.toLowerCase() === trimmed.toLowerCase())
        ? current
        : [...current, trimmed].sort((a, b) => a.localeCompare(b))
    );

    const { error } = await supabase
      .from("doctors")
      .upsert({ name: trimmed }, { onConflict: "name", ignoreDuplicates: true });

    if (error) {
      console.error("Unable to save new doctor:", error);
      setToast({
        type: "error",
        message: "Doctor added for this appointment, but could not be saved for reuse.",
      });
    }

    return trimmed;
  }

  async function deleteDoctorOption(name) {
    const trimmed = name.trim();
    if (!trimmed) return;

    if (
      !window.confirm(`Remove "${trimmed}" from the doctor list? Past appointments already using this name are not affected.`)
    ) {
      return;
    }

    const previous = doctorOptions;
    setDoctorOptions((current) =>
      current.filter((n) => n.toLowerCase() !== trimmed.toLowerCase())
    );

    const { error } = await supabase.from("doctors").delete().ilike("name", trimmed);

    if (error) {
      console.error("Unable to delete doctor:", error);
      setDoctorOptions(previous);
      setToast({ type: "error", message: "Unable to remove that doctor. Please try again." });
    } else {
      setToast({ type: "success", message: `"${trimmed}" removed from the doctor list.` });
    }
  }

  async function addTreatmentOption(name) {
    const trimmed = name.trim();
    if (!trimmed) return trimmed;

    setTreatmentOptions((current) =>
      current.some((n) => n.toLowerCase() === trimmed.toLowerCase())
        ? current
        : [...current, trimmed].sort((a, b) => a.localeCompare(b))
    );

    const { error } = await supabase
      .from("treatments")
      .upsert({ name: trimmed }, { onConflict: "name", ignoreDuplicates: true });

    if (error) {
      console.error("Unable to save new treatment:", error);
      setToast({
        type: "error",
        message: "Treatment added for this appointment, but could not be saved for reuse.",
      });
    }

    return trimmed;
  }

  async function loadAppointments(silent = false) {
    if (!silent) setLoading(true);
    else setSyncing(true);

    const sourceTable = juniorDoctor
      ? "junior_doctor_appointments"
      : "appointments";

    const { data, error } = await supabase
      .from(sourceTable)
      .select("*")
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true });

    if (error) {
      setToast({ type: "error", message: error.message });
    } else {
      setAppointments(data || []);
    }

    setLoading(false);
    setSyncing(false);
  }

  async function saveAppointment(form, editingId) {
    if (juniorDoctor) {
      setToast({ type: "error", message: "Junior Doctors have read-only access." });
      return false;
    }

    const payload = {
      name: form.name.trim(),
      mobile: form.mobile.trim() || null,
      appointment_date: form.appointment_date,
      appointment_time: form.appointment_time,
      doctor_name: form.doctor_name.trim() || null,
      age: form.age ? Number(form.age) : null,
      treatment: form.treatment.trim() || null,
      case_no: form.case_no.trim() || null,
    };

    if (editingId) {
      const { data: updatedAppointment, error } = await supabase
        .from("appointments")
        .update(payload)
        .eq("id", editingId)
        .select("*")
        .single();

      if (error) {
        setToast({ type: "error", message: friendlyDbError(error) });
        return false;
      }

      setToast({ type: "success", message: "Appointment updated." });
      await sendAppointmentPush(updatedAppointment, "UPDATE", session.user.id);
    } else {
      const { data: createdAppointment, error } = await supabase
        .from("appointments")
        .insert({
          ...payload,
          status: STATUS.SCHEDULED,
          created_by: session.user.id,
        })
        .select("*")
        .single();

      if (error) {
        setToast({ type: "error", message: friendlyDbError(error) });
        return false;
      }

      setToast({ type: "success", message: "Appointment created." });
      await sendAppointmentPush(createdAppointment, "INSERT", session.user.id);
    }

    setModal(null);
    await loadAppointments(true);
    return true;
  }

  async function completeAppointment(id) {
    if (juniorDoctor) {
      setToast({ type: "error", message: "Junior Doctors have read-only access." });
      return;
    }

    const { error } = await supabase
      .from("appointments")
      .update({ status: STATUS.COMPLETED })
      .eq("id", id);

    if (error) setToast({ type: "error", message: error.message });
    else {
      setToast({ type: "success", message: "Appointment marked completed." });
      await loadAppointments(true);
    }
  }

  async function cancelAppointment(id) {
    if (juniorDoctor) {
      setToast({ type: "error", message: "Junior Doctors have read-only access." });
      return;
    }

    if (!window.confirm("Cancel this appointment?")) return;

    const { data: cancelledAppointment, error } = await supabase
      .from("appointments")
      .update({ status: STATUS.CANCELLED })
      .eq("id", id)
      .select("*")
      .single();

    if (error) setToast({ type: "error", message: error.message });
    else {
      setToast({ type: "success", message: "Appointment cancelled." });
      await sendAppointmentPush(cancelledAppointment, "CANCELLED", session.user.id);
      await loadAppointments(true);
    }
  }

  async function permanentlyDelete(id) {
    if (juniorDoctor) {
      setToast({ type: "error", message: "Junior Doctors have read-only access." });
      return;
    }

    if (
      !window.confirm(
        "Permanently delete this appointment? This cannot be undone."
      )
    )
      return;

    const { error } = await supabase.from("appointments").delete().eq("id", id);

    if (error) setToast({ type: "error", message: error.message });
    else {
      setToast({ type: "success", message: "Appointment deleted." });
      await loadAppointments(true);
    }
  }

  function changeDay(delta) {
    const d = new Date(`${selectedDate}T00:00:00`);
    d.setDate(d.getDate() + delta);
    setSelectedDate(localDateString(d));
    setView("today");
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand" style={{ minWidth: 0 }}>
          <div
            className="brand-mark"
            style={{
              fontSize: "clamp(11px, 3vw, 15px)",
              letterSpacing: "-0.02em",
              flexShrink: 0,
            }}
          >
            SS
          </div>
          <div style={{ minWidth: 0 }}>
            <strong
              style={{
                fontSize: "clamp(13px, 3.4vw, 15.5px)",
                lineHeight: 1.25,
                display: "block",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {CLINIC_NAME_PRIMARY}
            </strong>
            <span
              style={{
                fontSize: "clamp(10px, 2.4vw, 12px)",
                color: "#6b8f87",
                fontWeight: 600,
                display: "block",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {CLINIC_NAME_SECONDARY}
            </span>
          </div>
        </div>

        <div className="top-actions">
          <button
            className="secondary-btn"
            onClick={handleEnableNotifications}
            disabled={pushBusy}
            title={
              pushEnabled
                ? "Phone notifications enabled"
                : "Enable phone notifications"
            }
          >
            🔔 {pushBusy ? "Enabling..." : pushEnabled ? "Notifications On" : "Enable Notifications"}
          </button>
          <div className="user-pill">
            <div className="avatar">{getInitials(userName)}</div>
            <div className="user-details">
              <strong>{userName}</strong>
              <span>{profile?.role || "staff"}</span>
            </div>
          </div>
          <button className="icon-btn" title="Refresh" onClick={() => loadAppointments()}>
            <RefreshCw size={18} className={syncing ? "spin" : ""} />
          </button>
          <button className="secondary-btn" onClick={onSignOut}>
            <LogOut size={17} />
            Logout
          </button>
        </div>
      </header>

      <main className="content">
        <section className="hero">
          <div>
            <p className="eyebrow">CLINIC SCHEDULE</p>
            <h1>Appointments</h1>
            <p className="muted">
              {juniorDoctor
                ? "Read-only appointment view. Use the date filters to view past, today, or future appointments."
                : "Doctor and receptionist changes sync automatically across devices."}
            </p>
          </div>
          {!juniorDoctor && (
            <button className="primary-btn" onClick={() => setModal({ type: "create" })}>
              <Plus size={19} />
              New Appointment
            </button>
          )}
        </section>

        <section className="stats-grid">
          <StatCard icon={<CalendarDays />} label="Today" value={counts.today} />
          <StatCard icon={<Clock3 />} label="Future" value={counts.future} />
          <StatCard
            icon={<CheckCircle2 />}
            label="Completed Today"
            value={counts.completed}
          />
        </section>

        <section className="toolbar-card">
          <div className="view-tabs">
            {[
              ["today", "Today"],
              ["future", "Future"],
              ["completed", "Completed"],
              ["all", "All"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={view === key ? "tab active" : "tab"}
                onClick={() => setView(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="filters">
            <div className="search-box">
              <Search size={17} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={juniorDoctor ? "Search name, case no., treatment..." : "Search name, mobile, case no..."}
              />
            </div>

            <select
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
            >
              <option value="ALL">All doctors</option>
              {doctors.map((doctor) => (
                <option key={doctor} value={doctor}>
                  {doctor}
                </option>
              ))}
            </select>

            {!juniorDoctor && (
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setShowManageDoctors(true)}
                title="Add or remove doctors from the list"
              >
                <UserRound size={16} />
                Manage Doctors
              </button>
            )}
          </div>
        </section>

        {view === "today" && (
          <section className="date-nav">
            <button className="secondary-btn" onClick={() => changeDay(-1)}>
              ← Previous
            </button>
            <div className="selected-date">
              <CalendarDays size={18} />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
              <strong>{formatDate(selectedDate)}</strong>
            </div>
            <button className="secondary-btn" onClick={() => changeDay(1)}>
              Next →
            </button>
          </section>
        )}

        {loading ? (
          <div className="empty-card">
            <div className="spinner" />
            <p>Loading appointments...</p>
          </div>
        ) : (
          <AppointmentTable
            appointments={visibleAppointments}
            onEdit={(appointment) => setModal({ type: "edit", appointment })}
            onComplete={completeAppointment}
            onCancel={cancelAppointment}
            onDelete={permanentlyDelete}
            readOnly={juniorDoctor}
          />
        )}
      </main>

      {!juniorDoctor && modal && (
        <AppointmentModal
          mode={modal.type}
          appointment={modal.appointment}
          onClose={() => setModal(null)}
          onSave={saveAppointment}
          doctorOptions={allDoctorNames}
          treatmentOptions={allTreatmentNames}
          onAddDoctor={addDoctorOption}
          onAddTreatment={addTreatmentOption}
          onDeleteDoctor={deleteDoctorOption}
        />
      )}

      {!juniorDoctor && showManageDoctors && (
        <ManageDoctorsModal
          doctors={allDoctorNames}
          onClose={() => setShowManageDoctors(false)}
          onAddDoctor={addDoctorOption}
          onDeleteDoctor={deleteDoctorOption}
        />
      )}

      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.message}
          <button onClick={() => setToast(null)}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function AppointmentTable({
  appointments,
  onEdit,
  onComplete,
  onCancel,
  onDelete,
  readOnly = false,
}) {
  if (!appointments.length) {
    return (
      <div className="empty-card">
        <CalendarDays size={36} />
        <h3>No appointments found</h3>
        <p className="muted">
          Try another filter or create a new appointment.
        </p>
      </div>
    );
  }

  return (
    <div className="table-card">
      <div className="table-header">
        <div>
          <strong>{appointments.length} appointment(s)</strong>
          <span>Live synchronized schedule</span>
        </div>
        <span className="live-dot">● Live</span>
      </div>

      <div className="desktop-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Patient</th>
              {!readOnly && <th>Mobile</th>}
              <th>Doctor</th>
              <th>Treatment</th>
              <th>Case No.</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((a) => (
              <tr key={a.id} className={a.status === STATUS.CANCELLED ? "cancelled-row" : ""}>
                <td>{formatDate(a.appointment_date)}</td>
                <td><strong>{formatTime(a.appointment_time)}</strong></td>
                <td>
                  <div className="patient-cell">
                    <div className="patient-avatar">{getInitials(a.name)}</div>
                    <div>
                      <strong>{a.name}</strong>
                      {a.age != null && <span>Age {a.age}</span>}
                    </div>
                  </div>
                </td>
                {!readOnly && <td>{a.mobile || "-"}</td>}
                <td>{a.doctor_name || "-"}</td>
                <td>{a.treatment || "-"}</td>
                <td>{a.case_no || "-"}</td>
                <td>
                  <StatusBadge status={a.status} />
                </td>
                <td>
                  {readOnly ? (
                    <span className="muted small">View only</span>
                  ) : (
                    <div className="actions">
                      <button className="small-btn" onClick={() => onEdit(a)} title="Edit">
                        <Pencil size={15} />
                      </button>
                      {a.status === STATUS.SCHEDULED && (
                        <button
                          className="small-btn success"
                          onClick={() => onComplete(a.id)}
                          title="Mark completed"
                        >
                          <CheckCircle2 size={15} />
                        </button>
                      )}
                      {a.status !== STATUS.CANCELLED && (
                        <button
                          className="small-btn danger"
                          onClick={() => onCancel(a.id)}
                          title="Cancel"
                        >
                          <X size={15} />
                        </button>
                      )}
                      <button
                        className="small-btn danger"
                        onClick={() => onDelete(a.id)}
                        title="Delete permanently"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mobile-cards">
        {appointments.map((a) => (
          <div className="appointment-card" key={a.id}>
            <div className="appointment-card-top">
              <div>
                <strong>{a.name}</strong>
                {!readOnly && <span>{a.mobile || "No mobile number"}</span>}
              </div>
              <StatusBadge status={a.status} />
            </div>
            <div className="mobile-grid">
              <div>
                <span>Date</span>
                <strong>{formatDate(a.appointment_date)}</strong>
              </div>
              <div>
                <span>Time</span>
                <strong>{formatTime(a.appointment_time)}</strong>
              </div>
              <div>
                <span>Doctor</span>
                <strong>{a.doctor_name || "-"}</strong>
              </div>
              <div>
                <span>Treatment</span>
                <strong>{a.treatment || "-"}</strong>
              </div>
              <div>
                <span>Case No.</span>
                <strong>{a.case_no || "-"}</strong>
              </div>
              <div>
                <span>Age</span>
                <strong>{a.age ?? "-"}</strong>
              </div>
            </div>
            {!readOnly ? (
              <div className="mobile-actions">
                <button className="secondary-btn" onClick={() => onEdit(a)}>
                  <Pencil size={15} /> Edit
                </button>
                {a.status === STATUS.SCHEDULED && (
                  <button className="secondary-btn" onClick={() => onComplete(a.id)}>
                    <CheckCircle2 size={15} /> Complete
                  </button>
                )}
                {a.status !== STATUS.CANCELLED && (
                  <button className="secondary-btn danger-text" onClick={() => onCancel(a.id)}>
                    Cancel
                  </button>
                )}
                <button className="secondary-btn danger-text" onClick={() => onDelete(a.id)}>
                  Delete
                </button>
              </div>
            ) : (
              <div className="mobile-actions">
                <span className="muted small">View only</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const label =
    status === STATUS.COMPLETED
      ? "Completed"
      : status === STATUS.CANCELLED
      ? "Cancelled"
      : "Scheduled";

  return <span className={`status ${status.toLowerCase()}`}>{label}</span>;
}

function Combobox({
  value,
  onChange,
  options,
  onAddOption,
  onDeleteOption,
  placeholder,
  emptyLabel = "No matches",
  addLabel = "Add",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || "");
  const [adding, setAdding] = useState(false);
  const [deletingOpt, setDeletingOpt] = useState(null);
  const rootRef = useRef(null);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
        setQuery(value || "");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    return options.filter((opt) => opt.toLowerCase().includes(term));
  }, [options, query]);

  const trimmedQuery = query.trim();
  const exactMatch = options.some(
    (opt) => opt.toLowerCase() === trimmedQuery.toLowerCase()
  );
  const canAddNew = trimmedQuery.length > 0 && !exactMatch;

  function selectOption(opt) {
    onChange(opt);
    setQuery(opt);
    setOpen(false);
  }

  async function handleAddNew() {
    if (!trimmedQuery || adding) return;
    setAdding(true);
    const saved = await onAddOption(trimmedQuery);
    setAdding(false);
    selectOption(saved || trimmedQuery);
  }

  async function handleDelete(opt) {
    if (!onDeleteOption || deletingOpt) return;
    setDeletingOpt(opt);
    await onDeleteOption(opt);
    setDeletingOpt(null);
    // Keep the dropdown open so more than one entry can be removed at a time.
    if (opt.toLowerCase() === (value || "").toLowerCase()) {
      onChange("");
      setQuery("");
    }
  }

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input
          value={query}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            onChange(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (filtered.length === 1) {
                selectOption(filtered[0]);
              } else if (canAddNew) {
                handleAddNew();
              }
            } else if (e.key === "Escape") {
              setOpen(false);
              setQuery(value || "");
            }
          }}
          style={{
            width: "100%",
            boxSizing: "border-box",
            paddingRight: 34,
          }}
          autoComplete="off"
        />
        <ChevronDown
          size={16}
          onClick={() => setOpen((o) => !o)}
          style={{
            position: "absolute",
            right: 10,
            top: "50%",
            transform: open ? "translateY(-50%) rotate(180deg)" : "translateY(-50%)",
            color: "#6b8f87",
            cursor: "pointer",
            transition: "transform 0.15s ease",
          }}
        />
      </div>

      {open && (
        <div
          style={{
            position: "absolute",
            zIndex: 30,
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: "#ffffff",
            border: "1px solid #dbe6e2",
            borderRadius: 10,
            boxShadow: "0 10px 24px rgba(15, 60, 50, 0.12)",
            maxHeight: 220,
            overflowY: "auto",
            padding: 6,
          }}
        >
          {filtered.length === 0 && !canAddNew && (
            <div style={{ padding: "10px 12px", color: "#7c8b87", fontSize: 13.5 }}>
              {emptyLabel}
            </div>
          )}

          {filtered.map((opt) => {
            const isSelected = opt.toLowerCase() === (value || "").toLowerCase();
            const isDeleting = deletingOpt === opt;
            return (
              <div
                key={opt}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectOption(opt)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flex: 1,
                    minWidth: 0,
                    textAlign: "left",
                    padding: "9px 10px",
                    borderRadius: 7,
                    border: "none",
                    background: isSelected ? "#eaf5f1" : "transparent",
                    color: "#1c2e2a",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "#f2f7f5";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {opt}
                  </span>
                  {isSelected && <Check size={15} color="#1f8f6f" />}
                </button>

                {onDeleteOption && (
                  <button
                    type="button"
                    title={`Remove "${opt}"`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleDelete(opt)}
                    disabled={isDeleting}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      width: 30,
                      height: 30,
                      borderRadius: 7,
                      border: "1px solid transparent",
                      background: "transparent",
                      color: isDeleting ? "#c3d1cd" : "#c0554a",
                      cursor: isDeleting ? "default" : "pointer",
                    }}
                    onMouseEnter={(e) => {
                      if (!isDeleting) {
                        e.currentTarget.style.background = "#fbecea";
                        e.currentTarget.style.borderColor = "#f0d0cc";
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.borderColor = "transparent";
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })}

          {canAddNew && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleAddNew}
              disabled={adding}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                textAlign: "left",
                padding: "9px 10px",
                marginTop: filtered.length ? 4 : 0,
                borderRadius: 7,
                border: "1px dashed #b6d8cd",
                background: "#f6fbf9",
                color: "#146b52",
                fontSize: 14,
                fontWeight: 600,
                cursor: adding ? "default" : "pointer",
              }}
            >
              <Plus size={15} />
              {adding ? "Adding..." : `${addLabel} "${trimmedQuery}"`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ManageDoctorsModal({ doctors, onClose, onAddDoctor, onDeleteDoctor }) {
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingName, setDeletingName] = useState(null);

  async function handleAdd(e) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed || adding) return;
    setAdding(true);
    await onAddDoctor(trimmed);
    setAdding(false);
    setNewName("");
  }

  async function handleDelete(name) {
    if (deletingName) return;
    setDeletingName(name);
    await onDeleteDoctor(name);
    setDeletingName(null);
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal-card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">DOCTORS</p>
            <h2>Manage Doctors</h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X />
          </button>
        </div>

        <form onSubmit={handleAdd} style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Add a new doctor name"
            style={{ flex: 1 }}
          />
          <button className="primary-btn" disabled={adding || !newName.trim()}>
            {adding ? "Adding..." : "Add"}
          </button>
        </form>

        <div
          style={{
            border: "1px solid #dbe6e2",
            borderRadius: 10,
            maxHeight: 340,
            overflowY: "auto",
          }}
        >
          {doctors.length === 0 && (
            <div style={{ padding: "16px 14px", color: "#7c8b87", fontSize: 13.5 }}>
              No doctors added yet.
            </div>
          )}

          {doctors.map((name, i) => {
            const isDeleting = deletingName === name;
            return (
              <div
                key={name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "10px 14px",
                  borderTop: i === 0 ? "none" : "1px solid #eef3f1",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <UserRound size={16} color="#3d6f63" />
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontSize: 14.5,
                      color: "#1c2e2a",
                    }}
                  >
                    {name}
                  </span>
                </span>

                <button
                  type="button"
                  title={`Delete "${name}"`}
                  onClick={() => handleDelete(name)}
                  disabled={isDeleting}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexShrink: 0,
                    padding: "6px 10px",
                    borderRadius: 7,
                    border: "1px solid #f0d0cc",
                    background: isDeleting ? "#f7f7f7" : "#fbecea",
                    color: isDeleting ? "#a7a7a7" : "#c0554a",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: isDeleting ? "default" : "pointer",
                  }}
                >
                  <Trash2 size={14} />
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            );
          })}
        </div>

        <p className="muted small" style={{ marginTop: 12 }}>
          Deleting a doctor here only removes them from this list for new appointments.
          Existing appointments already booked under that name are not affected.
        </p>

        <div className="modal-actions">
          <button type="button" className="secondary-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function AppointmentModal({
  mode,
  appointment,
  onClose,
  onSave,
  doctorOptions,
  treatmentOptions,
  onAddDoctor,
  onAddTreatment,
  onDeleteDoctor,
}) {
  const [form, setForm] = useState(() => {
    if (!appointment) {
      return { ...EMPTY_FORM, appointment_date: localDateString() };
    }
    return {
      name: appointment.name || "",
      mobile: appointment.mobile || "",
      appointment_date: appointment.appointment_date || "",
      appointment_time: appointment.appointment_time?.slice(0, 5) || "",
      doctor_name: appointment.doctor_name || "",
      age: appointment.age ?? "",
      treatment: appointment.treatment || "",
      case_no: appointment.case_no || "",
    };
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setError("");

    if (!form.name.trim() || !form.appointment_date || !form.appointment_time) {
      setError("Please fill all mandatory fields.");
      return;
    }

    if (form.mobile.trim() && !/^\d{10}$/.test(form.mobile.trim())) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }

    if (form.age && (Number(form.age) < 0 || Number(form.age) > 120)) {
      setError("Enter a valid age.");
      return;
    }

    setBusy(true);
    const ok = await onSave(form, appointment?.id);
    setBusy(false);
    if (!ok) return;
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal-card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">APPOINTMENT</p>
            <h2>{mode === "edit" ? "Edit Appointment" : "New Appointment"}</h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X />
          </button>
        </div>

        <form onSubmit={submit} className="appointment-form">
          <div className="form-grid">
            <label>
              Patient Name <span>*</span>
              <input
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="Enter patient name"
                autoFocus
              />
            </label>

            <label>
              Mobile Number
              <input
                value={form.mobile}
                onChange={(e) => update("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="10-digit mobile number (optional)"
                inputMode="numeric"
              />
            </label>

            <label>
              Date <span>*</span>
              <input
                type="date"
                value={form.appointment_date}
                onChange={(e) => update("appointment_date", e.target.value)}
              />
            </label>

            <label>
              Time <span>*</span>
              <input
                type="time"
                value={form.appointment_time}
                onChange={(e) => update("appointment_time", e.target.value)}
              />
            </label>

            <label>
              Doctor Name
              <Combobox
                value={form.doctor_name}
                onChange={(val) => update("doctor_name", val)}
                options={doctorOptions}
                onAddOption={onAddDoctor}
                onDeleteOption={onDeleteDoctor}
                placeholder="Search or add a doctor (optional)"
                emptyLabel="No doctors yet"
                addLabel="Add doctor"
              />
              <small>Same time is allowed for different doctors.</small>
            </label>

            <label>
              Age
              <input
                type="number"
                min="0"
                max="120"
                value={form.age}
                onChange={(e) => update("age", e.target.value)}
                placeholder="Optional"
              />
            </label>

            <label>
              Treatment
              <Combobox
                value={form.treatment}
                onChange={(val) => update("treatment", val)}
                options={treatmentOptions}
                onAddOption={onAddTreatment}
                placeholder="Search or add a treatment"
                emptyLabel="No treatments yet"
                addLabel="Add treatment"
              />
            </label>

            <label>
              Case No.
              <input
                value={form.case_no}
                onChange={(e) => update("case_no", e.target.value)}
                placeholder="Optional"
              />
            </label>
          </div>

          <div className="booking-note">
            <Clock3 size={17} />
            <span>
              Multiple patients can have the same time when they are assigned to
              different doctors. The same doctor cannot have two active appointments
              at the exact same date and time.
            </span>
          </div>

          {error && <div className="alert error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="secondary-btn" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-btn" disabled={busy}>
              {busy ? "Saving..." : mode === "edit" ? "Save Changes" : "Save Appointment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function friendlyDbError(error) {
  if (error?.code === "23505") {
    return "This doctor already has an active appointment at the selected date and time.";
  }
  return error?.message || "Something went wrong.";
}

export default App;