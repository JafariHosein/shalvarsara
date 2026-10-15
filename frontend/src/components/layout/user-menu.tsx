import { Link } from "react-router-dom";
import { LayoutDashboard, LogOut, Package, User as UserIcon } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore, useIsAdmin, useIsAuthenticated } from "@/store/auth-store";

/** Sign-in links for guests; account menu for authenticated users. */
export function UserMenu() {
  const isAuthenticated = useIsAuthenticated();
  const isAdmin = useIsAdmin();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  if (!isAuthenticated) {
    return (
      <Button asChild variant="outline" size="sm" className="gap-2">
        <Link to="/login">
          <UserIcon className="size-4" />
          ورود / ثبت‌نام
        </Link>
      </Button>
    );
  }

  const initial = user?.name?.trim().charAt(0) ?? "؟";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="حساب کاربری">
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary/10 text-primary">{initial}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate">{user?.name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground" dir="ltr">
            {user?.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/account" className="cursor-pointer">
            <UserIcon />
            حساب کاربری
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/account/orders" className="cursor-pointer">
            <Package />
            سفارش‌های من
          </Link>
        </DropdownMenuItem>
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/admin" className="cursor-pointer">
                <LayoutDashboard />
                پنل مدیریت
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:text-destructive"
          onSelect={() => {
            void logout();
          }}
        >
          <LogOut />
          خروج از حساب
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
