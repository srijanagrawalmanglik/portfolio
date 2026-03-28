# Google API Setup Guide (Fixing Error 400)

Your "Access Blocked: Redirect URI Mismatch" error happens because Google doesn't trust your local server. Follow these steps exactly to fix it.

## 1. Go to Google Cloud Console
1.  Open [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials).
2.  Ensure you are in the correct project (top-left dropdown).

## 2. Configure OAuth Consent Screen (If not done)
If you haven't set this up yet:
1.  Click **OAuth consent screen** in the left sidebar.
2.  Choose **External** and click **Create**.
3.  **App Information**:
    - **App Name**: Antigravity Dashboard (or anything you like).
    - **User Support Email**: Your email.
4.  **Developer Contact Info**: Your email.
5.  Click **Save and Continue** until finished (default scopes are fine).
6.  **IMPORTANT**: Go to **Test Users** and click **+ Add Users**. Add your own Gmail address so you can log in during testing.

## 3. Fix the Credentials (The Critical Step)
This connects your code to Google.

1.  Click **Credentials** in the left sidebar.
2.  Look for your existing **OAuth 2.0 Client ID** (or create a new one: **+ Create Credentials > OAuth Client ID** > **Web Application**).
3.  Click the **Pencil Icon** (Edit) on your client.
4.  **Authorized JavaScript Origins**:
    - Add: `http://localhost:3000`
5.  **Authorized Redirect URIs**:
    - This must match your code EXACTLY.
    - Add: `http://localhost:3000/auth/google/callback`
6.  Click **Save**.

## 4. Update Your Code (If you created NEW credentials)
If you made a *new* Client ID, you must update your `.env` file:

1.  Open the `.env` file in your code editor.
2.  Update `GOOGLE_CLIENT_ID` with the new Client ID.
3.  Update `GOOGLE_CLIENT_SECRET` with the new Client Secret.
4.  Ensure `GOOGLE_REDIRECT_URI` is: `http://localhost:3000/auth/google/callback`

## 5. Restart & Test
1.  Stop your server (`Ctrl+C` in terminal).
2.  Run `npm start`.
3.  Go to the Dashboard > Calendar Tab.
4.  Click **Connect Google Calendar**.
5.  It should now let you sign in!

_Note: Changes in Google Cloud can sometimes take 5 minutes to propagate, but usually it's instant._
