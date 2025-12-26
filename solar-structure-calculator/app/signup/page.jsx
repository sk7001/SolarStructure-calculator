"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

const fieldClass =
  "w-full h-14 rounded-lg bg-gray-800 text-gray-100 border border-gray-700 px-4 " +
  "text-base outline-none focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30";

const cardClass = "bg-gray-900 rounded-xl shadow-lg border border-gray-800";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const onSignup = async () => {
    if (!email || !password) return setMsg("Email and password required.");
    if (password !== confirm) return setMsg("Passwords do not match.");

    setLoading(true);
    setMsg("");

    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (error) return setMsg(error.message);

    // If email confirmations are ON, user must confirm email first.
    setMsg("Signup successful. Now login (or confirm email if required).");
    setTimeout(() => router.push("/login"), 800);
  };

  return (
    <div className="bg-gray-950 min-h-screen text-gray-100">
      <div className="max-w-md mx-auto p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Sign up</h1>
          <Link
            href="/"
            className="rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors px-4 py-2 border border-gray-700"
          >
            Home
          </Link>
        </div>

        <div className={`${cardClass} p-6 mt-6`}>
          <label className="block text-gray-300 mb-2">Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass} />

          <label className="block text-gray-300 mb-2 mt-4">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={fieldClass}
          />

          <label className="block text-gray-300 mb-2 mt-4">Confirm password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={fieldClass}
          />

          {msg ? <div className="text-sm text-gray-300 mt-3">{msg}</div> : null}

          <button
            type="button"
            disabled={loading}
            onClick={onSignup}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-3 rounded-lg"
          >
            Create account
          </button>

          <Link
            href="/login"
            className="mt-3 block w-full text-center bg-gray-800 hover:bg-gray-700 text-white px-4 py-3 rounded-lg border border-gray-700"
          >
            Already have an account? Login
          </Link>
        </div>
      </div>
    </div>
  );
}
