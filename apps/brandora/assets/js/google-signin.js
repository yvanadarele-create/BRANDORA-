/**
 * Loaded on the login and signup pages: shows or hides "Sign in with Google"
 * depending on whether the deployment has real Client ID/Secret set. See
 * mountGoogleSignIn() in api.js.
 */
import { mountGoogleSignIn } from './api.js';

void mountGoogleSignIn();
