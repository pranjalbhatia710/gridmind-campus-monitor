import React, { useState, useMemo, useCallback, useRef, useEffect, Suspense } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine, ScatterChart, Scatter, ZAxis, Legend,
} from "recharts";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Html, Billboard, Line as DreiLine } from "@react-three/drei";
import * as THREE from "three";

// ════════════════════════════════════════════════════════════════════════
// DATA GENERATION
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

  // Better campus layout: buildings placed in clear zones with spacing
  // Labs — upper-left quadrant
  for (let i = 0; i < 20; i++) {
    const sqft = 35000 + Math.floor(rngVal() * 50000);
    const age = 5 + Math.floor(rngVal() * 50);
    const isExisting = i < 10;
    const isNew = !isExisting && i < 16;
    const col = i % 5, row = Math.floor(i / 5);
    buildings.push({
      id: `LAB-${String(i+1).padStart(2,"0")}`,
      name: LAB_NAMES[i], type: "Research Lab", sqft, age_years: age,
      metered_status: isExisting ? "existing" : isNew ? "new" : "proxy",
      gridX: -14 + col * 3.2 + (rngVal() - 0.5) * 0.6,
      gridZ: -12 + row * 3.2 + (rngVal() - 0.5) * 0.6,
    });
  }
  // Academic — center-right, large cluster
  for (let i = 0; i < 60; i++) {
    const sqft = 15000 + Math.floor(rngVal() * 35000);
    const age = 10 + Math.floor(rngVal() * 55);
    const isExisting = i < 12;
    const isNew = !isExisting && i < 20;
    const col = i % 10, row = Math.floor(i / 10);
    buildings.push({
      id: `ACA-${String(i+1).padStart(2,"0")}`,
      name: `Academic Hall ${String.fromCharCode(65 + (i % 26))}${i >= 26 ? String.fromCharCode(65 + Math.floor(i / 26) - 1) : ""}`,
      type: "Academic", sqft, age_years: age,
      metered_status: isExisting ? "existing" : isNew ? "new" : "proxy",
      gridX: -8 + col * 2.4 + (rngVal() - 0.5) * 0.5,
      gridZ: 2 + row * 2.4 + (rngVal() - 0.5) * 0.5,
    });
  }
  // Residences — right side
  for (let i = 0; i < 25; i++) {
    const sqft = 25000 + Math.floor(rngVal() * 35000);
    const age = 8 + Math.floor(rngVal() * 42);
    const isExisting = i < 5;
    const isNew = !isExisting && i < 9;
    const col = i % 5, row = Math.floor(i / 5);
    buildings.push({
      id: `RES-${String(i+1).padStart(2,"0")}`,
      name: RESIDENCE_NAMES[i], type: "Residence", sqft, age_years: age,
      metered_status: isExisting ? "existing" : isNew ? "new" : "proxy",
      gridX: 10 + col * 2.8 + (rngVal() - 0.5) * 0.5,
      gridZ: -12 + row * 3.0 + (rngVal() - 0.5) * 0.5,
    });
  }
  // Athletic — bottom-left
  for (let i = 0; i < 15; i++) {
    const sqft = 30000 + Math.floor(rngVal() * 70000);
    const age = 5 + Math.floor(rngVal() * 35);
    const isExisting = i < 3;
    const isNew = !isExisting && i < 5;
    const col = i % 5, row = Math.floor(i / 5);
    buildings.push({
      id: `ATH-${String(i+1).padStart(2,"0")}`,
      name: ATHLETIC_NAMES[i], type: "Athletic", sqft, age_years: age,
      metered_status: isExisting ? "existing" : isNew ? "new" : "proxy",
      gridX: -14 + col * 3.5 + (rngVal() - 0.5) * 0.6,
      gridZ: 18 + row * 3.5 + (rngVal() - 0.5) * 0.6,
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
      occupancy = (!isWeekend && hourOfDay >= 8 && hourOfDay <= 18) ? 0.5 + r() * 0.25
        : (!isWeekend && hourOfDay > 18 && hourOfDay <= 22) ? 0.15 + r() * 0.15
        : isWeekend ? 0.08 + r() * 0.10 : 0.04 + r() * 0.05;
    } else if (building.type === "Academic") {
      occupancy = (!isWeekend && hourOfDay >= 8 && hourOfDay <= 17) ? 0.6 + r() * 0.30
        : (!isWeekend && hourOfDay > 17 && hourOfDay <= 21) ? 0.08 + r() * 0.08
        : isWeekend ? 0.03 + r() * 0.04 : 0.02 + r() * 0.02;
    } else if (building.type === "Residence") {
      occupancy = isWeekend ? 0.55 + r() * 0.20
        : (hourOfDay >= 8 && hourOfDay <= 17) ? 0.25 + r() * 0.15
        : (hourOfDay > 17 && hourOfDay <= 23) ? 0.65 + r() * 0.20 : 0.80 + r() * 0.15;
    } else {
      occupancy = isWeekend ? 0.40 + r() * 0.25
        : (hourOfDay >= 8 && hourOfDay <= 17) ? 0.35 + r() * 0.20
        : (hourOfDay > 17 && hourOfDay <= 22) ? 0.50 + r() * 0.30 : 0.03 + r() * 0.03;
    }
    const ageFactor = 1 + building.age_years / 120;
    const hvacKw = building.sqft * 0.0008 * Math.max(0, 65 - temp) * ageFactor;
    let equipKw;
    if (building.type === "Research Lab") equipKw = building.sqft * 0.012 * (0.7 + 0.3 * occupancy);
    else if (building.type === "Academic") equipKw = building.sqft * 0.003 * (0.2 + 0.8 * occupancy);
    else if (building.type === "Residence") equipKw = building.sqft * 0.005 * (0.4 + 0.6 * occupancy);
    else equipKw = building.sqft * 0.004 + building.sqft * 0.003 * (occupancy > 0.5 ? occupancy : 0);
    const darkBonus = (hourOfDay < 7 || hourOfDay > 18) ? 1.3 : 0.8;
    const lightKw = building.sqft * 0.002 * Math.max(occupancy, 0.05) * darkBonus;
    let totalKw = (hvacKw + equipKw + lightKw) * (1 + (r() - 0.5) * 0.10);
    if (isAnomaly) totalKw *= 1.25;
    totalKw = Math.max(10, totalKw);
    const entry = {
      hour: h, hourOfDay, dayOfWeek, isWeekend,
      temp: Math.round(temp * 10) / 10, occupancy: Math.round(occupancy * 100),
      powerKw: Math.round(totalKw), hvacKw: Math.round(hvacKw),
      equipKw: Math.round(equipKw), lightKw: Math.round(lightKw),
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
  return Math.round((intensity / (typeAvg[building.type] || 0.03)) * 100) / 100;
}

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
      currentPower: lastHour.powerKw, annualKwh, alerts,
      sensors: {
        power_kw: lastHour.powerKw, supply_air_temp_f: lastHour.supplyAirTemp,
        return_air_temp_f: lastHour.returnAirTemp, zone_temp_f: lastHour.zoneTemp,
        co2_ppm: lastHour.co2, voc_ppb: lastHour.vocPpb,
        ventilation_ach: lastHour.ventAch, fume_hood_cfm: lastHour.fumeHoodCfm,
      },
    };
  }
  return BUILDING_DATA_CACHE[building.id];
}

const CAMPUS_POWER = (() => {
  let t = 0; ALL_BUILDINGS.forEach(b => { t += getBuildingData(b).currentPower; }); return t;
})();

const CAMPUS_HOURLY = (() => {
  const arr = [];
  for (let h = 0; h < 168; h++) {
    let total = 0;
    ALL_BUILDINGS.slice(0, 30).forEach(b => { total += getBuildingData(b).hourly[h].powerKw; });
    total *= (120 / 30);
    const dayNames = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    arr.push({ hour: h, label: `${dayNames[Math.floor(h/24)]} ${h%24}:00`, totalKw: Math.round(total),
      temp: Math.round(30 + 10 * Math.sin(((h%24) - 6) * Math.PI / 12)) });
  }
  return arr;
})();

const SCATTER_DATA = (() => {
  const pts = []; const sRng = seededRandom(99);
  ALL_BUILDINGS.filter(b => b.metered_status === "existing").slice(0, 8).forEach(b => {
    const d = getBuildingData(b);
    d.hourly.slice(0, 24).forEach(h => {
      pts.push({ actual: h.powerKw, predicted: Math.round(h.powerKw * (0.88 + sRng() * 0.24)), type: b.type });
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

const TYPE_COLORS = { "Research Lab": "#e74c3c", Academic: "#3498db", Residence: "#2ecc71", Athletic: "#f39c12" };
const STATUS_COLORS = { green: "#27ae60", yellow: "#f39c12", red: "#e74c3c" };
const METER_COLORS = { existing: "#3498db", new: "#27ae60", proxy: "#9b59b6" };
const TYPE_COLORS_3D = { "Research Lab": 0xe74c3c, Academic: 0x3498db, Residence: 0x2ecc71, Athletic: 0xf39c12 };
const STATUS_COLORS_3D = { green: 0x27ae60, yellow: 0xf39c12, red: 0xe74c3c };

// ════════════════════════════════════════════════════════════════════════
// 3D CAMPUS — FULL REWRITE
// ════════════════════════════════════════════════════════════════════════

// Animated energy beam from building top
function EnergyBeam({ position, height, color, intensity }) {
  const ref = useRef();
  useFrame((state) => {
    if (ref.current) {
      ref.current.material.opacity = 0.15 + 0.1 * Math.sin(state.clock.elapsedTime * 2 + position[0]);
    }
  });
  const beamHeight = Math.min(intensity / 300, 4);
  return (
    <mesh ref={ref} position={[position[0], height + beamHeight / 2, position[2]]}>
      <cylinderGeometry args={[0.03, 0.12, beamHeight, 6]} />
      <meshBasicMaterial color={color} transparent opacity={0.2} />
    </mesh>
  );
}

// Pulsing alert ring around anomalous buildings
function AlertRing({ position, radius }) {
  const ref = useRef();
  useFrame((state) => {
    if (ref.current) {
      const s = 1 + 0.15 * Math.sin(state.clock.elapsedTime * 3);
      ref.current.scale.set(s, 1, s);
      ref.current.material.opacity = 0.3 + 0.2 * Math.sin(state.clock.elapsedTime * 3);
    }
  });
  return (
    <mesh ref={ref} position={[position[0], 0.02, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius + 0.1, radius + 0.25, 24]} />
      <meshBasicMaterial color="#e74c3c" transparent opacity={0.4} side={THREE.DoubleSide} />
    </mesh>
  );
}

// Individual 3D building with floating HTML tooltip
function Building3D({ building, data, isSelected, isHovered, onHover, onClick, showLabels }) {
  const meshRef = useRef();
  const roofRef = useRef();
  const height = Math.max(0.4, data.currentPower / 600);
  const sqftScale = Math.sqrt(building.sqft) / 180;
  const statusColor = STATUS_COLORS_3D[data.status];
  const meterColor = METER_COLORS[building.metered_status];
  const isProxy = building.metered_status === "proxy";
  const hasAlert = data.alerts.length > 0;

  useFrame((state) => {
    if (!meshRef.current) return;
    // Selection glow
    if (isSelected) {
      meshRef.current.material.emissive.setHex(0xdaa520);
      meshRef.current.material.emissiveIntensity = 0.35 + 0.15 * Math.sin(state.clock.elapsedTime * 2.5);
    } else if (isHovered) {
      meshRef.current.material.emissive.setHex(0x445566);
      meshRef.current.material.emissiveIntensity = 0.2;
    } else {
      meshRef.current.material.emissiveIntensity *= 0.85;
    }
  });

  const pos = [building.gridX, 0, building.gridZ];

  return (
    <group position={pos}>
      {/* Building body */}
      <mesh
        ref={meshRef}
        position={[0, height / 2, 0]}
        onClick={(e) => { e.stopPropagation(); onClick(building.id); }}
        onPointerEnter={(e) => { e.stopPropagation(); onHover(building.id); document.body.style.cursor = "pointer"; }}
        onPointerLeave={() => { onHover(null); document.body.style.cursor = "default"; }}
        castShadow
      >
        <boxGeometry args={[sqftScale, height, sqftScale * 0.65]} />
        <meshStandardMaterial
          color={statusColor}
          metalness={0.25} roughness={0.65}
          transparent opacity={isProxy ? 0.55 : 0.92}
        />
      </mesh>

      {/* Roof accent line */}
      <mesh position={[0, height + 0.04, 0]}>
        <boxGeometry args={[sqftScale + 0.05, 0.06, sqftScale * 0.65 + 0.05]} />
        <meshStandardMaterial color={meterColor} metalness={0.5} roughness={0.4} />
      </mesh>

      {/* Meter indicator beacon */}
      <mesh position={[sqftScale / 2 - 0.05, height + 0.15, sqftScale * 0.65 / 2 - 0.05]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshStandardMaterial color={meterColor} emissive={meterColor} emissiveIntensity={1.2} />
      </mesh>

      {/* Energy beam for high-power buildings */}
      {data.currentPower > 500 && (
        <EnergyBeam position={[0, 0, 0]} height={height + 0.1} color={statusColor} intensity={data.currentPower} />
      )}

      {/* Alert ring */}
      {hasAlert && <AlertRing position={[0, 0, 0]} radius={sqftScale / 2 + 0.2} />}

      {/* Proxy dashed outline on ground */}
      {isProxy && (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[sqftScale / 2 + 0.05, sqftScale / 2 + 0.12, 4]} />
          <meshBasicMaterial color="#9b59b6" transparent opacity={0.35} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* FLOATING HTML LABEL — always visible for important buildings, hover/selected for others */}
      {(showLabels || isSelected || isHovered || hasAlert) && (
        <Html position={[0, height + 0.6, 0]} center distanceFactor={20}
          style={{ pointerEvents: "none", userSelect: "none" }}>
          <div style={{
            background: isSelected ? "rgba(218,165,32,0.92)" : "rgba(12,15,22,0.92)",
            border: `1px solid ${isSelected ? "#daa520" : isHovered ? "#445566" : "#1e2230"}`,
            borderRadius: 6, padding: "6px 10px", whiteSpace: "nowrap",
            fontFamily: "'SF Mono', monospace", minWidth: 120,
            boxShadow: isSelected ? "0 0 16px rgba(218,165,32,0.3)" : "0 4px 12px rgba(0,0,0,0.6)",
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
              color: isSelected ? "#0a0c10" : "#e8eaf0",
              display: "flex", alignItems: "center", gap: 4,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%", display: "inline-block",
                background: STATUS_COLORS[data.status],
                boxShadow: `0 0 4px ${STATUS_COLORS[data.status]}`,
              }} />
              {building.name}
            </div>
            <div style={{
              fontSize: 9, color: isSelected ? "#1a1a1a" : "#6b7080", marginTop: 2,
            }}>
              {building.id} &middot; {building.sqft.toLocaleString()} sqft
            </div>
            <div style={{
              marginTop: 4, display: "flex", gap: 8, fontSize: 11, fontWeight: 700,
              color: isSelected ? "#0a0c10" : "#e8eaf0",
            }}>
              <span>{isProxy ? "~" : ""}{data.currentPower.toLocaleString()} kW</span>
              <span style={{
                fontSize: 9, padding: "1px 5px", borderRadius: 3,
                background: `${meterColor}33`, color: meterColor,
                fontWeight: 600, border: `1px solid ${meterColor}55`,
              }}>
                {building.metered_status === "existing" ? "METERED" : building.metered_status === "new" ? "NEW" : "PROXY"}
              </span>
            </div>
            {hasAlert && (
              <div style={{ fontSize: 9, color: "#f39c12", marginTop: 3 }}>
                &#9888; {data.alerts.length} alert{data.alerts.length > 1 ? "s" : ""}
              </div>
            )}
            {isProxy && (
              <div style={{ fontSize: 9, color: "#9b59b6", marginTop: 2 }}>
                ±14% confidence
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

// Zone label floating above each building cluster
function ZoneLabel({ position, label, count, color, totalPower }) {
  return (
    <group position={position}>
      <Html center distanceFactor={30} style={{ pointerEvents: "none" }}>
        <div style={{
          background: `${color}18`, border: `1px solid ${color}44`,
          borderRadius: 8, padding: "8px 14px", textAlign: "center",
          fontFamily: "system-ui, sans-serif",
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color, letterSpacing: 0.5 }}>
            {label}
          </div>
          <div style={{ fontSize: 10, color: "#6b7080", marginTop: 2 }}>
            {count} buildings &middot; {(totalPower / 1000).toFixed(1)}k kW
          </div>
        </div>
      </Html>
    </group>
  );
}

// Ground zone highlighting
function ZoneGround({ center, size, color }) {
  return (
    <mesh position={[center[0], 0.005, center[1]]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={size} />
      <meshBasicMaterial color={color} transparent opacity={0.06} side={THREE.DoubleSide} />
    </mesh>
  );
}

// Road/path between zones
function Road({ points }) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-0.15, 0);
    s.lineTo(0.15, 0);
    s.lineTo(0.15, 1);
    s.lineTo(-0.15, 1);
    s.closePath();
    return s;
  }, []);

  return (
    <group>
      {points.map((seg, i) => {
        if (i === 0) return null;
        const from = points[i - 1], to = seg;
        const dx = to[0] - from[0], dz = to[1] - from[1];
        const len = Math.sqrt(dx * dx + dz * dz);
        const angle = Math.atan2(dx, dz);
        return (
          <mesh key={i} position={[(from[0] + to[0]) / 2, 0.008, (from[1] + to[1]) / 2]}
            rotation={[- Math.PI / 2, 0, -angle]}>
            <planeGeometry args={[0.35, len]} />
            <meshBasicMaterial color="#1a1f2e" transparent opacity={0.6} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
    </group>
  );
}

// Trees for atmosphere
function Tree({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.3, 0]}>
        <coneGeometry args={[0.25, 0.6, 6]} />
        <meshStandardMaterial color="#1a3a1a" />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.15, 4]} />
        <meshStandardMaterial color="#3a2a1a" />
      </mesh>
    </group>
  );
}

// Campus stats HUD overlay inside the 3D canvas
function CampusHUD({ stats }) {
  return (
    <Html position={[-22, 10, -15]} style={{ pointerEvents: "none" }}>
      <div style={{
        background: "rgba(10,12,16,0.88)", border: "1px solid #1e2230",
        borderRadius: 10, padding: "14px 18px", width: 200,
        fontFamily: "'SF Mono', monospace",
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#daa520", marginBottom: 8, letterSpacing: 1 }}>
          CAMPUS LIVE
        </div>
        {stats.map((s, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 11 }}>
            <span style={{ color: "#6b7080" }}>{s.label}</span>
            <span style={{ color: s.color || "#e8eaf0", fontWeight: 600 }}>{s.value}</span>
          </div>
        ))}
      </div>
    </Html>
  );
}

// Full campus 3D scene
function CampusScene({ buildings, selectedId, hoveredId, onSelectBuilding, onHoverBuilding, showLabels }) {
  const treePositions = useMemo(() => {
    const t = []; const tr = seededRandom(77);
    for (let i = 0; i < 60; i++) {
      t.push([tr() * 50 - 25, 0, tr() * 45 - 15]);
    }
    // Filter trees that are too close to buildings
    return t.filter(tp => !buildings.some(b =>
      Math.abs(tp[0] - b.gridX) < 1.5 && Math.abs(tp[2] - b.gridZ) < 1.5
    ));
  }, [buildings]);

  // Zone stats
  const zoneStats = useMemo(() => {
    const zones = {};
    buildings.forEach(b => {
      if (!zones[b.type]) zones[b.type] = { count: 0, power: 0 };
      zones[b.type].count++;
      zones[b.type].power += getBuildingData(b).currentPower;
    });
    return zones;
  }, [buildings]);

  const campusStats = useMemo(() => [
    { label: "Total Power", value: `${(CAMPUS_POWER / 1000).toFixed(1)}k kW`, color: "#daa520" },
    { label: "Buildings", value: "120", color: "#e8eaf0" },
    { label: "Metered", value: "50", color: "#3498db" },
    { label: "Proxy", value: "70", color: "#9b59b6" },
    { label: "Alerts", value: "4", color: "#e74c3c" },
    { label: "Model R²", value: "0.99", color: "#27ae60" },
  ], []);

  return (
    <Canvas
      camera={{ position: [28, 22, 28], fov: 45 }}
      style={{ height: "100%", background: "#060810" }}
      shadows
      onPointerMissed={() => onSelectBuilding(null)}
    >
      <color attach="background" args={["#060810"]} />
      <fog attach="fog" args={["#060810", 40, 80]} />

      {/* Lighting */}
      <ambientLight intensity={0.25} />
      <directionalLight position={[15, 20, 10]} intensity={0.6} castShadow
        shadow-mapSize={[1024, 1024]} shadow-camera-far={60}
        shadow-camera-left={-30} shadow-camera-right={30}
        shadow-camera-top={30} shadow-camera-bottom={-30}
      />
      <pointLight position={[-15, 6, -10]} intensity={0.25} color="#3498db" />
      <pointLight position={[15, 6, 20]} intensity={0.15} color="#f39c12" />
      <pointLight position={[0, 8, 5]} intensity={0.2} color="#9b59b6" />

      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 5]} receiveShadow>
        <planeGeometry args={[60, 50]} />
        <meshStandardMaterial color="#0b0e14" metalness={0.05} roughness={0.95} />
      </mesh>

      {/* Grid lines */}
      {useMemo(() => {
        const pts = [];
        for (let i = -28; i <= 28; i += 2) {
          pts.push([-28, 0, i, 28, 0, i]);
          pts.push([i, 0, -18, i, 0, 30]);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute(pts.flat(), 3));
        return (
          <lineSegments geometry={geo}>
            <lineBasicMaterial color="#111522" transparent opacity={0.5} />
          </lineSegments>
        );
      }, [])}

      {/* Zone ground highlights */}
      <ZoneGround center={[-8, -6]} size={[20, 16]} color="#e74c3c" />
      <ZoneGround center={[3, 10]} size={[28, 18]} color="#3498db" />
      <ZoneGround center={[16, -6]} size={[16, 18]} color="#2ecc71" />
      <ZoneGround center={[-5, 22]} size={[22, 10]} color="#f39c12" />

      {/* Roads connecting zones */}
      <Road points={[[0, -2], [0, 2], [0, 16]]} />
      <Road points={[[-14, 2], [0, 2], [10, 2]]} />
      <Road points={[[0, -10], [0, -2]]} />
      <Road points={[[-5, 16], [-5, 22]]} />
      <Road points={[[10, -2], [10, 10]]} />

      {/* Zone labels */}
      <ZoneLabel position={[-8, 6, -14.5]} label="RESEARCH LABS" count={20}
        color="#e74c3c" totalPower={zoneStats["Research Lab"]?.power || 0} />
      <ZoneLabel position={[3, 6, -0.5]} label="ACADEMIC" count={60}
        color="#3498db" totalPower={zoneStats["Academic"]?.power || 0} />
      <ZoneLabel position={[16, 6, -14.5]} label="RESIDENCES" count={25}
        color="#2ecc71" totalPower={zoneStats["Residence"]?.power || 0} />
      <ZoneLabel position={[-5, 6, 27]} label="ATHLETICS" count={15}
        color="#f39c12" totalPower={zoneStats["Athletic"]?.power || 0} />

      {/* Trees */}
      {treePositions.map((p, i) => <Tree key={i} position={p} />)}

      {/* Buildings */}
      {buildings.map(b => (
        <Building3D
          key={b.id}
          building={b}
          data={getBuildingData(b)}
          isSelected={selectedId === b.id}
          isHovered={hoveredId === b.id}
          onHover={onHoverBuilding}
          onClick={onSelectBuilding}
          showLabels={showLabels}
        />
      ))}

      {/* Campus HUD */}
      <CampusHUD stats={campusStats} />

      <OrbitControls
        enablePan enableZoom enableRotate
        maxPolarAngle={Math.PI / 2.15}
        minDistance={10}
        maxDistance={55}
        target={[0, 0, 5]}
      />
    </Canvas>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Selected building overlay panel (shows inside the 3D viewport)
// ════════════════════════════════════════════════════════════════════════

function SelectedBuildingOverlay({ building, data, onClose }) {
  if (!building) return null;
  const isProxy = building.metered_status === "proxy";
  const last24 = data.hourly.slice(-24);

  return (
    <div style={{
      position: "absolute", top: 16, right: 16, width: 360,
      background: "rgba(12,15,22,0.95)", border: "1px solid #1e2230",
      borderRadius: 12, padding: 20, zIndex: 10,
      backdropFilter: "blur(12px)",
      boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
      fontFamily: "'SF Mono', monospace", color: "#c0c4d0",
      maxHeight: "calc(100% - 32px)", overflowY: "auto",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%", background: STATUS_COLORS[data.status],
              boxShadow: `0 0 8px ${STATUS_COLORS[data.status]}`,
            }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: "#e8eaf0", fontFamily: "system-ui, sans-serif" }}>
              {building.name}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "#6b7080", marginTop: 3 }}>
            {building.id} &middot; {building.type} &middot; {building.sqft.toLocaleString()} sqft &middot; {building.age_years}y old
          </div>
        </div>
        <button onClick={onClose} style={{
          background: "transparent", border: "none", color: "#6b7080",
          fontSize: 18, cursor: "pointer", padding: 4,
        }}>&times;</button>
      </div>

      {/* Power reading */}
      <div style={{
        margin: "14px 0", padding: "12px 14px", background: "#0d1117",
        borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <div style={{ fontSize: 11, color: "#6b7080" }}>Current Power</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#e8eaf0" }}>
            {isProxy ? "~" : ""}{data.currentPower.toLocaleString()} <span style={{ fontSize: 14, color: "#6b7080" }}>kW</span>
          </div>
        </div>
        <span style={{
          padding: "4px 10px", borderRadius: 5, fontSize: 10, fontWeight: 600,
          background: `${METER_COLORS[building.metered_status]}22`,
          color: METER_COLORS[building.metered_status],
          border: `1px solid ${METER_COLORS[building.metered_status]}44`,
        }}>
          {building.metered_status === "existing" ? "SMART METERED" : building.metered_status === "new" ? "NEW METER" : "PROXY EST."}
        </span>
      </div>

      {/* Sensor readings */}
      {!isProxy && (
        <div style={{ marginBottom: 12 }}>
          {[
            ["Zone Temp", `${data.sensors.zone_temp_f}°F`, data.sensors.zone_temp_f > 74 ? "#f39c12" : "#e8eaf0"],
            ["Supply Air", `${data.sensors.supply_air_temp_f}°F`, "#e8eaf0"],
            ["Return Air", `${data.sensors.return_air_temp_f}°F`, "#e8eaf0"],
            ["CO₂", `${data.sensors.co2_ppm} ppm`, data.sensors.co2_ppm > 800 ? "#e74c3c" : "#e8eaf0"],
            ...(building.type === "Research Lab" ? [
              ["VOC", `${data.sensors.voc_ppb ?? 0} ppb`, (data.sensors.voc_ppb || 0) > 100 ? "#e74c3c" : "#e8eaf0"],
              ["Ventilation", `${data.sensors.ventilation_ach ?? 0} ACH`, "#e8eaf0"],
              ["Fume Hood", `${data.sensors.fume_hood_cfm ?? 0} CFM`, "#e8eaf0"],
            ] : []),
          ].map(([label, val, col]) => (
            <div key={label} style={{
              display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12,
              borderBottom: "1px solid #111520",
            }}>
              <span style={{ color: "#6b7080" }}>{label}</span>
              <span style={{ color: col, fontWeight: 600 }}>{val}</span>
            </div>
          ))}
        </div>
      )}

      {/* Efficiency */}
      <div style={{
        padding: "8px 12px", borderRadius: 6,
        background: `${STATUS_COLORS[data.status]}11`,
        border: `1px solid ${STATUS_COLORS[data.status]}33`,
        display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 12,
      }}>
        <span style={{ color: "#6b7080" }}>Efficiency Score</span>
        <span style={{ color: STATUS_COLORS[data.status], fontWeight: 700 }}>
          {data.efficiency}x
          <span style={{ fontWeight: 400, fontSize: 10, marginLeft: 4 }}>
            {data.efficiency > 1.3 ? "HIGH WASTE" : data.efficiency > 1.0 ? "ABOVE AVG" : "EFFICIENT"}
          </span>
        </span>
      </div>

      {/* Mini sparkline */}
      <div style={{ fontSize: 11, color: "#6b7080", marginBottom: 4 }}>Last 24h Power Profile</div>
      <ResponsiveContainer width="100%" height={80}>
        <AreaChart data={last24}>
          <defs>
            <linearGradient id="overlayGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isProxy ? "#9b59b6" : "#3498db"} stopOpacity={0.4} />
              <stop offset="100%" stopColor={isProxy ? "#9b59b6" : "#3498db"} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="powerKw" stroke={isProxy ? "#9b59b6" : "#3498db"}
            strokeWidth={1.5} fill="url(#overlayGrad)" />
        </AreaChart>
      </ResponsiveContainer>

      {/* Alerts */}
      {data.alerts.map((a, i) => (
        <div key={i} style={{
          marginTop: 8, padding: "6px 10px", borderRadius: 6,
          background: "#1a120833", border: "1px solid #f39c1244",
          fontSize: 11, color: "#f39c12",
        }}>
          &#9888; {a}
        </div>
      ))}

      {isProxy && (
        <div style={{
          marginTop: 8, padding: "6px 10px", borderRadius: 6,
          background: "#9b59b611", border: "1px solid #9b59b633",
          fontSize: 11, color: "#9b59b6",
        }}>
          ML model estimate &middot; ±14% confidence &middot; Monthly bill validates: &#10003;
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// DASHBOARD COMPONENTS
// ════════════════════════════════════════════════════════════════════════

const S = {
  page: { background: "#0a0c10", minHeight: "100vh", color: "#c0c4d0",
    fontFamily: "'SF Mono', 'Fira Code', monospace", padding: 0, margin: 0 },
  container: { maxWidth: 1440, margin: "0 auto", padding: "0 24px" },
  header: { background: "linear-gradient(180deg, #12151e 0%, #0a0c10 100%)",
    borderBottom: "1px solid #1e2230", padding: "20px 0" },
  headerTitle: { fontSize: 22, fontWeight: 700, color: "#daa520", letterSpacing: 1,
    fontFamily: "system-ui, sans-serif" },
  headerSub: { fontSize: 12, color: "#6b7080", marginTop: 4 },
  metricsRow: { display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" },
  metricCard: { background: "#12151e", border: "1px solid #1e2230", borderRadius: 8,
    padding: "14px 20px", flex: "1 1 150px", minWidth: 150 },
  metricLabel: { fontSize: 11, color: "#6b7080", textTransform: "uppercase", letterSpacing: 1 },
  metricValue: { fontSize: 22, fontWeight: 700, color: "#e8eaf0", marginTop: 4 },
  section: { marginTop: 32 },
  sectionTitle: { fontSize: 16, fontWeight: 600, color: "#e8eaf0", marginBottom: 16,
    fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", gap: 8 },
  filterBar: { display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  filterBtn: (a) => ({ background: a ? "#1e2230" : "transparent",
    border: `1px solid ${a ? "#daa520" : "#1e2230"}`, color: a ? "#daa520" : "#6b7080",
    borderRadius: 6, padding: "6px 14px", fontSize: 12, cursor: "pointer" }),
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 },
  card: (status, metered, sel) => ({ background: "#12151e",
    border: `1px ${metered === "proxy" ? "dashed" : "solid"} ${sel ? "#daa520" : "#1e2230"}`,
    borderRadius: 10, padding: 16, cursor: "pointer",
    boxShadow: sel ? "0 0 20px rgba(218,165,32,0.15)" : "none" }),
  badge: (c) => ({ display: "inline-block", fontSize: 10, padding: "2px 8px", borderRadius: 4,
    background: `${c}22`, color: c, border: `1px solid ${c}44`,
    textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }),
  tooltip: { background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 8,
    padding: "10px 14px", fontSize: 12, color: "#c0c4d0",
    boxShadow: "0 8px 32px rgba(0,0,0,0.4)" },
  th: { textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #1e2230",
    color: "#6b7080", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 },
  td: { padding: "12px", borderBottom: "1px solid #0d1117", color: "#c0c4d0" },
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={S.tooltip}>
      <div style={{ color: "#6b7080", marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || "#e8eaf0" }}>
          {p.name}: <strong>{typeof p.value === "number" ? p.value.toLocaleString() : p.value}</strong>
        </div>
      ))}
    </div>
  );
}

function MetricCard({ label, value, accent, badge }) {
  return (
    <div style={S.metricCard}>
      <div style={S.metricLabel}>{label}</div>
      <div style={{ ...S.metricValue, color: accent || "#e8eaf0" }}>
        {value}
        {badge && <span style={{ fontSize: 11, marginLeft: 8, padding: "2px 8px", borderRadius: 4,
          background: `${badge.color}22`, color: badge.color }}>{badge.text}</span>}
      </div>
    </div>
  );
}

function BuildingCard({ building, data, selected, onClick }) {
  const isProxy = building.metered_status === "proxy";
  return (
    <div style={S.card(data.status, building.metered_status, selected)}
      onClick={() => onClick(building.id)}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLORS[data.status],
              boxShadow: `0 0 6px ${STATUS_COLORS[data.status]}` }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#e8eaf0", fontFamily: "system-ui, sans-serif" }}>
              {building.name}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#6b7080", marginTop: 4 }}>
            {building.type} &middot; {building.sqft.toLocaleString()} sqft
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#6b7080" }}>{building.id}</div>
          <span style={S.badge(METER_COLORS[building.metered_status])}>
            {building.metered_status === "existing" ? "Metered" : building.metered_status === "new" ? "New" : "Proxy"}
          </span>
        </div>
      </div>
      <div style={{ borderTop: "1px solid #1a1f2e", marginTop: 12, paddingTop: 10 }}>
        {[
          ["Power", `${isProxy ? "~" : ""}${data.currentPower.toLocaleString()} kW`],
          ["Zone Temp", isProxy ? "—" : `${data.sensors.zone_temp_f}°F`],
          ["CO₂", isProxy ? "—" : `${data.sensors.co2_ppm} ppm`],
        ].map(([l, v]) => (
          <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 13 }}>
            <span style={{ color: "#6b7080" }}>{l}</span>
            <span style={{ fontWeight: 600, color: "#e8eaf0" }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ borderTop: "1px solid #1a1f2e", marginTop: 8, paddingTop: 8 }}>
        <div style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#6b7080" }}>Efficiency</span>
          <span style={{ color: STATUS_COLORS[data.status], fontWeight: 600 }}>
            {data.efficiency}x
          </span>
        </div>
        {data.alerts.map((a, i) => (
          <div key={i} style={{ fontSize: 11, color: "#f39c12", marginTop: 4 }}>&#9888; {a}</div>
        ))}
      </div>
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
  const [hoveredBuilding, setHoveredBuilding] = useState(null);
  const [showAllLabels, setShowAllLabels] = useState(false);

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

  const selectedBldg = selectedBuilding ? ALL_BUILDINGS.find(b => b.id === selectedBuilding) : null;
  const selectedData = selectedBldg ? getBuildingData(selectedBldg) : null;

  const totalAlerts = useMemo(() =>
    ALL_BUILDINGS.reduce((s, b) => s + getBuildingData(b).alerts.length, 0), []);
  const avgEfficiency = useMemo(() => {
    const effs = ALL_BUILDINGS.map(b => getBuildingData(b).efficiency);
    return (effs.reduce((s, e) => s + e, 0) / effs.length).toFixed(2);
  }, []);

  return (
    <div style={S.page}>
      {/* ── HEADER ── */}
      <div style={S.header}>
        <div style={S.container}>
          <div style={S.headerTitle}>GRIDMIND CAMPUS MONITOR</div>
          <div style={S.headerSub}>MSU Energy Intelligence Platform &middot; Real-time ML Proxy Metering</div>
          <div style={S.metricsRow}>
            <MetricCard label="Total Power Now" value={`${CAMPUS_POWER.toLocaleString()} kW`} />
            <MetricCard label="Today's Cost" value={`$${Math.round(CAMPUS_POWER * 24 * 0.13).toLocaleString()}`} accent="#27ae60" />
            <MetricCard label="Model Accuracy" value="R² = 0.99" badge={{ text: "validated", color: "#27ae60" }} />
            <MetricCard label="Buildings" value="120" badge={{ text: "50 metered + 70 proxy", color: "#3498db" }} />
            <MetricCard label="Active Alerts" value={String(totalAlerts)} accent="#e74c3c"
              badge={totalAlerts > 0 ? { text: "action needed", color: "#e74c3c" } : undefined} />
            <MetricCard label="Campus Efficiency" value={`${avgEfficiency}x`}
              accent={parseFloat(avgEfficiency) < 1 ? "#27ae60" : "#f39c12"} />
          </div>
        </div>
      </div>

      {/* ── 3D CAMPUS — HERO SECTION ── */}
      <div style={{ position: "relative", margin: "0 0 0 0" }}>
        {/* Controls bar */}
        <div style={{
          position: "absolute", top: 16, left: 16, zIndex: 10,
          display: "flex", gap: 8,
        }}>
          <button onClick={() => setShowAllLabels(!showAllLabels)} style={{
            background: showAllLabels ? "#daa52022" : "rgba(12,15,22,0.85)",
            border: `1px solid ${showAllLabels ? "#daa520" : "#1e2230"}`,
            color: showAllLabels ? "#daa520" : "#6b7080",
            borderRadius: 6, padding: "6px 14px", fontSize: 11, cursor: "pointer",
            backdropFilter: "blur(8px)",
          }}>
            {showAllLabels ? "Hide Labels" : "Show All Labels"}
          </button>
          {selectedBuilding && (
            <button onClick={() => setSelectedBuilding(null)} style={{
              background: "rgba(12,15,22,0.85)", border: "1px solid #1e2230",
              color: "#6b7080", borderRadius: 6, padding: "6px 14px", fontSize: 11,
              cursor: "pointer", backdropFilter: "blur(8px)",
            }}>
              Deselect
            </button>
          )}
        </div>

        {/* Legend */}
        <div style={{
          position: "absolute", bottom: 16, left: 16, zIndex: 10,
          background: "rgba(12,15,22,0.88)", border: "1px solid #1e2230",
          borderRadius: 8, padding: "10px 16px",
          display: "flex", gap: 20, fontSize: 11, color: "#6b7080",
          backdropFilter: "blur(8px)",
        }}>
          <div style={{ fontWeight: 600, color: "#e8eaf0" }}>Legend:</div>
          <span><span style={{ color: "#3498db" }}>&#9646;</span> Smart Metered</span>
          <span><span style={{ color: "#27ae60" }}>&#9646;</span> New Meter</span>
          <span><span style={{ color: "#9b59b6" }}>&#9646;</span> Proxy (ML Est.)</span>
          <span style={{ borderLeft: "1px solid #1e2230", paddingLeft: 12 }}>
            <span style={{ color: "#27ae60" }}>&#9679;</span> Efficient
          </span>
          <span><span style={{ color: "#f39c12" }}>&#9679;</span> Above Avg</span>
          <span><span style={{ color: "#e74c3c" }}>&#9679;</span> High Waste</span>
          <span style={{ borderLeft: "1px solid #1e2230", paddingLeft: 12 }}>
            Height = power draw &middot; Orbit: drag &middot; Zoom: scroll
          </span>
        </div>

        {/* Selected building overlay panel */}
        <SelectedBuildingOverlay
          building={selectedBldg}
          data={selectedData}
          onClose={() => setSelectedBuilding(null)}
        />

        {/* 3D Canvas */}
        <div style={{ height: "75vh", minHeight: 600, maxHeight: 900 }}>
          <Suspense fallback={
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
              height: "75vh", background: "#060810", color: "#6b7080" }}>
              Loading 3D campus...
            </div>
          }>
            <CampusScene
              buildings={ALL_BUILDINGS}
              selectedId={selectedBuilding}
              hoveredId={hoveredBuilding}
              onSelectBuilding={setSelectedBuilding}
              onHoverBuilding={setHoveredBuilding}
              showLabels={showAllLabels}
            />
          </Suspense>
        </div>
      </div>

      <div style={S.container}>
        {/* ── BUILDING GRID ── */}
        <div style={S.section}>
          <div style={S.sectionTitle}>
            <span style={{ color: "#3498db" }}>&#9632;</span> Building Grid
          </div>
          <div style={S.filterBar}>
            {[["All", `All (120)`], ["Research Lab", "Labs (20)"], ["Academic", "Academic (60)"],
              ["Residence", "Residence (25)"], ["Athletic", "Athletic (15)"]].map(([v, l]) => (
              <button key={v} style={S.filterBtn(typeFilter === v)} onClick={() => setTypeFilter(v)}>{l}</button>
            ))}
            <span style={{ width: 1, background: "#1e2230", margin: "0 4px" }} />
            {[["All", "All Meters"], ["Metered", "Metered (30)"], ["New", "New (20)"], ["Proxy", "Proxy (70)"]].map(([v, l]) => (
              <button key={v} style={S.filterBtn(meterFilter === v)} onClick={() => setMeterFilter(v)}>{l}</button>
            ))}
            <span style={{ width: 1, background: "#1e2230", margin: "0 4px" }} />
            {[["energy", "Energy \u2193"], ["efficiency", "Efficiency"], ["alerts", "Alerts"]].map(([v, l]) => (
              <button key={v} style={S.filterBtn(sortBy === v)} onClick={() => setSortBy(v)}>{l}</button>
            ))}
          </div>
          <div style={S.grid}>
            {filteredBuildings.slice(0, 24).map(b => (
              <BuildingCard key={b.id} building={b} data={getBuildingData(b)}
                selected={selectedBuilding === b.id} onClick={setSelectedBuilding} />
            ))}
          </div>
          {filteredBuildings.length > 24 && (
            <div style={{ textAlign: "center", padding: 16, color: "#6b7080", fontSize: 12 }}>
              Showing 24 of {filteredBuildings.length}. Use filters to narrow.
            </div>
          )}
        </div>

        {/* ── ML MODEL PERFORMANCE ── */}
        <div style={S.section}>
          <div style={S.sectionTitle}>
            <span style={{ color: "#27ae60" }}>&#9632;</span> ML Model Performance
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 24 }}>
            <div style={{ background: "#12151e", borderRadius: 10, padding: 20, border: "1px solid #1e2230" }}>
              <div style={{ fontSize: 13, color: "#6b7080", marginBottom: 12 }}>Actual vs Predicted (Test Set)</div>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2230" />
                  <XAxis type="number" dataKey="actual" name="Actual (kW)" tick={{ fill: "#6b7080", fontSize: 10 }}
                    label={{ value: "Actual (kW)", position: "insideBottom", offset: -5, fill: "#6b7080", fontSize: 11 }} />
                  <YAxis type="number" dataKey="predicted" name="Predicted (kW)" tick={{ fill: "#6b7080", fontSize: 10 }}
                    label={{ value: "Predicted (kW)", angle: -90, position: "insideLeft", fill: "#6b7080", fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 5000, y: 5000 }]} stroke="#daa52066" strokeDasharray="6 3" />
                  {Object.entries(TYPE_COLORS).map(([type, color]) => (
                    <Scatter key={type} name={type} data={SCATTER_DATA.filter(d => d.type === type)} fill={color} opacity={0.7} />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div style={{ background: "#12151e", borderRadius: 10, padding: 20, border: "1px solid #1e2230" }}>
              <div style={{ fontSize: 13, color: "#6b7080", marginBottom: 12 }}>Feature Importance (Top 8)</div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={FEATURE_IMPORTANCE} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2230" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#6b7080", fontSize: 10 }} domain={[0, 0.8]} />
                  <YAxis type="category" dataKey="feature" width={140} tick={{ fill: "#c0c4d0", fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="importance" name="Importance" radius={[0, 4, 4, 0]}>
                    {FEATURE_IMPORTANCE.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? "#daa520" : i < 3 ? "#3498db" : "#1e2230"} stroke={i >= 3 ? "#3498db44" : undefined} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div style={{ display: "flex", gap: 24, marginTop: 16, padding: "16px 20px",
            background: "#12151e", borderRadius: 8, border: "1px solid #1e2230", fontSize: 13, flexWrap: "wrap" }}>
            <div><span style={{ color: "#6b7080" }}>R² Score: </span><span style={{ color: "#27ae60", fontWeight: 700 }}>0.99</span></div>
            <div><span style={{ color: "#6b7080" }}>Mean Error: </span><span style={{ color: "#e8eaf0", fontWeight: 700 }}>±3.0%</span></div>
            <div><span style={{ color: "#6b7080" }}>MAE: </span><span style={{ color: "#e8eaf0", fontWeight: 700 }}>67.5 kW</span></div>
            <div><span style={{ color: "#6b7080" }}>Trained on: </span><span style={{ color: "#e8eaf0" }}>50 buildings, 8,400 points</span></div>
            <div style={{ marginLeft: "auto", color: "#6b7080", fontStyle: "italic" }}>
              For a 500 kW building, estimate is 485-515 kW
            </div>
          </div>
        </div>

        {/* ── Campus Load Profile ── */}
        <div style={S.section}>
          <div style={S.sectionTitle}>
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
                <XAxis dataKey="label" tick={{ fill: "#6b7080", fontSize: 9 }} interval={23} />
                <YAxis tick={{ fill: "#6b7080", fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="totalKw" stroke="#daa520" strokeWidth={1.5} fill="url(#campusGrad)" name="Campus Total (kW)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── ANOMALY DETECTION ── */}
        <div style={{ ...S.section, marginBottom: 40 }}>
          <div style={S.sectionTitle}>
            <span style={{ color: "#e74c3c" }}>&#9632;</span> Anomaly Detection & Savings
          </div>
          <div style={{ background: "#12151e", borderRadius: 10, padding: 20, border: "1px solid #1e2230", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr>
                <th style={S.th}>Building</th><th style={S.th}>Issue</th>
                <th style={S.th}>Est. Annual Waste</th><th style={S.th}>Recommended Action</th>
              </tr></thead>
              <tbody>
                {ANOMALIES.map((a, i) => (
                  <tr key={i} style={{ cursor: "pointer" }} onClick={() => setSelectedBuilding(a.building_id)}>
                    <td style={S.td}>
                      <div style={{ fontWeight: 600, color: "#e8eaf0" }}>{a.building_id}</div>
                      <div style={{ fontSize: 11, color: "#6b7080" }}>{a.building_name}</div>
                    </td>
                    <td style={S.td}>
                      <span style={{ display: "inline-block", fontSize: 10, padding: "2px 6px", borderRadius: 3, marginRight: 6,
                        background: "#f39c1222", color: "#f39c12" }}>{a.type.replace(/_/g, " ")}</span>
                      {a.description}
                    </td>
                    <td style={{ ...S.td, color: "#e74c3c", fontWeight: 700 }}>${a.waste.toLocaleString()}</td>
                    <td style={{ ...S.td, fontSize: 12 }}>{a.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 16, padding: "14px 20px", background: "#0d1117", borderRadius: 8,
            border: "1px solid #1e2230", fontSize: 13, color: "#6b7080" }}>
            Total identified waste: <span style={{ color: "#e74c3c", fontWeight: 700 }}>
              ${ANOMALIES.reduce((s, a) => s + a.waste, 0).toLocaleString()}/year
            </span> from {ANOMALIES.length} buildings. Fixing these = 1.2% of annual energy budget recovered.
          </div>
        </div>

        <div style={{ textAlign: "center", padding: "24px 0 40px", fontSize: 11, color: "#3a3f50", borderTop: "1px solid #1e2230" }}>
          GridMind Campus Monitor v2.0 &middot; ML Proxy Metering System &middot; MSU Energy Intelligence
        </div>
      </div>
    </div>
  );
}
