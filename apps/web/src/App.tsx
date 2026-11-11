
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import Login from "./pages/Login";
import OAuthConsent from "./pages/OAuthConsent";
import { supabaseClient } from "./services/supabase";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Circle,
  Clock3,
  LayoutDashboard,
  MessageSquareText,
  RefreshCw,
  Search,
  Target,
  TrendingUp,
} from "lucide-react";
import { api, type Feedback, type Action } from "./services/api";
import "./App.css";


function Dashboard() {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [feedbackResult, actionResult] = await Promise.all([
        api.getFeedback(),
        api.getActions(),
      ]);

      setFeedback(feedbackResult.feedback);
      setActions(actionResult.actions);

      setSelectedId((current) => {
        if (current && feedbackResult.feedback.some((item) => item.id === current)) {
          return current;
        }
        return feedbackResult.feedback[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const selectedFeedback = feedback.find((item) => item.id === selectedId);

  const filteredFeedback = useMemo(() => {
    return feedback.filter((item) => {
      const matchesSearch =
        item.customer_name.toLowerCase().includes(search.toLowerCase()) ||
        item.feedback_text.toLowerCase().includes(search.toLowerCase());

      const matchesFilter = filter === "all" || item.status === filter;

      return matchesSearch && matchesFilter;
    });
  }, [feedback, search, filter]);

  const openFeedback = feedback.filter((item) => item.status === "open").length;
  const highPriority = feedback.filter(
    (item) => item.priority === "high" && item.status !== "resolved"
  ).length;
  const resolvedFeedback = feedback.filter(
    (item) => item.status === "resolved"
  ).length;
  const openActions = actions.filter((item) => item.status !== "resolved").length;

  async function updateFeedbackField(
    id: string,
    updates: Partial<Feedback>
  ) {
    try {
      await api.updateFeedback(id, updates);
      setFeedback((current) =>
        current.map((item) =>
          item.id === id ? { ...item, ...updates } : item
        )
      );
    } catch {
      setError("Could not update feedback. Please try again.");
    }
  }

  async function updateActionStatus(id: string, status: Action["status"]) {
    try {
      await api.updateAction(id, { status });
      setActions((current) =>
        current.map((item) =>
          item.id === id ? { ...item, status } : item
        )
      );
    } catch {
      setError("Could not update action. Please try again.");
    }
  }

  const selectedActions = actions.filter(
    (item) => item.feedback_id === selectedId
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">V</div>
          <div>
            <strong>voiceloop</strong>
            <span>Customer intelligence</span>
          </div>
        </div>

        <div className="workspace-label">WORKSPACE</div>
        <div className="nav-item active">
          <LayoutDashboard size={18} />
          <span>Overview</span>
        </div>
        <div className="nav-item">
          <MessageSquareText size={18} />
          <span>Feedback</span>
          <span className="nav-count">{feedback.length}</span>
        </div>
        <div className="nav-item">
          <Target size={18} />
          <span>Action items</span>
          <span className="nav-count">{actions.length}</span>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-status">
            <span className="status-dot" />
            <span>Workspace connected</span>
          </div>
          <span className="sidebar-version">VoiceLoop · Prototype</span>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="breadcrumb">Workspace / Overview</span>
            <h1>Customer feedback</h1>
          </div>
          <button className="refresh-button" onClick={() => void loadData()}>
            <RefreshCw size={15} />
            Refresh
          </button>
        </header>

        <section className="welcome-section">
          <div>
            <p className="eyebrow">YOUR CUSTOMER VOICE, IN ACTION</p>
            <h2>Turn feedback into progress.</h2>
            <p className="welcome-copy">
              Every customer conversation is an opportunity to improve.
              Keep the important things moving.
            </p>
          </div>
          <div className="welcome-icon">
            <Activity size={32} />
          </div>
        </section>

        {error && (
          <div className="error-banner">
            <AlertCircle size={17} />
            {error}
            <button onClick={() => setError("")}>Dismiss</button>
          </div>
        )}

        <section className="stats-grid">
          <StatCard
            label="Total feedback"
            value={feedback.length}
            icon={<MessageSquareText size={19} />}
            note="Customer conversations captured"
          />
          <StatCard
            label="Open feedback"
            value={openFeedback}
            icon={<Clock3 size={19} />}
            note="Needs attention"
          />
          <StatCard
            label="High priority"
            value={highPriority}
            icon={<AlertCircle size={19} />}
            note="Unresolved high-priority items"
          />
          <StatCard
            label="Actions in progress"
            value={openActions}
            icon={<TrendingUp size={19} />}
            note={`${resolvedFeedback} feedback items resolved`}
          />
        </section>

        <section className="content-grid">
          <div className="panel feedback-panel">
            <div className="panel-heading">
              <div>
                <h3>Customer feedback</h3>
                <p>Review and manage what customers are saying.</p>
              </div>
              <span className="record-count">{filteredFeedback.length} records</span>
            </div>

            <div className="toolbar">
              <div className="search-box">
                <Search size={16} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search feedback..."
                />
              </div>
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                aria-label="Filter feedback by status"
              >
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>

            {loading ? (
              <div className="empty-state">Loading feedback...</div>
            ) : filteredFeedback.length === 0 ? (
              <div className="empty-state">
                <MessageSquareText size={26} />
                <strong>No feedback found</strong>
                <span>Try changing your search or filter.</span>
              </div>
            ) : (
              <div className="feedback-list">
                {filteredFeedback.map((item) => (
                  <button
                    className={`feedback-row ${
                      selectedId === item.id ? "selected" : ""
                    }`}
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <div className="feedback-avatar">
                      {item.customer_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="feedback-row-content">
                      <div className="feedback-row-top">
                        <strong>{item.customer_name}</strong>
                        <PriorityBadge priority={item.priority} />
                      </div>
                      <p>{item.feedback_text}</p>
                      <div className="feedback-meta">
                        <span>{item.category}</span>
                        <span>·</span>
                        <StatusBadge status={item.status} />
                        <span>·</span>
                        <span>
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="panel detail-panel">
            {selectedFeedback ? (
              <>
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">FEEDBACK DETAILS</p>
                    <h3>{selectedFeedback.customer_name}</h3>
                  </div>
                  <span className="detail-icon">
                    <MessageSquareText size={19} />
                  </span>
                </div>

                <div className="detail-section">
                  <label>Customer feedback</label>
                  <p className="full-feedback">
                    {selectedFeedback.feedback_text}
                  </p>
                </div>

                <div className="detail-section">
                  <label>Category</label>
                  <span className="category-tag">
                    {selectedFeedback.category}
                  </span>
                </div>

                <div className="detail-fields">
                  <div>
                    <label htmlFor="priority-select">Priority</label>
                    <select
                      id="priority-select"
                      value={selectedFeedback.priority}
                      onChange={(event) =>
                        void updateFeedbackField(selectedFeedback.id, {
                          priority: event.target.value as Feedback["priority"],
                        })
                      }
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="status-select">Status</label>
                    <select
                      id="status-select"
                      value={selectedFeedback.status}
                      onChange={(event) =>
                        void updateFeedbackField(selectedFeedback.id, {
                          status: event.target.value as Feedback["status"],
                        })
                      }
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In progress</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                </div>

                <div className="detail-divider" />

                <div className="panel-heading action-heading">
                  <div>
                    <h3>Linked actions</h3>
                    <p>Track the work created from this feedback.</p>
                  </div>
                  <span className="record-count">{selectedActions.length}</span>
                </div>

                {selectedActions.length === 0 ? (
                  <div className="no-actions">No actions linked yet.</div>
                ) : (
                  <div className="action-list">
                    {selectedActions.map((action) => (
                      <div className="action-row" key={action.id}>
                        <div className="action-icon">
                          {action.status === "resolved" ? (
                            <CheckCircle2 size={18} />
                          ) : (
                            <Circle size={18} />
                          )}
                        </div>
                        <div className="action-content">
                          <strong>{action.title}</strong>
                          {action.owner && <span>Owner: {action.owner}</span>}
                          <select
                            aria-label={`Status for ${action.title}`}
                            value={action.status}
                            onChange={(event) =>
                              void updateActionStatus(
                                action.id,
                                event.target.value as Action["status"]
                              )
                            }
                          >
                            <option value="open">Open</option>
                            <option value="in_progress">In progress</option>
                            <option value="resolved">Resolved</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state detail-empty">
                <MessageSquareText size={28} />
                <strong>Select a feedback record</strong>
                <span>Its details and linked actions will appear here.</span>
              </div>
            )}
          </div>
        </section>

        <footer className="app-footer">
          <span>VoiceLoop</span>
          <span>Customer conversations → meaningful action</span>
        </footer>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  note,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  note: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <p>{note}</p>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: Feedback["priority"] }) {
  return <span className={`priority-badge ${priority}`}>{priority}</span>;
}

function StatusBadge({ status }: { status: Feedback["status"] }) {
  return <span className={`status-badge ${status}`}>{status.replace("_", " ")}</span>;
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingSession(false);
    });

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (checkingSession) {
    return <div className="auth-loading">Loading VoiceLoop...</div>;
  }

  if (!session) {
    return <Login />;
  }
  const params = new URLSearchParams(window.location.search);
  const requestId = params.get("request_id");
  if (requestId) {
    return <OAuthConsent requestId={requestId} />;
  }

  return (
    <>
      <div className="auth-toolbar">
        <span>{session.user.email}</span>
        <button
          onClick={() => void supabaseClient.auth.signOut()}
        >
          Sign out
        </button>
      </div>
      <Dashboard />
    </>
  );
}

export default App;
