import { useUser, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useState, useEffect } from "react";

/**
 * Temporary diagnostic panel to debug auth flow.
 * REMOVE THIS AFTER DEBUGGING.
 */
export function AuthDebugPanel() {
  const { isLoaded, isSignedIn, user: clerkUser } = useUser();
  const { getToken, signOut } = useClerkAuth();
  const [tokenStatus, setTokenStatus] = useState<string>("checking...");
  const [authMeResult, setAuthMeResult] = useState<string>("not called");
  const [serverDebug, setServerDebug] = useState<string>("not called");
  const [expanded, setExpanded] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  // Auto-run diagnostics when signed in
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      getToken()
        .then((token) => {
          if (token) {
            setTokenStatus(`OK (${token.length} chars)`);

            // Call auth-debug endpoint with the token
            fetch("/api/auth-debug", {
              headers: { Authorization: `Bearer ${token}` },
            })
              .then((r) => r.text())
              .then((t) => setServerDebug(t.substring(0, 600)))
              .catch((e) => setServerDebug(`FETCH ERR: ${e.message}`));

            // Call auth.me with the token
            fetch("/api/trpc/auth.me", {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            })
              .then(async (r) => {
                const text = await r.text();
                setAuthMeResult(`${r.status}: ${text.substring(0, 400)}`);
              })
              .catch((e) => setAuthMeResult(`FETCH ERR: ${e.message}`));
          } else {
            setTokenStatus("NULL — no token returned!");
            setServerDebug("skipped (no token)");
            setAuthMeResult("skipped (no token)");
          }
        })
        .catch((err) => {
          setTokenStatus(`ERROR: ${err.message}`);
        });
    } else if (isLoaded) {
      setTokenStatus("N/A (not signed in)");
    }
  }, [isLoaded, isSignedIn, getToken]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      window.location.reload();
    } catch (e: any) {
      setSigningOut(false);
      alert("Sign out failed: " + e.message);
    }
  };

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        style={{
          position: "fixed",
          bottom: 10,
          right: 10,
          zIndex: 99999,
          background: "#ff6600",
          color: "#fff",
          border: "none",
          borderRadius: 4,
          padding: "6px 12px",
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        🔧 Debug
      </button>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 10,
        right: 10,
        zIndex: 99999,
        background: "rgba(0,0,0,0.95)",
        color: "#0f0",
        fontFamily: "monospace",
        fontSize: 11,
        padding: 12,
        borderRadius: 8,
        maxWidth: 460,
        maxHeight: 520,
        overflow: "auto",
        border: "1px solid #444",
        boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong style={{ color: "#ff6600" }}>Auth Debug Panel</strong>
        <div style={{ display: "flex", gap: 8 }}>
          {isSignedIn && (
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              style={{
                background: "#c00",
                color: "#fff",
                border: "none",
                borderRadius: 3,
                padding: "2px 8px",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              {signingOut ? "..." : "Sign Out"}
            </button>
          )}
          <button
            onClick={() => setExpanded(false)}
            style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 11 }}
          >
            [hide]
          </button>
        </div>
      </div>
      <div>
        <div><strong>Clerk loaded:</strong> {String(isLoaded)}</div>
        <div><strong>isSignedIn:</strong> <span style={{ color: isSignedIn ? "#0f0" : "#f00" }}>{String(isSignedIn)}</span></div>
        <div><strong>Clerk user:</strong> {clerkUser ? `${clerkUser.primaryEmailAddress?.emailAddress} (${clerkUser.id})` : "null"}</div>
        <div style={{ marginTop: 6 }}><strong>getToken():</strong> {tokenStatus}</div>
        <div style={{ marginTop: 6, borderTop: "1px solid #333", paddingTop: 6 }}>
          <strong style={{ color: "#ff0" }}>Server /api/auth-debug:</strong>
        </div>
        <div style={{ color: "#aaa", wordBreak: "break-all", whiteSpace: "pre-wrap" }}>{serverDebug}</div>
        <div style={{ marginTop: 6, borderTop: "1px solid #333", paddingTop: 6 }}>
          <strong style={{ color: "#ff0" }}>auth.me response:</strong>
        </div>
        <div style={{ color: "#aaa", wordBreak: "break-all", whiteSpace: "pre-wrap" }}>{authMeResult}</div>
      </div>
    </div>
  );
}
