export default function formatFirebaseError(err: unknown): string {
  if (!err) return 'An unexpected error occurred.';

  // Some Firebase errors come as objects with `code` or as strings like
  // "Firebase: Error (auth/invalid-credential)."
  const asAny = err as any;
  let codeStr = '';

  if (typeof asAny?.code === 'string') codeStr = asAny.code;
  else if (typeof asAny?.message === 'string') codeStr = asAny.message;
  else if (typeof err === 'string') codeStr = err;

  const authMatch = codeStr.match(/auth\/[a-zA-Z-]+/);
  const code = authMatch ? authMatch[0] : codeStr;

  switch (code) {
    case 'auth/invalid-credential':
      return 'Invalid credentials — please check your email and password.';
    case 'auth/wrong-password':
      return 'Incorrect password. Try again or reset your password.';
    case 'auth/user-not-found':
      return 'No account found with that email address.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in instead.';
    case 'auth/weak-password':
      return 'Password is too weak. Use at least 6 characters.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed before completing. Please try again.';
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled. Please try again.';
    case 'auth/popup-blocked':
      return 'Popup blocked — allow popups in your browser and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your internet connection and try again.';
    default:
      if (typeof err === 'object' && err instanceof Error) return err.message;
      if (typeof err === 'string') return err.replace(/^Firebase: Error \(|\)\.?$/g, '').trim();
      return 'An unexpected authentication error occurred.';
  }
}
