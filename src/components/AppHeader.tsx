import { useNavigate, useLocation } from "react-router-dom";
import { User, CheckSquare, Calendar, MessageCircle, Wallet, Trophy, Recycle, UserCircle, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUser } from "../context/UserContext";
import { colorForMember } from "../lib/memberColors";
import { BrandMark } from "./ui-kit";
import type { Tone } from "../lib/tones";

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

// Each tab's identity colour, carried by its header (and matched by that page's FAB — see
// Fab's `tone` prop). Home is deliberately absent: it mixes every category, so it keeps the
// app's neutral header rather than borrowing one tab's colour.
const pageTones: Record<string, Tone> = {
  "/tasks": "mint",
  "/calendar": "peri",
  "/chat": "blush",
  "/economy": "butter",
  "/economy/pant": "butter",
  "/social": "lilac",
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
  const pageTone = pageTones[location.pathname];

  return (
    <header
      className={`sticky top-0 z-40 safe-top ${
        pageTone ? `tone-tile tone-${pageTone}` : "bg-background/92 backdrop-blur-xl"
      }`}
    >
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 max-w-xl mx-auto">
        <h1 className="min-w-0 flex-1 truncate pr-3 font-display font-extrabold text-xl tracking-tight">
          {isHomePage ? (
            <span className="inline-flex items-center gap-2">
              <BrandMark className="h-6 w-6" />
              <span className="text-foreground">Kollekt</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              {PageIcon && (
                <PageIcon className="h-5 w-5 shrink-0" />
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
            // pressable-tight keeps the avatar visually 40px — the size the header is balanced
            // around — while growing its hit area to the 44px minimum every other icon button uses.
            className="pressable-tight h-10 w-10 rounded-full bg-primary text-white flex items-center justify-center border border-border"
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
