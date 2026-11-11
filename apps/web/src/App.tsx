
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import Login from "./pages/Login";
import OAuthConsent from "./pages/OAuthConsent";
import { supabaseClient } from "./services/supabase";
import {
  Activity,
  AlertCircle,
  CalendarDays,
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

type Page = "overview" | "feedback" | "actions";

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isOverdue(action: Action) {
  if (!action.due_date || action.status === "resolved") return false;
  const due = new Date(`${action.due_date}T23:59:59`);
  return due.getTime() < Date.now();
}

function Dashboard() {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState<Page>("overview");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingActionId, setSavingActionId] = useState<string | null>(null);

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
        if (current && feedbackResult.feedback.some((item) => item.id === current)) return current;
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

  const filteredFeedback = useMemo(() => feedback.filter((item) => {
    const matchesSearch =
      item.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      item.feedback_text.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || item.status === filter;
    return matchesSearch && matchesFilter;
  }), [feedback, search, filter]);

  const filteredActions = useMemo(() => actions.filter((item) => {
    const linkedFeedback = feedback.find((entry) => entry.id === item.feedback_id);
    const query = search.toLowerCase();
    const matchesSearch =
      item.title.toLowerCase().includes(query) ||
      (item.description ?? "").toLowerCase().includes(query) ||
      (item.owner ?? "").toLowerCase().includes(query) ||
      (linkedFeedback?.customer_name ?? "").toLowerCase().includes(query) ||
      (linkedFeedback?.feedback_text ?? "").toLowerCase().includes(query);
    const matchesFilter = filter === "all" || item.status === filter;
    return matchesSearch && matchesFilter;
  }), [actions, feedback, search, filter]);

  // Keep existing owner names available while offering consistent team choices.
  const ownerOptions = useMemo(() => {
    const standardOwners = [
      "Product Team",
      "Engineering",
      "Customer Success",
      "Support",
      "Marketing",
      "Operations",
      "Design",
    ];

    const existingOwners = actions
      .map((item) => item.owner?.trim())
      .filter((owner): owner is string => Boolean(owner));

    return Array.from(new Set([...standardOwners, ...existingOwners])).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [actions]);

  const openFeedback = feedback.filter((item) => item.status === "open").length;
  const highPriority = feedback.filter((item) => item.priority === "high" && item.status !== "resolved").length;
  const resolvedFeedback = feedback.filter((item) => item.status === "resolved").length;
  const activeActions = actions.filter((item) => item.status !== "resolved").length;
  const overdueActions = actions.filter(isOverdue).length;

  async function updateFeedbackField(id: string, updates: Partial<Feedback>) {
    try {
      await api.updateFeedback(id, updates);
      setFeedback((current) =>
        current.map((item) => item.id === id ? { ...item, ...updates } : item)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update feedback. Please try again.");
    }
  }

  async function updateAction(id: string, updates: Partial<Action>) {
    setSavingActionId(id);
    setError("");

    try {
      await api.updateAction(id, updates);
      setActions((current) =>
        current.map((item) => item.id === id ? { ...item, ...updates } : item)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update action. Please try again.");
      await loadData();
    } finally {
      setSavingActionId(null);
    }
  }

  const selectedActions = actions.filter((item) => item.feedback_id === selectedId);

  function navigate(nextPage: Page) {
    setPage(nextPage);
    setSearch("");
    setFilter("all");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">V</div>
          <div>
            <strong>VoiceLoop</strong>
            <span>Customer intelligence</span>
          </div>
        </div>

        <div className="workspace-label">WORKSPACE</div>

        <button
          className={`nav-item ${page === "overview" ? "active" : ""}`}
          onClick={() => navigate("overview")}
        >
          <LayoutDashboard size={18} />
          <span>Overview</span>
        </button>

        <button
          className={`nav-item ${page === "feedback" ? "active" : ""}`}
          onClick={() => navigate("feedback")}
        >
          <MessageSquareText size={18} />
          <span>Feedback</span>
          <span className="nav-count">{feedback.length}</span>
        </button>

        <button
          className={`nav-item ${page === "actions" ? "active" : ""}`}
          onClick={() => navigate("actions")}
        >
          <Target size={18} />
          <span>Action items</span>
          <span className="nav-count">{actions.length}</span>
        </button>

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
            <span className="breadcrumb">
              Workspace / {page === "overview" ? "Overview" : page === "feedback" ? "Feedback" : "Action items"}
            </span>
            <h1>
              {page === "overview" ? "Customer feedback" : page === "feedback" ? "Feedback management" : "Action items"}
            </h1>
          </div>

          <button className="refresh-button" onClick={() => void loadData()} disabled={loading}>
            <RefreshCw size={15} className={loading ? "refresh-spin" : ""} />
            Refresh
          </button>
        </header>

        {error && (
          <div className="error-banner">
            <AlertCircle size={17} />
            {error}
            <button onClick={() => setError("")}>Dismiss</button>
          </div>
        )}

        {page === "overview" && (
          <>
            <section className="welcome-section">
              <div>
                <p className="eyebrow">YOUR CUSTOMER VOICE, IN ACTION</p>
                <h2>Turn feedback into progress.</h2>
                <p className="welcome-copy">
                  Every customer conversation is an opportunity to improve. Keep the important things moving.
                </p>
              </div>
              <div className="welcome-icon">
                <Activity size={32} />
              </div>
            </section>

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
                value={activeActions}
                icon={<TrendingUp size={19} />}
                note={`${resolvedFeedback} feedback items resolved`}
              />
            </section>

            <section className="overview-shortcuts">
              <button className="shortcut-card" onClick={() => navigate("feedback")}>
                <MessageSquareText size={21} />
                <span>
                  <strong>Manage feedback</strong>
                  <small>Review customer conversations</small>
                </span>
              </button>

              <button className="shortcut-card" onClick={() => navigate("actions")}>
                <Target size={21} />
                <span>
                  <strong>Manage action items</strong>
                  <small>{actions.length} actions · {overdueActions} overdue</small>
                </span>
              </button>
            </section>

            <section className="content-grid">
              <div className="panel feedback-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Customer feedback</h3>
                    <p>Review and manage what customers are saying.</p>
                  </div>
                  <span className="record-count">{feedback.length} records</span>
                </div>

                <div className="feedback-list overview-feedback-list">
                  {loading ? (
                    <div className="empty-state">Loading feedback...</div>
                  ) : (
                    feedback.slice(0, 4).map((item) => (
                      <button
                        className="feedback-row"
                        key={item.id}
                        onClick={() => {
                          setSelectedId(item.id);
                          navigate("feedback");
                        }}
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
                            <span>{formatDate(item.created_at)}</span>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                <button className="text-link-button" onClick={() => navigate("feedback")}>
                  View all feedback →
                </button>
              </div>

              <div className="panel overview-actions-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Action summary</h3>
                    <p>Work created from customer feedback.</p>
                  </div>
                  <span className="record-count">{actions.length} actions</span>
                </div>

                <div className="overview-action-stats">
                  <div><strong>{activeActions}</strong><span>Active</span></div>
                  <div><strong>{overdueActions}</strong><span>Overdue</span></div>
                  <div><strong>{actions.filter((a) => a.status === "resolved").length}</strong><span>Resolved</span></div>
                </div>

                <button className="text-link-button" onClick={() => navigate("actions")}>
                  View all action items →
                </button>
              </div>
            </section>
          </>
        )}

        {page === "feedback" && (
          <section className="content-grid feedback-management-grid">
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
                      className={`feedback-row ${selectedId === item.id ? "selected" : ""}`}
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
                          <span>{formatDate(item.created_at)}</span>
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
                    <p className="full-feedback">{selectedFeedback.feedback_text}</p>
                  </div>

                  <div className="detail-section">
                    <label>Category</label>
                    <span className="category-tag">{selectedFeedback.category}</span>
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
                            <span className="linked-action-due">
                              Due: {formatDate(action.due_date)}
                            </span>
                            <select
                              aria-label={`Status for ${action.title}`}
                              value={action.status}
                              onChange={(event) =>
                                void updateAction(action.id, {
                                  status: event.target.value as Action["status"],
                                })
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
        )}

        {page === "actions" && (
          <section className="panel actions-page-panel">
            <div className="panel-heading">
              <div>
                <h3>All action items</h3>
                <p>Track ownership, progress and deadlines across your customer feedback.</p>
              </div>
              <span className="record-count">
                {filteredActions.length} of {actions.length} actions
              </span>
            </div>

            <div className="action-summary-strip">
              <div><strong>{actions.length}</strong><span>Total actions</span></div>
              <div><strong>{activeActions}</strong><span>Active</span></div>
              <div><strong>{overdueActions}</strong><span>Overdue</span></div>
              <div><strong>{actions.filter((item) => item.status === "resolved").length}</strong><span>Resolved</span></div>
            </div>

            <div className="toolbar actions-toolbar">
              <div className="search-box">
                <Search size={16} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search action, owner or feedback..."
                />
              </div>
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                aria-label="Filter actions by status"
              >
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>

            {loading ? (
              <div className="empty-state">Loading action items...</div>
            ) : filteredActions.length === 0 ? (
              <div className="empty-state">
                <Target size={26} />
                <strong>No action items found</strong>
                <span>Try changing your search or filter.</span>
              </div>
            ) : (
              <div className="actions-table-wrap">
                <table className="actions-table">
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Linked feedback</th>
                      <th>Owner</th>
                      <th>Status</th>
                      <th>Date created</th>
                      <th>Due date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredActions.map((action) => {
                      const linked = feedback.find((item) => item.id === action.feedback_id);
                      const overdue = isOverdue(action);

                      return (
                        <tr key={action.id}>
                          <td className="action-title-cell">
                            <strong>{action.title}</strong>
                            {action.description && <small>{action.description}</small>}
                          </td>

                          <td className="linked-feedback-cell">
                            {linked ? (
                              <>
                                <strong>{linked.customer_name}</strong>
                                <small>{linked.feedback_text}</small>
                                <PriorityBadge priority={linked.priority} />
                              </>
                            ) : (
                              <span className="muted-cell">Feedback unavailable</span>
                            )}
                          </td>

                          <td>
                            <select
                              className="table-edit-select owner-select"
                              aria-label={`Owner for ${action.title}`}
                              value={action.owner ?? ""}
                              disabled={savingActionId === action.id}
                              onChange={(event) =>
                                void updateAction(action.id, {
                                  owner: event.target.value || null,
                                })
                              }
                            >
                              <option value="">Unassigned</option>
                              {ownerOptions.map((owner) => (
                                <option key={owner} value={owner}>
                                  {owner}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td>
                            <select
                              className="table-edit-select"
                              aria-label={`Status for ${action.title}`}
                              value={action.status}
                              disabled={savingActionId === action.id}
                              onChange={(event) =>
                                void updateAction(action.id, {
                                  status: event.target.value as Action["status"],
                                })
                              }
                            >
                              <option value="open">Open</option>
                              <option value="in_progress">In progress</option>
                              <option value="resolved">Resolved</option>
                            </select>
                          </td>

                          <td className="date-cell">
                            <span>
                              <CalendarDays size={14} />
                              {formatDate(action.created_at)}
                            </span>
                          </td>

                          <td className="date-cell">
                            <label className={`due-date-control ${overdue ? "overdue" : ""}`}>
                              <CalendarDays size={14} />
                              <input
                                type="date"
                                aria-label={`Due date for ${action.title}`}
                                value={action.due_date ?? ""}
                                disabled={savingActionId === action.id}
                                onChange={(event) =>
                                  void updateAction(action.id, {
                                    due_date: event.target.value || null,
                                  })
                                }
                              />
                              {overdue && <small>Overdue</small>}
                            </label>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <p className="table-footnote">
              Changes to owner, status and due date are saved to VoiceLoop when you edit a field.
            </p>
          </section>
        )}

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
    } = supabaseClient.auth.onAuthStateChange((_event, currentSession) =>
      setSession(currentSession),
    );

    return () => subscription.unsubscribe();
  }, []);

  if (checkingSession) {
    return <div className="auth-loading">Loading VoiceLoop...</div>;
  }

  const params = new URLSearchParams(window.location.search);
  const requestId = params.get("request_id");

  if (requestId) return <OAuthConsent requestId={requestId} />;
  if (!session) return <Login />;

  return (
    <>
      <div className="auth-toolbar">
        <span>{session.user.email}</span>
        <button onClick={() => void supabaseClient.auth.signOut()}>
          Sign out
        </button>
      </div>
      <Dashboard />
    </>
  );
}

export default App;
