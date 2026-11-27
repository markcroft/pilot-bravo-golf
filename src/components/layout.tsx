import { NavLink, Outlet } from "react-router";
import { Boxes, ShieldAlert } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export function Layout() {
  const link = ({ isActive }: { isActive: boolean }) =>
    cn("rounded-md px-3 py-1.5 text-sm font-medium transition-colors", isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground");
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <NavLink to="/" className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="size-5 text-orange-600" />
            <span>Corrosion Tracker</span>
          </NavLink>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={link}>Fleet</NavLink>
            <NavLink to="/models" className={link}>
              <span className="inline-flex items-center gap-1.5"><Boxes className="size-4" />Model library</span>
            </NavLink>
          </nav>
          <div className="ml-auto"><ThemeToggle /></div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
