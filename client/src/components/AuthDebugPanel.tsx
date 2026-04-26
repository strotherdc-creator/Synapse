import { useUser, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";

/**
 * Temporary diagnostic panel to debug auth flow.
 * Shows Clerk state, token status, and auth.me response.
 * REMOVE THIS AFTER DEBUGGING.
 */
export function AuthDebugPanel() {
  const { isLoaded, isSignedIn, user: clerkUser } = useUser();
  const { getToken } = useClerkAuth();
  const [tokenStatus, setTokenStatus] = useState<string>("checking...");
  const [authMeResult, setAuthMeResult] = useState<string>("not called");
  const [expanded, setExpanded] = useState(true);

  // Check if getToken works
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      getToken()
        .then((token) => {
          if (token) {
            setTokenStatus(`OK (${token.length} chars, starts: ${token.substring(0, 20)}...)`);
          } else {
            setTokenStatus("NULL — no token returned");
          }
        })
        .catch((err) => {
          setTokenStatus(`ERROR: ${err.message}`);
        });
    } else if (isLoaded) {
      setTokenStatus("N/A (not signed in)");
    }
  }, [isLoaded, isSignedIn, getToken]);

  // Manually call auth.me to see what the server returns
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      setAuthMeResult("fetching...");
      getToken()
        .then(async (token) => {
          try {
            const headers: Record<string, string> = {
              "Content-Type": "application/json",
            };
            if (token) {
              headers["Authorization"] = `Bearer ${token}`;
            }
            const resp = await fetch("/api/trpc/auth.me", { headers });
            const text = await resp.text();
            setAuthMeResult(`${resp.status}: ${text.substring(0, 300)}`);
          } catch (err: any) {
            setAuthMeResult(`FETCH ERROR: ${err.message}`);
          }
        })
        .catch((err) => {
          setAuthMeResult(`TOKEN ERROR: ${err.message}`);
        });
    }
  }, [isLoaded, isSignedIn, getToken]);

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
          padding: "4px 8px",
          fontSize: 11,
          cursor: "pointer",
        }}
      >
        Debug
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
        background: "rgba(0,0,0,0.92)",
        color: "#0f0",
        fontFamily: "monospace",
        fontSize: 11,
        padding: 12,
        borderRadius: 8,
        maxWidth: 420,
        maxHeight: 400,
        overflow: "auto",
        border: "1px solid #333",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <strong style={{ color: "#ff6600" }}>Auth Debug Panel</strong>
        <button
          onClick={() => setExpanded(false)}
          style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 11 }}
        >
          [hide]
        </button>
      </div>
      <div>
        <div><strong>Clerk loaded:</strong> {String(isLoaded)}</div>
        <div><strong>isSignedIn:</strong> {String(isSignedIn)}</div>
        <div><strong>Clerk user:</strong> {clerkUser ? `${clerkUser.primaryEmailAddress?.emailAddress} (${clerkUser.id})` : "null"}</div>
        <div style={{ marginTop: 6 }}><strong>getToken():</strong> {tokenStatus}</div>
        <div style={{ marginTop: 6 }}><strong>auth.me response:</strong></div>
        <div style={{ color: "#aaa", wordBreak: "break-all" }}>{authMeResult}</div>
      </div>
    </div>
  );
}
