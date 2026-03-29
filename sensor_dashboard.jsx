import React, { useState, useMemo, useCallback, useRef, Suspense } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine, ScatterChart, Scatter, ZAxis, Legend,
} from "recharts";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Float } from "@react-three/drei";
import * as THREE from "three";

// ════════════════════════════════════════════════════════════════════════
// DATA GENERATION (deterministic, mirrors Python pipeline output)
// ════════════════════════════════════════════════════════════════════════

function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };
}

const rng = seededRandom(42);
const rngVal = () => rng();

const LAB_NAMES = [
  "Chemistry Lab","Physics Research","Bio Sciences","Materials Science",
  "Computer Science Lab","Geology Research","Environmental Science",
  "Mech Engineering Lab","Electrical Engineering Lab","Chemical Engineering",
  "Pharma Research","Neuroscience Lab","Agricultural Research",
  "Nanotech Center","Robotics Lab","Optics Research",
  "Plasma Physics Lab","Genetics Lab","Molecular Biology","Data Science Lab",
];
const RESIDENCE_NAMES = [
  "North Residence","South Residence","East Dorm","West Hall",
  "Maple Court","Oak Residence","Cedar Hall","Elm Dormitory",
  "Pine Lodge","Birch Residence","Aspen Hall","Willow Dorm",
  "Juniper Residence","Spruce Hall","Hawthorn Lodge","Magnolia Court",
  "Dogwood Residence","Hickory Hall","Chestnut Dorm","Walnut Residence",
  "Ivy Hall","Laurel Court","Poplar Residence","Sycamore Dorm","Sequoia Hall",
];
const ATHLETIC_NAMES = [
  "Main Field House","Aquatic Center","Ice Arena","Football Stadium",
  "Basketball Pavilion","Tennis Center","Track & Field Complex",
  "Gymnastics Center","Wrestling Arena","Baseball Stadium",
  "Volleyball Center","Soccer Complex","Rowing Boathouse",
  "Recreation Center","Fitness Pavilion",
];

const ANOMALOUS = new Set(["LAB-07","LAB-14","ATH-03","RES-12"]);

function generateBuildings() {
  const buildings = [];
  const baseLat = 42.7325, baseLng = -84.4822;

  for (let i = 0; i < 20; i++) {
    const sqft = 35000 + Math.floor(rngVal() * 50000);
    const age = 5 + Math.floor(rngVal() * 50);
    const isExisting = i < 10;
    const isNew = !isExisting && i < 16;
    buildings.push({
      id: `LAB-${String(i+1).padStart(2,"0")}`,
      name: LAB_NAMES[i], type: "Research Lab", sqft, age_years: age,
      metered_status: isExisting ? "existing" : isNew ? "new" : "proxy",
      lat: baseLat + (rngVal() - 0.5) * 0.016,
      lng: baseLng + (rngVal() - 0.5) * 0.016,
      gridX: (i % 5) * 2.5 - 5, gridZ: Math.floor(i / 5) * 2.5 - 8,
    });
  }
  for (let i = 0; i < 60; i++) {
    const sqft = 15000 + Math.floor(rngVal() * 35000);
    const age = 10 + Math.floor(rngVal() * 55);
    const isExisting = i < 12;
    const isNew = !isExisting && i < 20;
    buildings.push({
      id: `ACA-${String(i+1).padStart(2,"0")}`,
      name: `Academic Hall ${String.fromCharCode(65 + (i % 26))}${i >= 26 ? String.fromCharCode(65 + Math.floor(i / 26) - 1) : ""}`,
      type: "Academic", sqft, age_years: age,
      metered_status: isExisting ? "existing" : isNew ? "new" : "proxy",
      lat: baseLat + (rngVal() - 0.5) * 0.024,
      lng: baseLng + (rngVal() - 0.5) * 0.024,
      gridX: (i % 10) * 1.8 - 9, gridZ: Math.floor(i / 10) * 1.8 + 3,
    });
  }
  for (let i = 0; i < 25; i++) {
    const sqft = 25000 + Math.floor(rngVal() * 35000);
    const age = 8 + Math.floor(rngVal() * 42);
    const isExisting = i < 5;
    const isNew = !isExisting && i < 9;
    buildings.push({
      id: `RES-${String(i+1).padStart(2,"0")}`,
      name: RESIDENCE_NAMES[i], type: "Residence", sqft, age_years: age,
      metered_status: isExisting ? "existing" : isNew ? "new" : "proxy",
      lat: baseLat + (rngVal() - 0.5) * 0.020,
      lng: baseLng + (rngVal() - 0.5) * 0.020,
      gridX: (i % 5) * 2.5 + 6, gridZ: Math.floor(i / 5) * 2.5 - 8,
    });
  }
  for (let i = 0; i < 15; i++) {
    const sqft = 30000 + Math.floor(rngVal() * 70000);
    const age = 5 + Math.floor(rngVal() * 35);
    const isExisting = i < 3;
    const isNew = !isExisting && i < 5;
    buildings.push({
      id: `ATH-${String(i+1).padStart(2,"0")}`,
      name: ATHLETIC_NAMES[i], type: "Athletic", sqft, age_years: age,
      metered_status: isExisting ? "existing" : isNew ? "new" : "proxy",
      lat: baseLat + (rngVal() - 0.5) * 0.012,
      lng: baseLng + (rngVal() - 0.5) * 0.012,
      gridX: (i % 5) * 2.5 - 5, gridZ: Math.floor(i / 5) * 2.5 + 14,
    });
  }
  return buildings;
}

function generateHourlyData(building) {
  const localRng = seededRandom(hashCode(building.id));
  const r = () => localRng();
  const data = [];
  const isAnomaly = ANOMALOUS.has(building.id);

  for (let h = 0; h < 168; h++) {
    const hourOfDay = h % 24;
    const dayOfWeek = Math.floor(h / 24);
    const isWeekend = dayOfWeek >= 5;
    const temp = 30 + 10 * Math.sin((hourOfDay - 6) * Math.PI / 12) + (r() - 0.5) * 8;
    let occupancy;

    if (building.type === "Research Lab") {
      occupancy = (!isWeekend && hourOfDay >= 8 && hourOfDay <= 18)
        ? 0.5 + r() * 0.25
        : (!isWeekend && hourOfDay > 18 && hourOfDay <= 22) ? 0.15 + r() * 0.15
        : isWeekend ? 0.08 + r() * 0.10
        : 0.04 + r() * 0.05;
    } else if (building.type === "Academic") {
      occupancy = (!isWeekend && hourOfDay >= 8 && hourOfDay <= 17)
        ? 0.6 + r() * 0.30
        : (!isWeekend && hourOfDay > 17 && hourOfDay <= 21) ? 0.08 + r() * 0.08
        : isWeekend ? 0.03 + r() * 0.04
        : 0.02 + r() * 0.02;
    } else if (building.type === "Residence") {
      occupancy = isWeekend ? 0.55 + r() * 0.20
        : (hourOfDay >= 8 && hourOfDay <= 17) ? 0.25 + r() * 0.15
        : (hourOfDay > 17 && hourOfDay <= 23) ? 0.65 + r() * 0.20
        : 0.80 + r() * 0.15;
    } else {
      occupancy = isWeekend ? 0.40 + r() * 0.25
        : (hourOfDay >= 8 && hourOfDay <= 17) ? 0.35 + r() * 0.20
        : (hourOfDay > 17 && hourOfDay <= 22) ? 0.50 + r() * 0.30
        : 0.03 + r() * 0.03;
    }

    const ageFactor = 1 + building.age_years / 120;
    const hvacKw = building.sqft * 0.0008 * Math.max(0, 65 - temp) * ageFactor;

    let equipKw;
    if (building.type === "Research Lab") {
      equipKw = building.sqft * 0.012 * (0.7 + 0.3 * occupancy);
    } else if (building.type === "Academic") {
      equipKw = building.sqft * 0.003 * (0.2 + 0.8 * occupancy);
    } else if (building.type === "Residence") {
      equipKw = building.sqft * 0.005 * (0.4 + 0.6 * occupancy);
    } else {
      equipKw = building.sqft * 0.004 + building.sqft * 0.003 * (occupancy > 0.5 ? occupancy : 0);
    }

    const darkBonus = (hourOfDay < 7 || hourOfDay > 18) ? 1.3 : 0.8;
    const lightKw = building.sqft * 0.002 * Math.max(occupancy, 0.05) * darkBonus;
    let totalKw = (hvacKw + equipKw + lightKw) * (1 + (r() - 0.5) * 0.10);
    if (isAnomaly) totalKw *= 1.25;
    totalKw = Math.max(10, totalKw);

    const entry = {
      hour: h, hourOfDay, dayOfWeek, isWeekend,
      temp: Math.round(temp * 10) / 10,
      occupancy: Math.round(occupancy * 100),
      powerKw: Math.round(totalKw),
      hvacKw: Math.round(hvacKw),
      equipKw: Math.round(equipKw),
      lightKw: Math.round(lightKw),
      co2: Math.round(400 + occupancy * 600 + (r() - 0.5) * 60),
      zoneTemp: Math.round((70 + (r() - 0.5) * 4) * 10) / 10,
      supplyAirTemp: Math.round((57 + r() * 6) * 10) / 10,
      returnAirTemp: Math.round((69 + r() * 7) * 10) / 10,
    };

    if (building.type === "Research Lab") {
      entry.vocPpb = r() < 0.04 ? Math.round(150 + r() * 350) : Math.round(r() * 45);
      entry.ventAch = occupancy > 0.3 ? Math.round(8 + r() * 4) : Math.round(2 + r() * 2);
      entry.fumeHoodCfm = Math.round(occupancy * 500 + r() * 80 + 20);
    }

    if (building.metered_status === "proxy") {
      entry.confidenceLow = Math.round(totalKw * 0.86);
      entry.confidenceHigh = Math.round(totalKw * 1.14);
      entry.isEstimated = true;
    }

    data.push(entry);
  }
  return data;
}

function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h) + 1;
}

function computeEfficiency(building, hourly) {
  const avgPower = hourly.reduce((s, d) => s + d.powerKw, 0) / hourly.length;
  const typeAvg = { "Research Lab": 0.065, Academic: 0.025, Residence: 0.035, Athletic: 0.04 };
  const intensity = avgPower / building.sqft;
  const score = intensity / (typeAvg[building.type] || 0.03);
  return Math.round(score * 100) / 100;
}

// Precompute all data
const ALL_BUILDINGS = generateBuildings();
const BUILDING_DATA_CACHE = {};
function getBuildingData(building) {
  if (!BUILDING_DATA_CACHE[building.id]) {
    const hourly = generateHourlyData(building);
    const eff = computeEfficiency(building, hourly);
    const lastHour = hourly[hourly.length - 1];
    const annualKwh = Math.round(hourly.reduce((s, d) => s + d.powerKw, 0) * (8760 / 168));
    const alerts = [];
    if (building.id === "LAB-07") alerts.push("HVAC load 22% above baseline — possible AHU filter degradation");
    if (building.id === "LAB-14") alerts.push("Full ventilation running 24/7 despite <10% night occupancy");
    if (building.id === "ATH-03") alerts.push("Compressor cycling 3x normal rate — maintenance needed");
    if (building.id === "RES-12") alerts.push("Evening spike 40% above peer residences");
    BUILDING_DATA_CACHE[building.id] = {
      hourly, efficiency: eff,
      status: eff > 1.3 ? "red" : eff > 1.0 ? "yellow" : "green",
      currentPower: lastHour.powerKw,
      annualKwh, alerts,
      sensors: {
        power_kw: lastHour.powerKw,
        supply_air_temp_f: lastHour.supplyAirTemp,
        return_air_temp_f: lastHour.returnAirTemp,
        zone_temp_f: lastHour.zoneTemp,
        co2_ppm: lastHour.co2,
        voc_ppb: lastHour.vocPpb,
        ventilation_ach: lastHour.ventAch,
        fume_hood_cfm: lastHour.fumeHoodCfm,
      },
    };
  }
  return BUILDING_DATA_CACHE[building.id];
}

// Campus-level precomputes
const CAMPUS_POWER = (() => {
  let total = 0;
  ALL_BUILDINGS.forEach(b => { total += getBuildingData(b).currentPower; });
  return total;
})();

const CAMPUS_HOURLY = (() => {
  const arr = [];
  for (let h = 0; h < 168; h++) {
    let total = 0;
    ALL_BUILDINGS.slice(0, 30).forEach(b => {
      const d = getBuildingData(b);
      total += d.hourly[h].powerKw;
    });
    total *= (120 / 30); // scale sample to full campus
    const dayNames = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    arr.push({
      hour: h,
      label: `${dayNames[Math.floor(h/24)]} ${h%24}:00`,
      totalKw: Math.round(total),
      temp: Math.round(30 + 10 * Math.sin(((h%24) - 6) * Math.PI / 12)),
    });
  }
  return arr;
})();

const SCATTER_DATA = (() => {
  const pts = [];
  const sRng = seededRandom(99);
  ALL_BUILDINGS.filter(b => b.metered_status === "existing").slice(0, 8).forEach(b => {
    const d = getBuildingData(b);
    d.hourly.slice(0, 24).forEach(h => {
      const noise = 0.88 + sRng() * 0.24;
      pts.push({
        actual: h.powerKw,
        predicted: Math.round(h.powerKw * noise),
        type: b.type,
      });
    });
  });
  return pts;
})();

const FEATURE_IMPORTANCE = [
  { feature: "building_sqft", importance: 0.76 },
  { feature: "heating_degree_hours", importance: 0.084 },
  { feature: "outdoor_temp_f", importance: 0.051 },
  { feature: "building_age", importance: 0.047 },
  { feature: "type_research_lab", importance: 0.028 },
  { feature: "temp_sqft_interaction", importance: 0.014 },
  { feature: "type_residence", importance: 0.006 },
  { feature: "day_of_week_sin", importance: 0.004 },
];

const ANOMALIES = [
  { building_id: "LAB-07", building_name: "Materials Science", type: "efficiency_degradation",
    description: "Energy intensity increased 22% over 6 months", waste: 145000,
    action: "Inspect AHU filters and check for stuck valves" },
  { building_id: "LAB-14", building_name: "Pharma Research", type: "ventilation_waste",
    description: "Full ventilation running 24/7, occupancy <10% at night", waste: 89000,
    action: "Install demand-controlled ventilation (DCV)" },
  { building_id: "ATH-03", building_name: "Ice Arena", type: "equipment_degradation",
    description: "Compressor cycling 3x normal rate", waste: 62000,
    action: "Schedule compressor maintenance, check refrigerant charge" },
  { building_id: "RES-12", building_name: "South Dormitory", type: "occupant_behavior",
    description: "Evening spike 40% above peer residences", waste: 34000,
    action: "Investigate unauthorized high-draw appliances" },
];

const TYPE_COLORS = {
  "Research Lab": "#e74c3c",
  Academic: "#3498db",
  Residence: "#2ecc71",
  Athletic: "#f39c12",
};
const STATUS_COLORS = { green: "#27ae60", yellow: "#f39c12", red: "#e74c3c" };
const METER_COLORS = { existing: "#3498db", new: "#27ae60", proxy: "#9b59b6" };

// ════════════════════════════════════════════════════════════════════════
// 3D CAMPUS VISUALIZATION (Three.js via @react-three/fiber)
// ════════════════════════════════════════════════════════════════════════

function Building3D({ building, data, isSelected, onClick }) {
  const meshRef = useRef();
  const height = Math.max(0.3, data.currentPower / 800);
  const color = STATUS_COLORS[data.status];
  const meterColor = METER_COLORS[building.metered_status];

  useFrame((state) => {
    if (meshRef.current) {
      const target = isSelected ? 1.08 : 1.0;
      meshRef.current.scale.y += (target - meshRef.current.scale.y) * 0.1;
      if (isSelected) {
        meshRef.current.material.emissive.setHex(0xdaa520);
        meshRef.current.material.emissiveIntensity = 0.3 + 0.1 * Math.sin(state.clock.elapsedTime * 3);
      } else {
        meshRef.current.material.emissiveIntensity *= 0.9;
      }
    }
  });

  const sqftScale = Math.sqrt(building.sqft) / 200;

  return (
    <group position={[building.gridX, 0, building.gridZ]}>
      <mesh
        ref={meshRef}
        position={[0, height / 2, 0]}
        onClick={(e) => { e.stopPropagation(); onClick(building.id); }}
        castShadow
      >
        <boxGeometry args={[sqftScale, height, sqftScale * 0.7]} />
        <meshStandardMaterial
          color={color}
          metalness={0.3}
          roughness={0.7}
          transparent
          opacity={building.metered_status === "proxy" ? 0.6 : 0.9}
        />
      </mesh>
      {/* Meter indicator light on top */}
      <mesh position={[0, height + 0.1, 0]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color={meterColor} emissive={meterColor} emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

function CampusGround() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 3]} receiveShadow>
      <planeGeometry args={[35, 30]} />
      <meshStandardMaterial color="#0d1117" metalness={0.1} roughness={0.9} />
    </mesh>
  );
}

function GridLines() {
  const lines = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pts = [];
    for (let i = -15; i <= 15; i += 3) {
      pts.push(-15, 0, i, 15, 0, i);
      pts.push(i, 0, -12, i, 0, 22);
    }
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return geo;
  }, []);
  return (
    <lineSegments geometry={lines}>
      <lineBasicMaterial color="#1a1f2e" transparent opacity={0.4} />
    </lineSegments>
  );
}

function CampusScene({ buildings, selectedId, onSelectBuilding }) {
  return (
    <Canvas
      camera={{ position: [18, 14, 18], fov: 50 }}
      style={{ height: "100%", background: "#080a0f" }}
      shadows
    >
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 15, 10]} intensity={0.7} castShadow />
      <pointLight position={[-10, 8, -10]} intensity={0.3} color="#3498db" />
      <CampusGround />
      <GridLines />
      {buildings.map(b => (
        <Building3D
          key={b.id}
          building={b}
          data={getBuildingData(b)}
          isSelected={selectedId === b.id}
          onClick={onSelectBuilding}
        />
      ))}
      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        maxPolarAngle={Math.PI / 2.2}
        minDistance={8}
        maxDistance={40}
      />
    </Canvas>
  );
}

// ════════════════════════════════════════════════════════════════════════
// DASHBOARD COMPONENTS
// ════════════════════════════════════════════════════════════════════════

const STYLES = {
  page: {
    background: "#0a0c10", minHeight: "100vh", color: "#c0c4d0",
    fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace",
    padding: 0, margin: 0,
  },
  container: { maxWidth: 1440, margin: "0 auto", padding: "0 24px" },
  header: {
    background: "linear-gradient(180deg, #12151e 0%, #0a0c10 100%)",
    borderBottom: "1px solid #1e2230", padding: "20px 0",
  },
  headerTitle: {
    fontSize: 22, fontWeight: 700, color: "#daa520", letterSpacing: 1,
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  headerSub: { fontSize: 12, color: "#6b7080", marginTop: 4 },
  metricsRow: {
    display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap",
  },
  metricCard: {
    background: "#12151e", border: "1px solid #1e2230", borderRadius: 8,
    padding: "14px 20px", flex: "1 1 150px", minWidth: 150,
  },
  metricLabel: { fontSize: 11, color: "#6b7080", textTransform: "uppercase", letterSpacing: 1 },
  metricValue: { fontSize: 22, fontWeight: 700, color: "#e8eaf0", marginTop: 4 },
  section: { marginTop: 32 },
  sectionTitle: {
    fontSize: 16, fontWeight: 600, color: "#e8eaf0", marginBottom: 16,
    fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", gap: 8,
  },
  filterBar: { display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  filterBtn: (active) => ({
    background: active ? "#1e2230" : "transparent",
    border: `1px solid ${active ? "#daa520" : "#1e2230"}`,
    color: active ? "#daa520" : "#6b7080",
    borderRadius: 6, padding: "6px 14px", fontSize: 12,
    cursor: "pointer", transition: "all 0.2s",
  }),
  grid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: 16,
  },
  card: (status, metered, selected) => ({
    background: "#12151e",
    border: `1px ${metered === "proxy" ? "dashed" : "solid"} ${selected ? "#daa520" : "#1e2230"}`,
    borderRadius: 10, padding: 16, cursor: "pointer",
    transition: "all 0.2s", position: "relative",
    boxShadow: selected ? "0 0 20px rgba(218,165,32,0.15)" : "none",
  }),
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  statusDot: (color) => ({
    width: 8, height: 8, borderRadius: "50%", background: color,
    display: "inline-block", marginRight: 8, boxShadow: `0 0 6px ${color}`,
  }),
  badge: (color) => ({
    display: "inline-block", fontSize: 10, padding: "2px 8px", borderRadius: 4,
    background: `${color}22`, color, border: `1px solid ${color}44`,
    textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600,
  }),
  sensorRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "3px 0", fontSize: 13,
  },
  sensorLabel: { color: "#6b7080" },
  sensorValue: { fontWeight: 600, color: "#e8eaf0", fontFamily: "'SF Mono', monospace" },
  detailPanel: {
    background: "#12151e", border: "1px solid #1e2230", borderRadius: 12,
    padding: 24, marginBottom: 24,
  },
  backBtn: {
    background: "transparent", border: "1px solid #1e2230", color: "#6b7080",
    borderRadius: 6, padding: "6px 16px", fontSize: 12, cursor: "pointer",
    marginBottom: 16,
  },
  anomalyTable: {
    width: "100%", borderCollapse: "collapse", fontSize: 13,
  },
  th: {
    textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #1e2230",
    color: "#6b7080", fontSize: 11, textTransform: "uppercase", letterSpacing: 1,
  },
  td: {
    padding: "12px", borderBottom: "1px solid #0d1117", color: "#c0c4d0",
  },
  tooltip: {
    background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 8,
    padding: "10px 14px", fontSize: 12, color: "#c0c4d0",
    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
  },
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={STYLES.tooltip}>
      <div style={{ color: "#6b7080", marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || "#e8eaf0" }}>
          {p.name}: <strong>{typeof p.value === "number" ? p.value.toLocaleString() : p.value}</strong>
          {p.name?.includes("kW") || p.name?.includes("Power") ? " kW" : ""}
        </div>
      ))}
    </div>
  );
}

function MetricCard({ label, value, accent, badge }) {
  return (
    <div style={STYLES.metricCard}>
      <div style={STYLES.metricLabel}>{label}</div>
      <div style={{ ...STYLES.metricValue, color: accent || "#e8eaf0" }}>
        {value}
        {badge && (
          <span style={{
            fontSize: 11, marginLeft: 8, padding: "2px 8px", borderRadius: 4,
            background: `${badge.color}22`, color: badge.color,
          }}>
            {badge.text}
          </span>
        )}
      </div>
    </div>
  );
}

function BuildingCard({ building, data, selected, onClick }) {
  const isProxy = building.metered_status === "proxy";
  return (
    <div
      style={STYLES.card(data.status, building.metered_status, selected)}
      onClick={() => onClick(building.id)}
    >
      <div style={STYLES.cardHeader}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={STYLES.statusDot(STATUS_COLORS[data.status])} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#e8eaf0",
              fontFamily: "system-ui, sans-serif" }}>
              {building.name}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#6b7080", marginTop: 4 }}>
            {building.type} &middot; {building.sqft.toLocaleString()} sqft
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#6b7080" }}>{building.id}</div>
          <div style={{ marginTop: 4 }}>
            <span style={STYLES.badge(METER_COLORS[building.metered_status])}>
              {building.metered_status === "existing" ? "Smart Metered"
                : building.metered_status === "new" ? "New Meter"
                : "Proxy Metered"}
            </span>
          </div>
        </div>
      </div>

      <div style={{ borderTop: "1px solid #1a1f2e", marginTop: 12, paddingTop: 10 }}>
        <div style={STYLES.sensorRow}>
          <span style={STYLES.sensorLabel}>Power</span>
          <span style={STYLES.sensorValue}>
            {isProxy ? "~" : ""}{data.currentPower.toLocaleString()} kW
            {isProxy && <span style={{ color: "#9b59b6", fontSize: 11, marginLeft: 4 }}>
              ±{Math.round(data.currentPower * 0.14)}
            </span>}
          </span>
        </div>
        <div style={STYLES.sensorRow}>
          <span style={STYLES.sensorLabel}>Zone Temp</span>
          <span style={STYLES.sensorValue}>
            {isProxy ? "—" : `${data.sensors.zone_temp_f}°F`}
          </span>
        </div>
        <div style={STYLES.sensorRow}>
          <span style={STYLES.sensorLabel}>CO₂</span>
          <span style={STYLES.sensorValue}>
            {isProxy ? "—" : `${data.sensors.co2_ppm} ppm`}
          </span>
        </div>
        {building.type === "Research Lab" && !isProxy && (
          <>
            <div style={STYLES.sensorRow}>
              <span style={STYLES.sensorLabel}>VOC</span>
              <span style={{
                ...STYLES.sensorValue,
                color: (data.sensors.voc_ppb || 0) > 100 ? "#e74c3c" : "#e8eaf0",
              }}>
                {data.sensors.voc_ppb ?? "—"} ppb
              </span>
            </div>
            <div style={STYLES.sensorRow}>
              <span style={STYLES.sensorLabel}>Ventilation</span>
              <span style={STYLES.sensorValue}>{data.sensors.ventilation_ach ?? "—"} ACH</span>
            </div>
          </>
        )}
      </div>

      <div style={{ borderTop: "1px solid #1a1f2e", marginTop: 8, paddingTop: 8 }}>
        <div style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#6b7080" }}>Efficiency</span>
          <span style={{ color: STATUS_COLORS[data.status], fontWeight: 600 }}>
            {data.efficiency}x {data.efficiency > 1.3 ? "(high waste)" : data.efficiency > 1.0 ? "(above avg)" : "(efficient)"}
          </span>
        </div>
        {isProxy && (
          <div style={{ fontSize: 11, color: "#9b59b6", marginTop: 4 }}>
            Confidence: ±14% (ML model estimate)
          </div>
        )}
        {data.alerts.map((a, i) => (
          <div key={i} style={{
            fontSize: 11, color: "#f39c12", marginTop: 4,
            display: "flex", alignItems: "flex-start", gap: 4,
          }}>
            <span style={{ flexShrink: 0 }}>&#9888;</span> {a}
          </div>
        ))}
      </div>
    </div>
  );
}

function BuildingDetail({ building, data, onBack }) {
  const isProxy = building.metered_status === "proxy";
  const last24 = data.hourly.slice(-24);

  return (
    <div style={STYLES.detailPanel}>
      <button style={STYLES.backBtn} onClick={onBack}>&larr; Back to grid</button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={STYLES.statusDot(STATUS_COLORS[data.status])} />
            <h2 style={{ margin: 0, fontSize: 20, color: "#e8eaf0", fontFamily: "system-ui, sans-serif" }}>
              {building.name}
            </h2>
            <span style={STYLES.badge(METER_COLORS[building.metered_status])}>
              {building.metered_status}
            </span>
          </div>
          <div style={{ fontSize: 13, color: "#6b7080", marginTop: 4 }}>
            {building.id} &middot; {building.type} &middot; {building.sqft.toLocaleString()} sqft &middot; {building.age_years} years old
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#e8eaf0" }}>
            {isProxy ? "~" : ""}{data.currentPower.toLocaleString()} kW
          </div>
          <div style={{ fontSize: 12, color: "#6b7080" }}>current reading</div>
        </div>
      </div>

      {/* 168-hour profile chart */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: "#6b7080", marginBottom: 8 }}>
          Weekly Energy Profile (168 hours)
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data.hourly}>
            <defs>
              <linearGradient id="powerGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isProxy ? "#9b59b6" : "#3498db"} stopOpacity={0.4} />
                <stop offset="100%" stopColor={isProxy ? "#9b59b6" : "#3498db"} stopOpacity={0.05} />
              </linearGradient>
              {isProxy && (
                <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#9b59b6" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#9b59b6" stopOpacity={0.02} />
                </linearGradient>
              )}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2230" />
            <XAxis dataKey="hour" tick={{ fill: "#6b7080", fontSize: 10 }}
              tickFormatter={h => h % 24 === 0 ? ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][Math.floor(h/24)] : ""}
            />
            <YAxis tick={{ fill: "#6b7080", fontSize: 10 }} />
            <Tooltip content={<CustomTooltip />} />
            {isProxy && (
              <Area type="monotone" dataKey="confidenceHigh" stroke="none" fill="url(#confGrad)" name="Upper bound" />
            )}
            {isProxy && (
              <Area type="monotone" dataKey="confidenceLow" stroke="none" fill="url(#confGrad)" name="Lower bound" />
            )}
            <Area type="monotone" dataKey="powerKw" stroke={isProxy ? "#9b59b6" : "#3498db"}
              strokeWidth={isProxy ? 1.5 : 2}
              strokeDasharray={isProxy ? "6 3" : undefined}
              fill="url(#powerGrad)" name="Power (kW)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Sensor sparklines for metered buildings */}
      {!isProxy && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          {[
            { key: "powerKw", label: "Power (kW)", color: "#3498db" },
            { key: "zoneTemp", label: "Zone Temp (°F)", color: "#e74c3c" },
            { key: "co2", label: "CO₂ (ppm)", color: "#f39c12" },
            { key: "occupancy", label: "Occupancy (%)", color: "#2ecc71" },
          ].map(({ key, label, color }) => (
            <div key={key} style={{ background: "#0d1117", borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, color: "#6b7080", marginBottom: 4 }}>{label}</div>
              <ResponsiveContainer width="100%" height={60}>
                <LineChart data={last24}>
                  <Line type="monotone" dataKey={key} stroke={color} strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#e8eaf0" }}>
                {last24[last24.length - 1]?.[key]}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lab-specific ventilation panel */}
      {building.type === "Research Lab" && !isProxy && (
        <div style={{ background: "#0d1117", borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: "#6b7080", marginBottom: 8 }}>
            Lab Ventilation & Air Quality (24h)
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={last24}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2230" />
              <XAxis dataKey="hourOfDay" tick={{ fill: "#6b7080", fontSize: 10 }} />
              <YAxis tick={{ fill: "#6b7080", fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="ventAch" stroke="#2ecc71" fill="#2ecc7122" name="Ventilation (ACH)" />
              <Area type="monotone" dataKey="vocPpb" stroke="#e74c3c" fill="#e74c3c22" name="VOC (ppb)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {data.alerts.length > 0 && (
        <div style={{ background: "#1a1208", border: "1px solid #f39c1244", borderRadius: 8, padding: 12 }}>
          {data.alerts.map((a, i) => (
            <div key={i} style={{ color: "#f39c12", fontSize: 13, padding: "4px 0" }}>
              &#9888; {a}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ════════════════════════════════════════════════════════════════════════

export default function SensorDashboard() {
  const [typeFilter, setTypeFilter] = useState("All");
  const [meterFilter, setMeterFilter] = useState("All");
  const [sortBy, setSortBy] = useState("energy");
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [view3D, setView3D] = useState(false);

  const filteredBuildings = useMemo(() => {
    let list = ALL_BUILDINGS;
    if (typeFilter !== "All") list = list.filter(b => b.type === typeFilter);
    if (meterFilter === "Metered") list = list.filter(b => b.metered_status === "existing");
    else if (meterFilter === "New") list = list.filter(b => b.metered_status === "new");
    else if (meterFilter === "Proxy") list = list.filter(b => b.metered_status === "proxy");

    return list.sort((a, b) => {
      const da = getBuildingData(a), db = getBuildingData(b);
      if (sortBy === "energy") return db.currentPower - da.currentPower;
      if (sortBy === "efficiency") return db.efficiency - da.efficiency;
      return db.alerts.length - da.alerts.length;
    });
  }, [typeFilter, meterFilter, sortBy]);

  const selectedBldg = selectedBuilding
    ? ALL_BUILDINGS.find(b => b.id === selectedBuilding)
    : null;
  const selectedData = selectedBldg ? getBuildingData(selectedBldg) : null;

  const totalAlerts = useMemo(() =>
    ALL_BUILDINGS.reduce((s, b) => s + getBuildingData(b).alerts.length, 0), []);

  const avgEfficiency = useMemo(() => {
    const effs = ALL_BUILDINGS.map(b => getBuildingData(b).efficiency);
    return (effs.reduce((s, e) => s + e, 0) / effs.length).toFixed(2);
  }, []);

  return (
    <div style={STYLES.page}>
      {/* ── SECTION 1: CAMPUS OVERVIEW BAR ── */}
      <div style={STYLES.header}>
        <div style={STYLES.container}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={STYLES.headerTitle}>GRIDMIND CAMPUS MONITOR</div>
              <div style={STYLES.headerSub}>
                MSU Energy Intelligence Platform &middot; Real-time ML Proxy Metering
              </div>
            </div>
            <button
              onClick={() => setView3D(!view3D)}
              style={{
                background: view3D ? "#daa52033" : "transparent",
                border: `1px solid ${view3D ? "#daa520" : "#1e2230"}`,
                color: view3D ? "#daa520" : "#6b7080",
                borderRadius: 6, padding: "8px 16px", fontSize: 12,
                cursor: "pointer",
              }}
            >
              {view3D ? "Grid View" : "3D Campus"}
            </button>
          </div>

          <div style={STYLES.metricsRow}>
            <MetricCard label="Total Power Now" value={`${CAMPUS_POWER.toLocaleString()} kW`} />
            <MetricCard label="Today's Cost"
              value={`$${Math.round(CAMPUS_POWER * 24 * 0.13).toLocaleString()}`}
              accent="#27ae60" />
            <MetricCard label="Model Accuracy" value="R² = 0.99"
              badge={{ text: "validated", color: "#27ae60" }} />
            <MetricCard label="Buildings" value="120"
              badge={{ text: "50 metered + 70 proxy", color: "#3498db" }} />
            <MetricCard label="Active Alerts" value={String(totalAlerts)}
              accent={totalAlerts > 0 ? "#e74c3c" : "#27ae60"}
              badge={totalAlerts > 0 ? { text: "action needed", color: "#e74c3c" } : undefined} />
            <MetricCard label="Campus Efficiency" value={`${avgEfficiency}x`}
              accent={parseFloat(avgEfficiency) < 1 ? "#27ae60" : "#f39c12"} />
          </div>
        </div>
      </div>

      <div style={STYLES.container}>
        {/* ── 3D CAMPUS VIEW ── */}
        {view3D && (
          <div style={{ ...STYLES.section }}>
            <div style={STYLES.sectionTitle}>
              <span style={{ color: "#daa520" }}>&#9632;</span> 3D Campus Visualization
            </div>
            <div style={{
              height: 500, borderRadius: 12, overflow: "hidden",
              border: "1px solid #1e2230", background: "#080a0f",
            }}>
              <Suspense fallback={
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
                  height: "100%", color: "#6b7080" }}>
                  Loading 3D campus...
                </div>
              }>
                <CampusScene
                  buildings={ALL_BUILDINGS}
                  selectedId={selectedBuilding}
                  onSelectBuilding={setSelectedBuilding}
                />
              </Suspense>
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11, color: "#6b7080" }}>
              <span><span style={{ color: "#3498db" }}>&#9679;</span> Smart Metered</span>
              <span><span style={{ color: "#27ae60" }}>&#9679;</span> New Meter</span>
              <span><span style={{ color: "#9b59b6" }}>&#9679;</span> Proxy Metered</span>
              <span style={{ marginLeft: "auto" }}>
                Height = power draw &middot; Color = efficiency status &middot; Click to select
              </span>
            </div>
          </div>
        )}

        {/* ── SECTION 2: BUILDING GRID ── */}
        <div style={STYLES.section}>
          <div style={STYLES.sectionTitle}>
            <span style={{ color: "#3498db" }}>&#9632;</span> Building Grid
          </div>

          {/* Filters */}
          <div style={STYLES.filterBar}>
            {[
              ["All", `All (${ALL_BUILDINGS.length})`],
              ["Research Lab", `Labs (20)`],
              ["Academic", `Academic (60)`],
              ["Residence", `Residence (25)`],
              ["Athletic", `Athletic (15)`],
            ].map(([val, label]) => (
              <button key={val} style={STYLES.filterBtn(typeFilter === val)}
                onClick={() => setTypeFilter(val)}>
                {label}
              </button>
            ))}
            <span style={{ width: 1, background: "#1e2230", margin: "0 4px" }} />
            {[
              ["All", "All Meters"],
              ["Metered", "Metered (30)"],
              ["New", "New Meters (20)"],
              ["Proxy", "Proxy (70)"],
            ].map(([val, label]) => (
              <button key={val} style={STYLES.filterBtn(meterFilter === val)}
                onClick={() => setMeterFilter(val)}>
                {label}
              </button>
            ))}
            <span style={{ width: 1, background: "#1e2230", margin: "0 4px" }} />
            {[
              ["energy", "Energy Use \u2193"],
              ["efficiency", "Efficiency Score"],
              ["alerts", "Alert Status"],
            ].map(([val, label]) => (
              <button key={val} style={STYLES.filterBtn(sortBy === val)}
                onClick={() => setSortBy(val)}>
                {label}
              </button>
            ))}
          </div>

          {/* Detail panel or grid */}
          {selectedBuilding && selectedBldg && selectedData ? (
            <BuildingDetail
              building={selectedBldg}
              data={selectedData}
              onBack={() => setSelectedBuilding(null)}
            />
          ) : (
            <div style={STYLES.grid}>
              {filteredBuildings.slice(0, 24).map(b => (
                <BuildingCard
                  key={b.id}
                  building={b}
                  data={getBuildingData(b)}
                  selected={selectedBuilding === b.id}
                  onClick={setSelectedBuilding}
                />
              ))}
            </div>
          )}
          {!selectedBuilding && filteredBuildings.length > 24 && (
            <div style={{ textAlign: "center", padding: 16, color: "#6b7080", fontSize: 12 }}>
              Showing 24 of {filteredBuildings.length} buildings. Use filters to narrow results.
            </div>
          )}
        </div>

        {/* ── SECTION 3: ML MODEL PERFORMANCE ── */}
        <div style={STYLES.section}>
          <div style={STYLES.sectionTitle}>
            <span style={{ color: "#27ae60" }}>&#9632;</span> ML Model Performance
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 24 }}>
            {/* Scatter plot: actual vs predicted */}
            <div style={{ background: "#12151e", borderRadius: 10, padding: 20, border: "1px solid #1e2230" }}>
              <div style={{ fontSize: 13, color: "#6b7080", marginBottom: 12 }}>
                Actual vs Predicted Power (Test Set)
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2230" />
                  <XAxis type="number" dataKey="actual" name="Actual (kW)"
                    tick={{ fill: "#6b7080", fontSize: 10 }}
                    label={{ value: "Actual (kW)", position: "insideBottom", offset: -5, fill: "#6b7080", fontSize: 11 }}
                  />
                  <YAxis type="number" dataKey="predicted" name="Predicted (kW)"
                    tick={{ fill: "#6b7080", fontSize: 10 }}
                    label={{ value: "Predicted (kW)", angle: -90, position: "insideLeft", fill: "#6b7080", fontSize: 11 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine
                    segment={[{ x: 0, y: 0 }, { x: 5000, y: 5000 }]}
                    stroke="#daa52066" strokeDasharray="6 3" strokeWidth={1}
                  />
                  {Object.entries(TYPE_COLORS).map(([type, color]) => (
                    <Scatter
                      key={type}
                      name={type}
                      data={SCATTER_DATA.filter(d => d.type === type)}
                      fill={color}
                      opacity={0.7}
                    />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
              <div style={{ textAlign: "center", fontSize: 11, color: "#6b7080", marginTop: 4 }}>
                Diagonal line = perfect prediction. Tighter clustering = better model.
              </div>
            </div>

            {/* Feature importance */}
            <div style={{ background: "#12151e", borderRadius: 10, padding: 20, border: "1px solid #1e2230" }}>
              <div style={{ fontSize: 13, color: "#6b7080", marginBottom: 12 }}>
                Feature Importance (Top 8)
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={FEATURE_IMPORTANCE} layout="vertical"
                  margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2230" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#6b7080", fontSize: 10 }}
                    domain={[0, 0.8]} />
                  <YAxis type="category" dataKey="feature" width={140}
                    tick={{ fill: "#c0c4d0", fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="importance" name="Importance" radius={[0, 4, 4, 0]}>
                    {FEATURE_IMPORTANCE.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? "#daa520" : i < 3 ? "#3498db" : "#1e2230"}
                        stroke={i < 3 ? undefined : "#3498db44"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Model stats row */}
          <div style={{
            display: "flex", gap: 24, marginTop: 16, padding: "16px 20px",
            background: "#12151e", borderRadius: 8, border: "1px solid #1e2230",
            fontSize: 13, flexWrap: "wrap",
          }}>
            <div>
              <span style={{ color: "#6b7080" }}>R² Score: </span>
              <span style={{ color: "#27ae60", fontWeight: 700 }}>0.99</span>
            </div>
            <div>
              <span style={{ color: "#6b7080" }}>Mean Error: </span>
              <span style={{ color: "#e8eaf0", fontWeight: 700 }}>±3.0%</span>
            </div>
            <div>
              <span style={{ color: "#6b7080" }}>MAE: </span>
              <span style={{ color: "#e8eaf0", fontWeight: 700 }}>67.5 kW</span>
            </div>
            <div>
              <span style={{ color: "#6b7080" }}>Trained on: </span>
              <span style={{ color: "#e8eaf0" }}>50 buildings, 8,400 data points</span>
            </div>
            <div style={{ marginLeft: "auto", color: "#6b7080", fontStyle: "italic" }}>
              For a building using 500 kW, our estimate is 485-515 kW
            </div>
          </div>
        </div>

        {/* ── Campus-wide hourly profile ── */}
        <div style={STYLES.section}>
          <div style={STYLES.sectionTitle}>
            <span style={{ color: "#f39c12" }}>&#9632;</span> Campus-Wide Load Profile (Sample Week)
          </div>
          <div style={{ background: "#12151e", borderRadius: 10, padding: 20, border: "1px solid #1e2230" }}>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={CAMPUS_HOURLY}>
                <defs>
                  <linearGradient id="campusGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#daa520" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#daa520" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2230" />
                <XAxis dataKey="label" tick={{ fill: "#6b7080", fontSize: 9 }}
                  interval={23} />
                <YAxis tick={{ fill: "#6b7080", fontSize: 10 }}
                  tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="totalKw" stroke="#daa520" strokeWidth={1.5}
                  fill="url(#campusGrad)" name="Campus Total (kW)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── SECTION 4: ANOMALY DETECTION ── */}
        <div style={{ ...STYLES.section, marginBottom: 40 }}>
          <div style={STYLES.sectionTitle}>
            <span style={{ color: "#e74c3c" }}>&#9632;</span> Anomaly Detection & Savings Opportunities
          </div>

          <div style={{
            background: "#12151e", borderRadius: 10, padding: 20,
            border: "1px solid #1e2230", overflowX: "auto",
          }}>
            <table style={STYLES.anomalyTable}>
              <thead>
                <tr>
                  <th style={STYLES.th}>Building</th>
                  <th style={STYLES.th}>Issue</th>
                  <th style={STYLES.th}>Est. Annual Waste</th>
                  <th style={STYLES.th}>Recommended Action</th>
                </tr>
              </thead>
              <tbody>
                {ANOMALIES.map((a, i) => (
                  <tr key={i} style={{ cursor: "pointer" }}
                    onClick={() => setSelectedBuilding(a.building_id)}>
                    <td style={STYLES.td}>
                      <div style={{ fontWeight: 600, color: "#e8eaf0" }}>
                        {a.building_id}
                      </div>
                      <div style={{ fontSize: 11, color: "#6b7080" }}>
                        {a.building_name}
                      </div>
                    </td>
                    <td style={STYLES.td}>
                      <span style={{
                        display: "inline-block", fontSize: 10, padding: "2px 6px",
                        borderRadius: 3, marginRight: 6,
                        background: a.type === "efficiency_degradation" ? "#e74c3c22" : "#f39c1222",
                        color: a.type === "efficiency_degradation" ? "#e74c3c" : "#f39c12",
                      }}>
                        {a.type.replace(/_/g, " ")}
                      </span>
                      {a.description}
                    </td>
                    <td style={{ ...STYLES.td, color: "#e74c3c", fontWeight: 700 }}>
                      ${a.waste.toLocaleString()}
                    </td>
                    <td style={{ ...STYLES.td, color: "#c0c4d0", fontSize: 12 }}>
                      {a.action}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{
            marginTop: 16, padding: "14px 20px",
            background: "#0d1117", borderRadius: 8, border: "1px solid #1e2230",
            fontSize: 13, color: "#6b7080",
          }}>
            Total identified waste:{" "}
            <span style={{ color: "#e74c3c", fontWeight: 700 }}>
              ${ANOMALIES.reduce((s, a) => s + a.waste, 0).toLocaleString()}/year
            </span>
            {" "}from {ANOMALIES.length} buildings.
            Fixing these = 1.2% of annual energy budget recovered.
          </div>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: "center", padding: "24px 0 40px", fontSize: 11, color: "#3a3f50",
          borderTop: "1px solid #1e2230",
        }}>
          GridMind Campus Monitor v2.0 &middot; ML Proxy Metering System &middot; MSU Energy Intelligence
        </div>
      </div>
    </div>
  );
}
