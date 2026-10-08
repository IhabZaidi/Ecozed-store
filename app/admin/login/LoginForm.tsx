"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const res = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setErr(data.error || "فشل الدخول");
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border p-6 shadow-sm">
      <h1 className="text-xl font-extrabold">دخول الإدارة 🔐</h1>
      <input
        type="password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        placeholder="كلمة المرور"
        className="mt-4 w-full rounded-xl border px-4 py-3 outline-none focus:border-black"
      />
      {err && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
          {err}
        </p>
      )}
      <button
        disabled={loading}
        className="mt-4 w-full rounded-xl bg-black px-4 py-3 font-bold text-white disabled:opacity-60"
      >
        {loading ? "…" : "دخول"}
      </button>
    </form>
  );
}
