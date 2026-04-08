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
        <div className="auth-art" aria-hidden="true">
          <div className="auth-orb auth-orb-saffron" />
          <div className="auth-orb auth-orb-leaf" />
          <div className="auth-orb auth-orb-berry" />
          <div className="auth-platter" />
          <div className="auth-spark auth-spark-a" />
          <div className="auth-spark auth-spark-b" />
        </div>

        <div className="auth-copy">
          <p className="section-kicker">Personal Food OS</p>
          <h1>Make your food system feel designed</h1>
          <p className="helper-copy">
            Sign in to keep your profile, weekly plans, reminders, and groceries attached to your account.
          </p>

          <div className="auth-pill-row">
            <span className="auth-pill">Weekly planning</span>
            <span className="auth-pill">Smart groceries</span>
            <span className="auth-pill">Soak reminders</span>
          </div>
        </div>

        <div className="auth-value-grid">
          <div className="auth-value-card">
            <span>Plan once</span>
            <strong>See the whole week</strong>
          </div>
          <div className="auth-value-card">
            <span>Shop better</span>
            <strong>Cleaner grocery flow</strong>
          </div>
        </div>

        {!isFirebaseConfigured ? (
          <div className="empty-state error-state">
            Firebase is not configured yet. Add your `VITE_FIREBASE_*` keys to enable Google login.
          </div>
        ) : (
          <div className="auth-actions">
            <button className="primary-button auth-google-button" type="button" onClick={handleGoogleSignIn} disabled={isSigningIn}>
              {isSigningIn ? "Continuing..." : "Continue with Google"}
            </button>
            {authError ? <div className="empty-state error-state">{authError}</div> : null}
          </div>
        )}
      </section>
    </div>
  );
}
