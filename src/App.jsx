import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
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
      return;
    }

    supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data || null));
  }, [session]);

  if (!isSupabaseConfigured) return <SetupScreen />;
  if (authLoading) return <LoadingScreen />;
  if (!session) return <LoginScreen />;

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
        <div className="brand-mark">D</div>
        <h1>Dental Appointment Scheduler</h1>
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
        <div className="brand-mark large">D</div>
        <h1>Dental Appointment Scheduler</h1>
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

  const userName =
    profile?.full_name || session.user.user_metadata?.full_name || session.user.email;

  const doctors = useMemo(() => {
    return [...new Set(appointments.map((a) => a.doctor_name).filter(Boolean))].sort();
  }, [appointments]);

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
          a.mobile,
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
  }, [appointments, view, selectedDate, search, doctorFilter]);

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
    loadAppointments();

    const channel = supabase
      .channel("appointments-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        () => loadAppointments(true)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  async function loadAppointments(silent = false) {
    if (!silent) setLoading(true);
    else setSyncing(true);

    const { data, error } = await supabase
      .from("appointments")
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
    const payload = {
      name: form.name.trim(),
      mobile: form.mobile.trim(),
      appointment_date: form.appointment_date,
      appointment_time: form.appointment_time,
      doctor_name: form.doctor_name.trim(),
      age: form.age ? Number(form.age) : null,
      treatment: form.treatment.trim() || null,
      case_no: form.case_no.trim() || null,
    };

    if (editingId) {
      const { error } = await supabase
        .from("appointments")
        .update(payload)
        .eq("id", editingId);

      if (error) {
        setToast({ type: "error", message: friendlyDbError(error) });
        return false;
      }

      setToast({ type: "success", message: "Appointment updated." });
    } else {
      const { error } = await supabase.from("appointments").insert({
        ...payload,
        status: STATUS.SCHEDULED,
        created_by: session.user.id,
      });

      if (error) {
        setToast({ type: "error", message: friendlyDbError(error) });
        return false;
      }

      setToast({ type: "success", message: "Appointment created." });
    }

    setModal(null);
    await loadAppointments(true);
    return true;
  }

  async function completeAppointment(id) {
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
    if (!window.confirm("Cancel this appointment?")) return;

    const { error } = await supabase
      .from("appointments")
      .update({ status: STATUS.CANCELLED })
      .eq("id", id);

    if (error) setToast({ type: "error", message: error.message });
    else {
      setToast({ type: "success", message: "Appointment cancelled." });
      await loadAppointments(true);
    }
  }

  async function permanentlyDelete(id) {
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
        <div className="brand">
          <div className="brand-mark">D</div>
          <div>
            <strong>Dental Appointment Scheduler</strong>
            <span>Doctor & Reception</span>
          </div>
        </div>

        <div className="top-actions">
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
              Doctor and receptionist changes sync automatically across devices.
            </p>
          </div>
          <button className="primary-btn" onClick={() => setModal({ type: "create" })}>
            <Plus size={19} />
            New Appointment
          </button>
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
                placeholder="Search name, mobile, case no..."
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
          />
        )}
      </main>

      {modal && (
        <AppointmentModal
          mode={modal.type}
          appointment={modal.appointment}
          onClose={() => setModal(null)}
          onSave={saveAppointment}
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
              <th>Mobile</th>
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
                <td>{a.mobile}</td>
                <td>{a.doctor_name}</td>
                <td>{a.treatment || "-"}</td>
                <td>{a.case_no || "-"}</td>
                <td>
                  <StatusBadge status={a.status} />
                </td>
                <td>
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
                <span>{a.mobile}</span>
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
                <strong>{a.doctor_name}</strong>
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

function AppointmentModal({ mode, appointment, onClose, onSave }) {
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

    if (!form.name.trim() || !form.mobile.trim() || !form.appointment_date ||
        !form.appointment_time || !form.doctor_name.trim()) {
      setError("Please fill all mandatory fields.");
      return;
    }

    if (!/^\d{10}$/.test(form.mobile.trim())) {
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
              Mobile Number <span>*</span>
              <input
                value={form.mobile}
                onChange={(e) => update("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="10-digit mobile number"
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
              Doctor Name <span>*</span>
              <input
                value={form.doctor_name}
                onChange={(e) => update("doctor_name", e.target.value)}
                placeholder="e.g. Dr. Rama Raju"
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
              <input
                value={form.treatment}
                onChange={(e) => update("treatment", e.target.value)}
                placeholder="e.g. RCT, Cleaning"
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