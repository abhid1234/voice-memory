import type { VoiceMemo } from "./storage";

/**
 * Trigger the Google OAuth 2.0 Implicit Flow.
 * Redirects the user to Google to authenticate and authorize Sheets access.
 */
export function initiateGoogleOAuth(clientId: string): void {
  const redirectUri = window.location.origin;
  const scope = "https://www.googleapis.com/auth/spreadsheets";
  const state = "google_sheets_export";
  
  const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(clientId)}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=token&` +
    `scope=${encodeURIComponent(scope)}&` +
    `state=${encodeURIComponent(state)}`;

  window.location.href = oauthUrl;
}

/**
 * Check the URL hash for an OAuth access token and clean it from the address bar.
 */
export function checkForOAuthToken(): { token: string | null; state: string | null } {
  const hash = window.location.hash;
  if (!hash) return { token: null, state: null };

  const params = new URLSearchParams(hash.substring(1));
  const accessToken = params.get("access_token");
  const state = params.get("state");

  if (accessToken) {
    // Clear the hash from the address bar silently
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }

  return { token: accessToken, state };
}

/**
 * Append voice memos as new rows in the user's specified Google Sheet.
 */
export async function appendMemosToGoogleSheet(
  spreadsheetId: string,
  sheetName: string,
  accessToken: string,
  memos: VoiceMemo[]
): Promise<void> {
  if (memos.length === 0) return;

  const cleanSheetName = sheetName.trim() || "Sheet1";
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(cleanSheetName)}!A:D:append?valueInputOption=RAW`;

  const values = memos.map((memo) => [
    new Date(memo.timestamp).toISOString(),
    memo.transcript,
    memo.rawTranscript || "",
    (memo.tags || []).join(", "),
  ]);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      values,
    }),
  });

  if (!res.ok) {
    let errorMsg = `HTTP Error ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson?.error?.message) {
        errorMsg = errJson.error.message;
      }
    } catch {
      // Ignored
    }
    throw new Error(`Google Sheets append failed: ${errorMsg}`);
  }
}
