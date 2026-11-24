import { Link } from "@tanstack/react-router";
import { Activity, BellRing, BrainCircuit, LayoutDashboard, MonitorCog } from "lucide-react";
import type { ReactNode } from "react";
import { AS_OF_ISO, formatDate } from "@/lib/format";
import { getFleetAnalysis } from "@/lib/ml/analysis";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/equipment", label: "Equipment", icon: MonitorCog },
  { to: "/alerts", label: "Alerts", icon: BellRing },
  { to: "/model", label: "AI model", icon: BrainCircuit },
] as const;

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-md bg-accent text-primary shadow-glow">
        <Activity className="size-4" />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold tracking-tight">PulseGuard</span>
        <span className="block font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted-foreground">Predictive maintenance</span>
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { alerts } = getFleetAnalysis();
  const critical = alerts.filter((a) => a.severity === "critical").length;
  return (
    <div className="min-h-screen bg-background bg-monitor-grid">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r bg-sidebar/95 px-4 py-5 backdrop-blur lg:flex">
        <Brand />
        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
            >
              <Icon className="size-4" />
              <span className="flex-1">{label}</span>
              {to === "/alerts" && critical > 0 && (
                <span className="rounded bg-status-critical/20 px-1.5 font-mono text-[0.65rem] text-status-critical">{critical}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="mt-auto rounded-md border bg-card/60 p-3">
          <p className="label-caps">Telemetry sync</p>
          <p className="mt-1 flex items-center gap-2 text-xs">
            <span className="size-1.5 rounded-full bg-status-ok animate-signal" />
            Live · {formatDate(AS_OF_ISO)}
          </p>
          <svg viewBox="0 0 200 40" className="mt-2 h-8 w-full text-primary" fill="none" aria-hidden>
            <path
              className="animate-trace"
              d="M0 22 H60 L70 22 L76 8 L84 36 L90 16 L96 22 H140 L148 22 L153 12 L160 30 L165 22 H200"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Brand />
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-xs text-muted-foreground"
              activeProps={{ className: "bg-accent text-accent-foreground" }}
            >
              <Icon className="size-3.5" />
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="px-4 py-6 md:px-8 md:py-8 lg:pl-68">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
