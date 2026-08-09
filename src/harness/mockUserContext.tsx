// Harness-only stand-in for '../context/UserContext', aliased in via vite.harness.config.ts.
import { useEffect, useState } from "react";
import type { AppUser } from "../lib/types";

const FIXTURE_USER: AppUser = {
  id: 1,
  name: "Alice",
  email: "alice@example.com",
  collectiveCode: "ABCD12",
  status: "ACTIVE",
  color: "#ff0000",
};

export function useUser() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(FIXTURE_USER);
  return {
    currentUser,
    setCurrentUser,
    handleLogout: async () => {},
  };
}

export function useRealtimeEvent(
  _onEvent: (event: { type: string }) => void,
  _onReconnect?: () => void,
) {
  useEffect(() => {}, []);
}
