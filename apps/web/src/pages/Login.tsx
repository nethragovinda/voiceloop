
import { useState } from "react";
import { supabaseClient } from "../services/supabase";
import { Activity } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    }

    setLoading(false);
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <div className="login-logo">V</div>
          <div>
            <h1>voiceloop</h1>
            <p>Customer intelligence</p>
          </div>
        </div>

        <div className="login-intro">
          <div className="login-icon">
            <Activity size={23} />
          </div>
          <h2>Welcome back</h2>
          <p>Sign in to manage your customer feedback and actions.</p>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />

          {error && <p className="login-error">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="login-footer">
          Turn customer conversations into meaningful action.
        </p>
      </section>
    </main>
  );
}
