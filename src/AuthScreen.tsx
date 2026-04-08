import { useState } from "react";
import type { User } from "firebase/auth";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider, isFirebaseConfigured } from "./firebase";

type AuthScreenProps = {
  onSignedIn: (user: User) => void;
};

export default function AuthScreen({ onSignedIn }: AuthScreenProps) {
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  async function handleGoogleSignIn() {
    if (!auth) {
      setAuthError("Firebase is not configured yet for this app.");
      return;
    }

    setIsSigningIn(true);
    setAuthError(null);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      onSignedIn(result.user);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sign in with Google right now.";
      setAuthError(message);
    } finally {
      setIsSigningIn(false);
    }
  }

  return (
    <div className="auth-shell">
      <section className="auth-card">
        <p className="section-kicker">Personal Food OS</p>
        <h1>Save your food system</h1>
        <p className="helper-copy">
          Sign in to keep your profile, weekly plans, reminders, and groceries attached to your account.
        </p>

        {!isFirebaseConfigured ? (
          <div className="empty-state error-state">
            Firebase is not configured yet. Add your `VITE_FIREBASE_*` keys to enable Google login.
          </div>
        ) : (
          <div className="auth-actions">
            <button className="primary-button auth-google-button" type="button" onClick={handleGoogleSignIn} disabled={isSigningIn}>
              {isSigningIn ? "Continuing..." : "Continue with Google"}
            </button>
            <p className="helper-copy">Google sign-in is enabled first. More providers can be added later if needed.</p>
            {authError ? <div className="empty-state error-state">{authError}</div> : null}
          </div>
        )}
      </section>
    </div>
  );
}
