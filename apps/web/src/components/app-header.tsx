"use client";

import Link from "next/link";

import { useAuth } from "@/contexts/auth-context";

export function AppHeader() {
  const { user, logout } = useAuth();

  return (
    <header className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
      <Link href="/" className="font-semibold text-gray-900">
        mogu
      </Link>
      <div className="flex items-center gap-4 text-sm text-gray-600">
        {user?.email ? <span>{user.email}</span> : null}
        <button
          type="button"
          onClick={() => void logout()}
          className="text-blue-600 hover:underline"
        >
          Log out
        </button>
      </div>
    </header>
  );
}
