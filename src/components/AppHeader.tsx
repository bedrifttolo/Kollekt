import { useNavigate, useLocation } from "react-router-dom";
import { User, CheckSquare, Calendar, MessageCircle, Wallet, Trophy, Recycle, UserCircle, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUser } from "../context/UserContext";
import { colorForMember } from "../lib/memberColors";
import { BrandMark } from "./ui-kit";

const pageTitleKeys: Record<string, string> = {
  "/": "app.name",
  "/tasks": "header.pageTitles.tasks",
  "/calendar": "header.pageTitles.calendar",
  "/chat": "header.pageTitles.chat",
  "/economy": "header.pageTitles.economy",
  "/economy/pant": "header.pageTitles.pantTracker",
  "/social": "header.pageTitles.social",
  "/profile": "header.pageTitles.profile",
};

const pageIcons: Record<string, LucideIcon> = {
  "/tasks": CheckSquare,
  "/calendar": Calendar,
  "/chat": MessageCircle,
  "/economy": Wallet,
  "/economy/pant": Recycle,
  "/social": Trophy,
  "/profile": UserCircle,
};

export default function AppHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { currentUser } = useUser();

  const titleKey = pageTitleKeys[location.pathname] ?? "app.name";
  const title = t(titleKey);
  const isHomePage = location.pathname === "/";
  const PageIcon = pageIcons[location.pathname] ?? null;

  return (
    <header className="sticky top-0 z-40 bg-background/92 backdrop-blur-xl safe-top">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 max-w-xl mx-auto">
        <h1 className="min-w-0 flex-1 truncate pr-3 font-display font-extrabold text-xl tracking-tight">
          {isHomePage ? (
            <span className="inline-flex items-center gap-2">
              <BrandMark className="h-6 w-6 text-primary" />
              <span className="text-primary">Kollekt</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              {PageIcon && (
                <PageIcon className="h-5 w-5 text-primary shrink-0" />
              )}
              {title}
            </span>
          )}
        </h1>

        <div className="flex shrink-0 items-center gap-2">
          {/* User avatar — opens the profile page directly */}
          <button
            data-tour="profile"
            onClick={() => navigate("/profile")}
            style={currentUser ? { backgroundColor: colorForMember(currentUser.name, currentUser.color) } : undefined}
            className="h-10 w-10 rounded-full bg-primary text-white flex items-center justify-center border border-border"
            aria-label={t("header.profile")}
          >
            {currentUser ? (
              <span className="text-sm font-bold text-white">
                {currentUser.name[0].toUpperCase()}
              </span>
            ) : (
              <User className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
