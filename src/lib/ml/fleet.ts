import { AS_OF_ISO, addDays } from "@/lib/format";
import { clamp, createRng, gaussian, pick, poisson, shuffle, uniform, type Rng } from "./random";

export type EquipmentType = "Infusion Pump" | "Patient Monitor";
export type MaintenanceType = "Preventive" | "Corrective" | "Calibration" | "Battery replacement";

export interface TelemetryPoint {
  date: string;
  temperature: number;
  batteryHealth: number;
  errorCount: number;
}

export interface MaintenanceEvent {
  date: string;
  type: MaintenanceType;
  note: string;
  technician: string;
}

export interface Equipment {
  id: string;
  type: EquipmentType;
  model: string;
  manufacturer: string;
  serial: string;
  ward: string;
  installDate: string;
  operatingHours: number;
  daysSinceService: number;
  pastFailures: number;
  telemetry: TelemetryPoint[];
  maintenance: MaintenanceEvent[];
}

export const FLEET_SIZE = 42;
export const TELEMETRY_DAYS = 30;

const MODELS: Record<EquipmentType, { model: string; manufacturer: string }[]> = {
  "Infusion Pump": [
    { model: "InfuSense P200", manufacturer: "Medivance" },
    { model: "FlowGuard LVP-3", manufacturer: "Corvia Medical" },
    { model: "Syrinx SP-40", manufacturer: "Halden Biotech" },
  ],
  "Patient Monitor": [
    { model: "VitaTrack M12", manufacturer: "Northstar Health" },
    { model: "CardioView 8", manufacturer: "Medivance" },
    { model: "Sentra BX-5", manufacturer: "Corvia Medical" },
  ],
};

export const WARDS = ["ICU", "Emergency", "Cardiology", "Oncology", "Pediatrics", "Surgery", "General Ward"];
const TECHS = ["R. Mehta", "S. Banerjee", "A. Khan", "L. Fernandes", "P. Iyer", "D. Ghosh"];

const NOTES: Record<MaintenanceType, string[]> = {
  Preventive: ["Scheduled PM completed, all checks passed", "Annual PM; cleaned and inspected housing", "PM checklist completed, firmware updated"],
  Corrective: ["Replaced faulty door sensor", "Repaired power board after shutdown", "Fixed intermittent display fault", "Replaced occlusion pressure sensor"],
  Calibration: ["Flow-rate calibration within tolerance", "SpO₂/NIBP module calibrated", "Sensor calibration verified"],
  "Battery replacement": ["Battery pack replaced, full cycle test OK"],
};

type Condition = "healthy" | "degrading" | "failing";

const PROFILES = {
  healthy: { temp: 33.6, drift: 0, driftSd: 0.01, batt: 92, decline: 0.03, errors: 0.3, hours: [3, 22], service: [20, 240], failures: 0.3, spike: 0.04 },
  degrading: { temp: 35.4, drift: 0.05, driftSd: 0.02, batt: 79, decline: 0.12, errors: 1.0, hours: [14, 34], service: [160, 420], failures: 1.0, spike: 0.25 },
  failing: { temp: 37.2, drift: 0.12, driftSd: 0.035, batt: 69, decline: 0.24, errors: 2.0, hours: [22, 46], service: [260, 600], failures: 2.2, spike: 0.5 },
} as const;

function buildHistory(rng: Rng, daysSinceService: number, pastFailures: number): MaintenanceEvent[] {
  const routine = 2 + Math.floor(rng() * 3);
  const types: MaintenanceType[] = [
    ...Array<MaintenanceType>(routine).fill("Preventive"),
    ...Array<MaintenanceType>(pastFailures).fill("Corrective"),
    "Calibration",
    ...(rng() < 0.4 ? (["Battery replacement"] as MaintenanceType[]) : []),
  ];
  const ordered: MaintenanceType[] = [rng() < 0.7 ? "Preventive" : "Calibration", ...shuffle(rng, types.slice(1))];
  let offset = daysSinceService;
  return ordered.map((type) => {
    const event = { date: addDays(AS_OF_ISO, -offset), type, note: pick(rng, NOTES[type]), technician: pick(rng, TECHS) };
    offset += Math.round(70 + rng() * 210);
    return event;
  });
}

export function generateFleet(seed = 7): Equipment[] {
  const rng = createRng(seed);
  return Array.from({ length: FLEET_SIZE }, (_, i) => {
    const type: EquipmentType = i % 2 === 0 ? "Infusion Pump" : "Patient Monitor";
    const r = rng();
    const condition: Condition = r < 0.58 ? "healthy" : r < 0.83 ? "degrading" : "failing";
    const p = PROFILES[condition];
    const { model, manufacturer } = pick(rng, MODELS[type]);

    const hoursK = uniform(rng, p.hours);
    const daysSinceService = Math.round(uniform(rng, p.service));
    const pastFailures = poisson(rng, p.failures);
    const baseTemp = p.temp + gaussian(rng) * 0.8 + (type === "Patient Monitor" ? 0.6 : 0);
    const drift = p.drift + gaussian(rng) * p.driftSd;
    const batt0 = clamp(p.batt + gaussian(rng) * 5, 45, 100);
    const decline = p.decline * (0.7 + rng() * 0.6);
    const spike = rng() < p.spike;

    const telemetry: TelemetryPoint[] = Array.from({ length: TELEMETRY_DAYS }, (_, d) => {
      const spiking = spike && d >= TELEMETRY_DAYS - 2;
      const lambda = p.errors * (condition === "failing" ? 0.5 + d / 20 : 1);
      return {
        date: addDays(AS_OF_ISO, d - (TELEMETRY_DAYS - 1)),
        temperature: +(baseTemp + drift * d + gaussian(rng) * 0.35 + (spiking ? 4 + rng() * 2 : 0)).toFixed(1),
        batteryHealth: +clamp(batt0 - decline * d + gaussian(rng) * 0.4, 0, 100).toFixed(1),
        errorCount: poisson(rng, lambda) + (spiking ? 3 : 0),
      };
    });

    const operatingHours = Math.round(hoursK * 1000);
    return {
      id: `${type === "Infusion Pump" ? "IP" : "PM"}-${1001 + i}`,
      type,
      model,
      manufacturer,
      serial: `${manufacturer.slice(0, 2).toUpperCase()}${Math.floor(100000 + rng() * 899999)}`,
      ward: pick(rng, WARDS),
      installDate: addDays(AS_OF_ISO, -Math.round(operatingHours / 12 + 30)),
      operatingHours,
      daysSinceService,
      pastFailures,
      telemetry,
      maintenance: buildHistory(rng, daysSinceService, pastFailures),
    };
  });
}
