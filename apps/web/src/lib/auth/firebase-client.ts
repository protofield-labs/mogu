"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";

import {
  readFirebaseAuthEmulatorHost,
  readFirebaseClientConfig,
} from "./firebase-config";

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let emulatorConnected = false;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    const existing = getApps()[0];
    app = existing ?? initializeApp(readFirebaseClientConfig());
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
    const emulatorHost = readFirebaseAuthEmulatorHost();
    if (emulatorHost && !emulatorConnected) {
      connectAuthEmulator(auth, `http://${emulatorHost}`, {
        disableWarnings: true,
      });
      emulatorConnected = true;
    }
  }
  return auth;
}
