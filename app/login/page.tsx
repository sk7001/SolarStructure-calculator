"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

const fieldClass =
  "w-full h-14 rounded-lg bg-gray-800 text-gray-100 border border-gray-700 px-4 " +
  "text-base outline-none focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30";

const cardClass = "bg-gray-900 rounded-xl shadow-lg border border-gray-800";

// Spinner component
function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-gray-200">
      <div className="h-5 w-5 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
      {label ? <div className="text-sm">{label}</div> : null}
    </div>
  );
}

// Full-screen buffering overlay
function ProcessingOverlay({ open, label }: { open: boolean; label?: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center">
      <div className="rounded-xl border border-gray-800 bg-gray-950 px-5 py-4 shadow-2xl">
        <Spinner label={label || "Processing..."} />
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [busyLabel, setBusyLabel] = useState("Processing...");
  const [msg, setMsg] = useState("");

  const signUp = async () => {
    if (!email || !password) {
      setMsg("Enter email and password.");
      return;
    }

    setLoading(true);
    setBusyLabel("Signing up...");
    setMsg("");

    const { error } = await supabase.auth.signUp({ email, password });

    setLoading(false);

    if (error) return setMsg(error.message);
    setMsg("Signup success. Now sign in (or check email if confirmation is enabled).");
  };

  const signIn = async () => {
    if (!email || !password) {
      setMsg("Enter email and password.");
      return;
    }

    setLoading(true);
    setBusyLabel("Signing in...");
    setMsg("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) return setMsg(error.message);
    router.push("/projects");
    router.refresh();
  };

  const signOut = async () => {
    setLoading(true);
    setBusyLabel("Signing out...");
    setMsg("");

    const { error } = await supabase.auth.signOut();

    setLoading(false);

    if (error) return setMsg(error.message);
    setMsg("Signed out.");
  };

  return (
    <div className="bg-gray-950 min-h-screen text-gray-100">
      {/* Buffering overlay */}
      <ProcessingOverlay open={loading} label={busyLabel} />

      <div className="max-w-md mx-auto p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Login</h1>

          <Link
            href="/"
            className={`rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors px-4 py-2 border border-gray-700 ${
              loading ? "pointer-events-none opacity-60" : ""
            }`}
          >
            Home
          </Link>
        </div>

        <div className={`${cardClass} p-6 mt-6`}>
          <label className="block text-gray-300 mb-2">Email</label>
          <input
            disabled={loading}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={fieldClass}
          />

          <label className="block text-gray-300 mb-2 mt-4">Password</label>
          <input
            disabled={loading}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={fieldClass}
          />

          {msg ? <div className="text-sm text-gray-300 mt-3">{msg}</div> : null}

          <button
            type="button"
            disabled={loading}
            onClick={signIn}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-3 rounded-lg"
          >
            {loading ? "Working..." : "Sign in"}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={signUp}
            className="mt-3 w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white px-4 py-3 rounded-lg border border-gray-700"
          >
            {loading ? "Working..." : "Sign up"}
          </button>

        </div>
      </div>
    </div>
  );
}
