
import { useState } from "react";
import { supabaseClient } from "../services/supabase";
import { ShieldCheck, Check, Loader2 } from "lucide-react";

interface OAuthConsentProps {
  requestId: string;
}

export default function OAuthConsent({ requestId }: OAuthConsentProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleApprove() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();

      if (!session) {
        throw new Error("Please sign in to VoiceLoop first.");
      }

      const apiUrl =
        import.meta.env.VITE_API_URL || "http://localhost:3001";

      const response = await fetch(`${apiUrl}/api/oauth/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          request_id: requestId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Could not approve access.");
      }

      if (!result.redirect_url) {
        throw new Error("Authorization redirect URL is missing.");
      }

      window.location.assign(result.redirect_url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
      setLoading(false);
    }
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
            <ShieldCheck size={25} />
          </div>

          <h2>Connect Claude to VoiceLoop</h2>

          <p>
            Claude wants permission to access your VoiceLoop workspace
            and help you manage customer feedback.
          </p>
        </div>

        <div className="consent-permissions">
          <h3>Permissions requested</h3>

          <div>
            <Check size={17} />
            Read customer feedback and action items
          </div>

          <div>
            <Check size={17} />
            Create customer feedback and action items
          </div>

          <div>
            <Check size={17} />
            Update existing records
          </div>
        </div>

        {error && <p className="login-error">{error}</p>}

        <button
          type="button"
          onClick={() => void handleApprove()}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 size={17} className="spin-icon" />
              Connecting...
            </>
          ) : (
            "Approve access"
          )}
        </button>

        <p className="login-footer">
          Only approve access if you initiated this connection.
        </p>
      </section>
    </main>
  );
}
