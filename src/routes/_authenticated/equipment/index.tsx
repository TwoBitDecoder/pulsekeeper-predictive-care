import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/panel";
import { RiskMeter } from "@/components/risk-meter";
import { StatusBadge } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/lib/format";
import { getFleetAnalysis, STATUS_ORDER, type Status } from "@/lib/ml/analysis";
import { STATUS_META } from "@/lib/status-meta";

export const Route = createFileRoute("/_authenticated/equipment/")({
  head: () => ({
    meta: [
      { title: "Equipment Fleet — PulseGuard" },
      { name: "description", content: "Every monitored infusion pump and patient monitor with AI failure risk, battery, temperature and next maintenance." },
      { property: "og:title", content: "Equipment Fleet — PulseGuard" },
      { property: "og:description", content: "Search and filter hospital equipment by predicted failure risk." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EquipmentList,
});

function EquipmentList() {
  const { devices } = getFleetAnalysis();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState<"all" | Status>("all");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return devices.filter(
      (d) =>
        (type === "all" || d.type === type) &&
        (status === "all" || d.status === status) &&
        (!q || `${d.id} ${d.model} ${d.ward} ${d.serial}`.toLowerCase().includes(q)),
    );
  }, [devices, query, type, status]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Equipment" title="Monitored fleet" description="Sorted by predicted failure risk. Select a device to see its readings, risk factors and history." />

      <div className="flex flex-col gap-2 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search ID, model, ward or serial" className="pl-9" />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="md:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="Infusion Pump">Infusion pumps</SelectItem>
            <SelectItem value="Patient Monitor">Patient monitors</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as "all" | Status)}>
          <SelectTrigger className="md:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_ORDER.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_META[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Device</TableHead>
              <TableHead className="hidden md:table-cell">Ward</TableHead>
              <TableHead className="w-44">Failure risk</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Temp</TableHead>
              <TableHead className="hidden text-right lg:table-cell">Battery</TableHead>
              <TableHead className="hidden text-right xl:table-cell">Hours</TableHead>
              <TableHead className="hidden text-right md:table-cell">Next service</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((d) => (
              <TableRow key={d.id} className="relative">
                <TableCell>
                  <Link to="/equipment/$id" params={{ id: d.id }} className="after:absolute after:inset-0">
                    <span className="font-mono text-sm text-primary">{d.id}</span>
                    <span className="block text-xs text-muted-foreground">
                      {d.model} · {d.type}
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="hidden text-sm md:table-cell">{d.ward}</TableCell>
                <TableCell>
                  <RiskMeter risk={d.risk} status={d.status} />
                </TableCell>
                <TableCell className="hidden text-right font-mono text-xs tabular lg:table-cell">{d.features.avgTemperature.toFixed(1)}°C</TableCell>
                <TableCell className="hidden text-right font-mono text-xs tabular lg:table-cell">{d.features.batteryHealth.toFixed(0)}%</TableCell>
                <TableCell className="hidden text-right font-mono text-xs tabular xl:table-cell">{formatNumber(d.operatingHours)}</TableCell>
                <TableCell className="hidden text-right font-mono text-xs tabular md:table-cell">{d.forecast.days === 0 ? "Now" : `${d.forecast.days}${d.forecast.days === 180 ? "+" : ""} d`}</TableCell>
                <TableCell className="text-right">
                  <StatusBadge status={d.status} />
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  No equipment matches these filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Showing {rows.length} of {devices.length} devices
      </p>
    </div>
  );
}
