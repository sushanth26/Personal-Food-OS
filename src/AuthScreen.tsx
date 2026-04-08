import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import firebase from "firebase/compat/app";
import * as firebaseui from "firebaseui";
import "firebaseui/dist/firebaseui.css";
import { compatAuth, isFirebaseConfigured } from "./firebase";

type AuthScreenProps = {
  onSignedIn: (user: User) => void;
};

const CONTAINER_ID = "firebaseui-auth-container";

export default function AuthScreen({ onSignedIn }: AuthScreenProps) {
  const [widgetError, setWidgetError] = useState<string | null>(null);
  const [widgetMounted, setWidgetMounted] = useState(false);

  useEffect(() => {
    if (!compatAuth) {
      return;
    }

    return compatAuth.onAuthStateChanged((nextUser) => {
      if (nextUser) {
        onSignedIn(nextUser as unknown as User);
      }
    });
  }, [onSignedIn]);

  const uiConfig = useMemo<firebaseui.auth.Config>(
    () => ({
      signInFlow: "popup",
      credentialHelper: firebaseui.auth.CredentialHelper.NONE,
      signInOptions: [firebase.auth.GoogleAuthProvider.PROVIDER_ID],
      callbacks: {
        signInSuccessWithAuthResult: () => false
      }
    }),
    []
  );

  useEffect(() => {
    if (!compatAuth || !isFirebaseConfigured) {
      return;
    }

    const ui = firebaseui.auth.AuthUI.getInstance() ?? new firebaseui.auth.AuthUI(compatAuth);
    setWidgetError(null);
    setWidgetMounted(false);

    const container = document.getElementById(CONTAINER_ID);
    const observer =
      container &&
      new MutationObserver(() => {
        if (container.childNodes.length > 0) {
          setWidgetMounted(true);
        }
      });

    if (container && observer) {
      observer.observe(container, { childList: true, subtree: true });
    }

    const startupTimer = window.setTimeout(() => {
      if (!container?.childNodes.length) {
        setWidgetError("Sign-in options could not be displayed. Make sure Email, Google, Apple, and Facebook are enabled in Firebase Authentication.");
      }
    }, 2500);

    Promise.resolve()
      .then(() => {
        ui.reset();
        return ui.start(`#${CONTAINER_ID}`, uiConfig);
      })
      .catch((error) => {
        setWidgetError(error instanceof Error ? error.message : "Unable to start Firebase sign-in.");
      });

    return () => {
      window.clearTimeout(startupTimer);
      observer?.disconnect();
      ui.reset();
    };
  }, [uiConfig]);

  return (
    <div className="auth-shell">
      <section className="auth-card">
        <p className="section-kicker">Personal Food OS</p>
        <h1>Save your food system</h1>
        <p className="helper-copy">
          Sign in to keep your profile, weekly plans, reminders, and groceries attached to your account.
        </p>

        {!isFirebaseConfigured || !compatAuth ? (
          <div className="empty-state error-state">
            Firebase is not configured yet. Add your `VITE_FIREBASE_*` keys to enable email, Google, Apple, and
            Facebook login.
          </div>
        ) : (
          <>
            <div id={CONTAINER_ID} style={{ minHeight: 280 }} />
            {!widgetMounted && !widgetError ? <p className="helper-copy">Loading sign-in options...</p> : null}
            {widgetError ? <div className="empty-state error-state">{widgetError}</div> : null}
            <p className="helper-copy">Google sign-in is enabled first. We can add more providers after Firebase is configured for them.</p>
          </>
        )}
      </section>
    </div>
  );
}
