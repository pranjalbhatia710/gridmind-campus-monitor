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
  // Athletic — bottom-left, wider spacing for bigger buildings
  for (let i = 0; i < 15; i++) {
    const sqft = 40000 + Math.floor(rngVal() * 60000);
    const age = 5 + Math.floor(rngVal() * 35);
    const isExisting = i < 3;
    const isNew = !isExisting && i < 5;
    const col = i % 5, row = Math.floor(i / 5);
    buildings.push({
      id: `ATH-${String(i+1).padStart(2,"0")}`,
      name: ATHLETIC_NAMES[i], type: "Athletic", sqft, age_years: age,
      metered_status: isExisting ? "existing" : isNew ? "new" : "proxy",
      gridX: -14 + col * 4.5 + (rngVal() - 0.5) * 0.4,
      gridZ: 18 + row * 4.5 + (rngVal() - 0.5) * 0.4,
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
// 3D CAMPUS — ARCHITECTURAL DETAIL
// ════════════════════════════════════════════════════════════════════════

// Efficient window strip — single mesh per face using a canvas texture
function WindowStrip({ width, height, z, floors, cols, windowColor, rotation = [0, 0, 0] }) {
  const tex = useMemo(() => {
    const canvas = document.createElement("canvas");
    const cw = cols * 20, ch = floors * 20;
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "transparent";
    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = windowColor;
    const padX = 3, padY = 4, winW = (cw / cols) - padX * 2, winH = (ch / floors) - padY * 2;
    for (let r = 0; r < floors; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillRect(c * (cw / cols) + padX, r * (ch / floors) + padY, winW, winH);
      }
    }
    const t = new THREE.CanvasTexture(canvas);
    t.minFilter = THREE.LinearFilter;
    return t;
  }, [floors, cols, windowColor]);
  return (
    <mesh position={[0, height / 2, z]} rotation={rotation}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial map={tex} transparent emissive={windowColor}
        emissiveIntensity={0.35} metalness={0.6} roughness={0.3} side={THREE.DoubleSide} />
    </mesh>
  );
}

// Windows on all four faces — 4 meshes total instead of hundreds
function BuildingWindows({ w, d, h, floors, windowColor }) {
  const colsW = Math.max(2, Math.round(w / 0.35));
  const colsD = Math.max(2, Math.round(d / 0.35));
  return (
    <group>
      {/* front */}
      <WindowStrip width={w * 0.92} height={h * 0.88} z={d / 2 + 0.006} floors={floors} cols={colsW} windowColor={windowColor} />
      {/* back */}
      <WindowStrip width={w * 0.92} height={h * 0.88} z={-d / 2 - 0.006} floors={floors} cols={colsW} windowColor={windowColor} />
      {/* left */}
      <WindowStrip width={d * 0.92} height={h * 0.88} z={0} floors={floors} cols={colsD} windowColor={windowColor}
        rotation={[0, Math.PI / 2, 0]} />
      {/* right — reuse by offsetting */}
      <group position={[0, 0, 0]}>
        <mesh position={[w / 2 + 0.006, h / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[d * 0.92, h * 0.88]} />
          <meshStandardMaterial color={windowColor} emissive={windowColor}
            emissiveIntensity={0.35} transparent opacity={0.9} metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[-w / 2 - 0.006, h / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[d * 0.92, h * 0.88]} />
          <meshStandardMaterial color={windowColor} emissive={windowColor}
            emissiveIntensity={0.35} transparent opacity={0.9} metalness={0.6} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

// Lab building: modern flat roof, glass curtain wall, rooftop equipment
function LabBuilding({ w, d, h, wallColor, isProxy }) {
  const floors = Math.max(2, Math.round(h / 0.6));
  return (
    <group>
      {/* Foundation / plinth */}
      <mesh position={[0, 0.05, 0]} castShadow>
        <boxGeometry args={[w + 0.1, 0.1, d + 0.1]} />
        <meshStandardMaterial color="#333" metalness={0.3} roughness={0.7} />
      </mesh>
      {/* Main body */}
      <mesh position={[0, h / 2, 0]} castShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={wallColor} metalness={0.45} roughness={0.45}
          transparent opacity={isProxy ? 0.5 : 0.92} />
      </mesh>
      {/* Corner pilasters — vertical accent strips on edges */}
      {[[-1,-1],[-1,1],[1,-1],[1,1]].map(([sx,sz], i) => (
        <mesh key={i} position={[sx * w / 2, h / 2, sz * d / 2]} castShadow>
          <boxGeometry args={[0.06, h + 0.02, 0.06]} />
          <meshStandardMaterial color="#3a4550" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
      {/* Glass windows */}
      <BuildingWindows w={w} d={d} h={h} floors={floors} windowColor="#88ccff" />
      {/* Horizontal spandrel bands between floors */}
      {Array.from({ length: floors - 1 }, (_, i) => (
        <group key={i}>
          <mesh position={[0, (i + 1) * (h / floors), d / 2 + 0.007]}>
            <planeGeometry args={[w * 0.95, 0.035]} />
            <meshStandardMaterial color="#3a4a55" metalness={0.4} />
          </mesh>
          <mesh position={[0, (i + 1) * (h / floors), -d / 2 - 0.007]}>
            <planeGeometry args={[w * 0.95, 0.035]} />
            <meshStandardMaterial color="#3a4a55" metalness={0.4} />
          </mesh>
        </group>
      ))}
      {/* Flat roof parapet */}
      <mesh position={[0, h + 0.04, 0]}>
        <boxGeometry args={[w + 0.06, 0.08, d + 0.06]} />
        <meshStandardMaterial color="#2a2e33" metalness={0.6} roughness={0.35} />
      </mesh>
      {/* Rooftop HVAC unit */}
      <mesh position={[w * 0.2, h + 0.2, -d * 0.15]}>
        <boxGeometry args={[w * 0.22, 0.22, d * 0.18]} />
        <meshStandardMaterial color="#3d3d3d" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* Exhaust fan housing */}
      <mesh position={[-w * 0.18, h + 0.16, d * 0.18]}>
        <cylinderGeometry args={[0.08, 0.08, 0.2, 6]} />
        <meshStandardMaterial color="#444" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* Ventilation pipe */}
      <mesh position={[w * 0.3, h + 0.3, d * 0.25]}>
        <cylinderGeometry args={[0.03, 0.03, 0.45, 6]} />
        <meshStandardMaterial color="#555" metalness={0.6} />
      </mesh>
      {/* Entry — glass revolving door suggestion */}
      <mesh position={[0, 0.25, d / 2 + 0.007]}>
        <planeGeometry args={[w * 0.22, 0.5]} />
        <meshStandardMaterial color="#446688" emissive="#446688" emissiveIntensity={0.15}
          metalness={0.7} roughness={0.2} />
      </mesh>
      {/* Accent stripe at mid-height */}
      <mesh position={[0, h * 0.5, d / 2 + 0.008]}>
        <planeGeometry args={[w, 0.05]} />
        <meshStandardMaterial color="#4488aa" metalness={0.5} roughness={0.3} />
      </mesh>
    </group>
  );
}

// Academic building: warm brick, peaked roof, columned entrance
function AcademicBuilding({ w, d, h, wallColor, isProxy }) {
  const floors = Math.max(1, Math.round(h / 0.6));
  const roofPeak = 0.35;
  return (
    <group>
      {/* Stone foundation base */}
      <mesh position={[0, 0.06, 0]} castShadow>
        <boxGeometry args={[w + 0.06, 0.12, d + 0.06]} />
        <meshStandardMaterial color="#6a6058" roughness={0.9} metalness={0.05} />
      </mesh>
      {/* Main body — brick */}
      <mesh position={[0, h / 2, 0]} castShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={wallColor} metalness={0.08} roughness={0.88}
          transparent opacity={isProxy ? 0.5 : 0.93} />
      </mesh>
      {/* Brick quoin corners */}
      {[[-1,-1],[-1,1],[1,-1],[1,1]].map(([sx,sz], i) => (
        <mesh key={i} position={[sx * w / 2, h / 2, sz * d / 2]}>
          <boxGeometry args={[0.07, h, 0.07]} />
          <meshStandardMaterial color="#987050" roughness={0.85} />
        </mesh>
      ))}
      {/* Windows — warm glow */}
      <BuildingWindows w={w} d={d} h={h} floors={floors} windowColor="#ddaa44" />
      {/* Cornice / trim band at top */}
      <mesh position={[0, h - 0.02, 0]}>
        <boxGeometry args={[w + 0.1, 0.06, d + 0.1]} />
        <meshStandardMaterial color="#887060" roughness={0.75} />
      </mesh>
      {/* Peaked roof */}
      <mesh position={[0, h + roofPeak / 2, 0]} castShadow>
        <boxGeometry args={[w + 0.15, roofPeak, d + 0.15]} />
        <meshStandardMaterial color="#5a2e1e" metalness={0.1} roughness={0.85} />
      </mesh>
      {/* Roof ridge */}
      <mesh position={[0, h + roofPeak + 0.02, 0]}>
        <boxGeometry args={[w * 0.06, 0.04, d + 0.2]} />
        <meshStandardMaterial color="#4a2a1a" />
      </mesh>
      {/* Portico / covered entrance */}
      <mesh position={[0, h * 0.48, d / 2 + 0.15]}>
        <boxGeometry args={[w * 0.4, 0.06, 0.3]} />
        <meshStandardMaterial color="#776858" metalness={0.15} roughness={0.7} />
      </mesh>
      {/* Columns — 4 for wider buildings, 2 for smaller */}
      {(w > 1.2 ? [-1.5, -0.5, 0.5, 1.5] : [-1, 1]).map((s, i) => (
        <mesh key={i} position={[s * w * 0.12, h * 0.24, d / 2 + 0.22]}>
          <cylinderGeometry args={[0.035, 0.04, h * 0.47, 8]} />
          <meshStandardMaterial color="#ddd8cc" metalness={0.15} roughness={0.5} />
        </mesh>
      ))}
      {/* Double door */}
      <mesh position={[0, 0.22, d / 2 + 0.007]}>
        <planeGeometry args={[w * 0.18, 0.44]} />
        <meshStandardMaterial color="#3a2211" roughness={0.8} />
      </mesh>
      {/* Transom window above door */}
      <mesh position={[0, 0.48, d / 2 + 0.007]}>
        <planeGeometry args={[w * 0.2, 0.08]} />
        <meshStandardMaterial color="#bbaa66" emissive="#bbaa66" emissiveIntensity={0.2} />
      </mesh>
      {/* Steps */}
      {[0, 1, 2].map(i => (
        <mesh key={i} position={[0, i * 0.04 + 0.02, d / 2 + 0.25 + i * 0.06]}>
          <boxGeometry args={[w * 0.35, 0.04, 0.06]} />
          <meshStandardMaterial color="#8a8078" roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

// Residence hall: tall tower, balconies, warm window glow
function ResidenceBuilding({ w, d, h, wallColor, isProxy }) {
  const floors = Math.max(3, Math.round(h / 0.45));
  return (
    <group>
      {/* Foundation */}
      <mesh position={[0, 0.05, 0]} castShadow>
        <boxGeometry args={[w + 0.06, 0.1, d + 0.06]} />
        <meshStandardMaterial color="#555" metalness={0.2} roughness={0.7} />
      </mesh>
      {/* Main body */}
      <mesh position={[0, h / 2, 0]} castShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={wallColor} metalness={0.15} roughness={0.72}
          transparent opacity={isProxy ? 0.5 : 0.93} />
      </mesh>
      {/* Accent panel stripe on front — different material section */}
      <mesh position={[w * 0.25, h / 2, d / 2 + 0.007]}>
        <planeGeometry args={[w * 0.15, h * 0.9]} />
        <meshStandardMaterial color="#5a6878" metalness={0.3} roughness={0.6} />
      </mesh>
      {/* Windows — warm amber */}
      <BuildingWindows w={w} d={d} h={h} floors={floors} windowColor="#ffcc55" />
      {/* Roof parapet with railing */}
      <mesh position={[0, h + 0.03, 0]}>
        <boxGeometry args={[w + 0.04, 0.06, d + 0.04]} />
        <meshStandardMaterial color="#555" metalness={0.4} roughness={0.5} />
      </mesh>
      {/* Balcony ledges — front and back */}
      {Array.from({ length: floors }, (_, i) => (
        <group key={i}>
          <mesh position={[0, (i + 0.95) * (h / floors), d / 2 + 0.07]}>
            <boxGeometry args={[w + 0.02, 0.035, 0.14]} />
            <meshStandardMaterial color="#8a8a8a" metalness={0.35} roughness={0.45} />
          </mesh>
          {/* Railing posts */}
          {Array.from({ length: Math.max(3, Math.round(w / 0.3)) }, (_, j) => (
            <mesh key={j} position={[-w / 2 + (j + 0.5) * (w / Math.round(w / 0.3)), (i + 0.95) * (h / floors) + 0.06, d / 2 + 0.12]}>
              <boxGeometry args={[0.01, 0.08, 0.01]} />
              <meshStandardMaterial color="#999" metalness={0.5} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Ground floor — lobby glass */}
      <mesh position={[0, 0.25, d / 2 + 0.007]}>
        <planeGeometry args={[w * 0.6, 0.5]} />
        <meshStandardMaterial color="#557799" emissive="#557799" emissiveIntensity={0.2}
          metalness={0.6} roughness={0.25} />
      </mesh>
      {/* Canopy */}
      <mesh position={[0, 0.55, d / 2 + 0.25]}>
        <boxGeometry args={[w * 0.5, 0.04, 0.45]} />
        <meshStandardMaterial color="#666" metalness={0.45} roughness={0.45} />
      </mesh>
      {/* Canopy support columns */}
      {[-1, 1].map(s => (
        <mesh key={s} position={[s * w * 0.2, 0.28, d / 2 + 0.4]}>
          <cylinderGeometry args={[0.02, 0.02, 0.55, 5]} />
          <meshStandardMaterial color="#777" metalness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

// Athletic facility: massive, wide, arched roof, floodlights, bright colors
function AthleticBuilding({ w, d, h, wallColor, isProxy }) {
  // Athletic buildings are wider and deeper than other types
  const aw = w * 1.4, ad = d * 1.4;
  const ribCount = Math.max(4, Math.round(aw / 0.5));
  return (
    <group>
      {/* Concrete pad / foundation */}
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[aw + 0.3, 0.08, ad + 0.3]} />
        <meshStandardMaterial color="#3a3a3a" roughness={0.85} metalness={0.1} />
      </mesh>
      {/* Main body — wider, taller walls */}
      <mesh position={[0, h / 2, 0]} castShadow>
        <boxGeometry args={[aw, h, ad]} />
        <meshStandardMaterial color="#556575" metalness={0.35} roughness={0.55}
          transparent opacity={isProxy ? 0.5 : 0.92} />
      </mesh>
      {/* Upper wall accent band — team color stripe */}
      <mesh position={[0, h * 0.85, ad / 2 + 0.007]}>
        <planeGeometry args={[aw * 0.95, h * 0.1]} />
        <meshStandardMaterial color="#2a6030" emissive="#2a6030" emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[0, h * 0.85, -ad / 2 - 0.007]}>
        <planeGeometry args={[aw * 0.95, h * 0.1]} />
        <meshStandardMaterial color="#2a6030" emissive="#2a6030" emissiveIntensity={0.15} />
      </mesh>
      {/* Arched / barrel roof */}
      <mesh position={[0, h, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[ad / 2, ad / 2, aw + 0.05, 16, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color="#4a4a4a" metalness={0.55} roughness={0.35}
          side={THREE.DoubleSide} />
      </mesh>
      {/* Roof ridge cap */}
      <mesh position={[0, h + ad / 2 - 0.02, 0]}>
        <boxGeometry args={[aw + 0.1, 0.04, 0.08]} />
        <meshStandardMaterial color="#666" metalness={0.6} />
      </mesh>
      {/* Structural ribs on front face */}
      {Array.from({ length: ribCount }, (_, i) => {
        const x = -aw / 2 + (i + 0.5) * (aw / ribCount);
        return (
          <group key={`rib${i}`}>
            <mesh position={[x, h / 2, ad / 2 + 0.015]}>
              <boxGeometry args={[0.04, h, 0.03]} />
              <meshStandardMaterial color="#667" metalness={0.4} />
            </mesh>
            <mesh position={[x, h / 2, -ad / 2 - 0.015]}>
              <boxGeometry args={[0.04, h, 0.03]} />
              <meshStandardMaterial color="#667" metalness={0.4} />
            </mesh>
          </group>
        );
      })}
      {/* Large entrance — glass front */}
      <mesh position={[0, h * 0.35, ad / 2 + 0.008]}>
        <planeGeometry args={[aw * 0.4, h * 0.65]} />
        <meshStandardMaterial color="#3366aa" emissive="#3366aa" emissiveIntensity={0.2}
          metalness={0.6} roughness={0.2} />
      </mesh>
      {/* Entrance frame */}
      {[[-1, 0], [1, 0], [0, 1]].map(([sx, sy], i) => (
        <mesh key={i} position={[
          sx * aw * 0.2,
          sy === 1 ? h * 0.68 : h * 0.35,
          ad / 2 + 0.01
        ]}>
          <boxGeometry args={[sx === 0 ? aw * 0.42 : 0.06, sy === 1 ? 0.06 : h * 0.66, 0.04]} />
          <meshStandardMaterial color="#444" metalness={0.5} />
        </mesh>
      ))}
      {/* Clerestory windows — bright */}
      {Array.from({ length: Math.max(4, Math.round(aw / 0.5)) }, (_, i) => {
        const x = -aw / 2 + (aw / (Math.round(aw / 0.5) + 1)) * (i + 1);
        return (
          <mesh key={`w${i}`} position={[x, h * 0.9, ad / 2 + 0.008]}>
            <planeGeometry args={[0.2, 0.12]} />
            <meshStandardMaterial color="#99ccee" emissive="#99ccee" emissiveIntensity={0.4} />
          </mesh>
        );
      })}
      {/* Floodlight towers — 4 corners */}
      {[[-1,-1],[-1,1],[1,-1],[1,1]].map(([sx,sz], i) => (
        <group key={`fl${i}`} position={[sx * (aw / 2 + 0.4), 0, sz * (ad / 2 + 0.4)]}>
          {/* Tower pole */}
          <mesh position={[0, h * 0.8, 0]}>
            <cylinderGeometry args={[0.025, 0.035, h * 1.6, 5]} />
            <meshStandardMaterial color="#555" metalness={0.6} roughness={0.3} />
          </mesh>
          {/* Light bank */}
          <mesh position={[sx * -0.08, h * 1.55, sz * -0.08]} rotation={[sz * 0.3, 0, sx * -0.3]}>
            <boxGeometry args={[0.12, 0.06, 0.08]} />
            <meshStandardMaterial color="#eee" emissive="#ffffcc" emissiveIntensity={0.8} />
          </mesh>
        </group>
      ))}
      {/* Side doors */}
      {[-1, 1].map(s => (
        <mesh key={`sd${s}`} position={[aw / 2 + 0.007, 0.22, s * ad * 0.25]}
          rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.3, 0.44]} />
          <meshStandardMaterial color="#334455" metalness={0.4} />
        </mesh>
      ))}
      {/* Loading dock on back */}
      <mesh position={[0, 0.15, -ad / 2 - 0.15]}>
        <boxGeometry args={[aw * 0.3, 0.3, 0.3]} />
        <meshStandardMaterial color="#3a3a3a" roughness={0.8} />
      </mesh>
    </group>
  );
}

// Alert ring pulsing around anomalous buildings
function AlertRing({ radius }) {
  const ref = useRef();
  useFrame((state) => {
    if (ref.current) {
      const s = 1 + 0.15 * Math.sin(state.clock.elapsedTime * 3);
      ref.current.scale.set(s, 1, s);
      ref.current.material.opacity = 0.3 + 0.2 * Math.sin(state.clock.elapsedTime * 3);
    }
  });
  return (
    <mesh ref={ref} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius + 0.1, radius + 0.25, 24]} />
      <meshBasicMaterial color="#e74c3c" transparent opacity={0.4} side={THREE.DoubleSide} />
    </mesh>
  );
}

// Complete building with architecture, label, alerts
function Building3D({ building, data, isSelected, isHovered, onHover, onClick, showLabels }) {
  const groupRef = useRef();
  const isProxy = building.metered_status === "proxy";
  const hasAlert = data.alerts.length > 0;
  const meterColor = METER_COLORS[building.metered_status];
  const statusColor = STATUS_COLORS[data.status];

  // Dimensions — wider footprint, taller heights for drama
  const area = building.sqft / 4000;
  const w = Math.sqrt(area) * 0.9;
  const d = Math.sqrt(area) * 0.65;
  const h = building.type === "Research Lab" ? 1.6 + data.currentPower / 2000
    : building.type === "Residence" ? 2.0 + data.currentPower / 2200
    : building.type === "Athletic" ? 1.2 + data.currentPower / 2000
    : 1.0 + data.currentPower / 2800;

  // Brighter, more distinct wall colors per type
  const wallColors = {
    "Research Lab": "#5a6a7a",  // modern steel grey
    Academic: "#a07050",        // warm brick
    Residence: "#7a8898",       // blue-slate
    Athletic: "#607888",        // bright steel-blue
  };
  const wallColor = wallColors[building.type];

  // Hover/select highlight
  useFrame((state) => {
    if (!groupRef.current) return;
    if (isSelected) {
      groupRef.current.position.y = 0.05 + 0.03 * Math.sin(state.clock.elapsedTime * 2);
    } else {
      groupRef.current.position.y *= 0.9;
    }
  });

  const BuildingComponent = building.type === "Research Lab" ? LabBuilding
    : building.type === "Academic" ? AcademicBuilding
    : building.type === "Residence" ? ResidenceBuilding
    : AthleticBuilding;

  return (
    <group position={[building.gridX, 0, building.gridZ]}>
      <group ref={groupRef}>
        {/* Invisible click target covering the whole building */}
        <mesh
          position={[0, h / 2, 0]}
          onClick={(e) => { e.stopPropagation(); onClick(building.id); }}
          onPointerEnter={(e) => { e.stopPropagation(); onHover(building.id); document.body.style.cursor = "pointer"; }}
          onPointerLeave={() => { onHover(null); document.body.style.cursor = "default"; }}
        >
          <boxGeometry args={[w + 0.3, h + 0.3, d + 0.3]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>

        {/* Actual building geometry */}
        <BuildingComponent w={w} d={d} h={h} wallColor={wallColor} isProxy={isProxy} />

        {/* Selection highlight outline */}
        {isSelected && (
          <mesh position={[0, h / 2, 0]}>
            <boxGeometry args={[w + 0.08, h + 0.08, d + 0.08]} />
            <meshBasicMaterial color="#daa520" transparent opacity={0.15} side={THREE.BackSide} />
          </mesh>
        )}
        {isHovered && !isSelected && (
          <mesh position={[0, h / 2, 0]}>
            <boxGeometry args={[w + 0.06, h + 0.06, d + 0.06]} />
            <meshBasicMaterial color="#556677" transparent opacity={0.12} side={THREE.BackSide} />
          </mesh>
        )}

        {/* Meter status beacon */}
        <mesh position={[w / 2, h + 0.2, d / 2]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial color={meterColor} emissive={meterColor} emissiveIntensity={1.0} />
        </mesh>

        {/* Alert ring */}
        {hasAlert && <AlertRing radius={Math.max(w, d) / 2 + 0.15} />}

        {/* Ground shadow / footprint */}
        <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w + 0.2, d + 0.2]} />
          <meshBasicMaterial color="#0a0a0a" transparent opacity={0.3} />
        </mesh>
      </group>

      {/* Floating label */}
      {(showLabels || isSelected || isHovered || hasAlert) && (
        <Html position={[0, h + 0.7, 0]} center distanceFactor={18}
          style={{ pointerEvents: "none", userSelect: "none" }}>
          <div style={{
            background: isSelected ? "rgba(218,165,32,0.95)" : "rgba(8,10,15,0.92)",
            border: `1px solid ${isSelected ? "#daa520" : isHovered ? "#556677" : "#1e2230"}`,
            borderRadius: 6, padding: "5px 9px", whiteSpace: "nowrap",
            fontFamily: "'SF Mono', monospace", minWidth: 100,
            boxShadow: isSelected ? "0 0 20px rgba(218,165,32,0.3)" : "0 4px 16px rgba(0,0,0,0.7)",
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700,
              color: isSelected ? "#0a0c10" : "#e8eaf0",
              display: "flex", alignItems: "center", gap: 4,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: statusColor, boxShadow: `0 0 4px ${statusColor}`,
              }} />
              {building.name}
            </div>
            <div style={{ fontSize: 9, color: isSelected ? "#333" : "#6b7080", marginTop: 1 }}>
              {building.id} &middot; {building.sqft.toLocaleString()} sqft
            </div>
            <div style={{
              marginTop: 3, display: "flex", gap: 6, fontSize: 11, fontWeight: 700,
              color: isSelected ? "#0a0c10" : "#e8eaf0",
            }}>
              <span>{isProxy ? "~" : ""}{data.currentPower.toLocaleString()} kW</span>
              <span style={{
                fontSize: 8, padding: "1px 4px", borderRadius: 3,
                background: `${meterColor}33`, color: meterColor, fontWeight: 600,
              }}>
                {building.metered_status === "existing" ? "METERED" : building.metered_status === "new" ? "NEW" : "PROXY"}
              </span>
            </div>
            {hasAlert && (
              <div style={{ fontSize: 9, color: "#f39c12", marginTop: 2 }}>
                &#9888; {data.alerts.length} alert{data.alerts.length > 1 ? "s" : ""}
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

// ─── Campus environment ──────────────────────────────────────────────

// Deciduous tree with trunk + layered canopy
function Tree({ position, scale = 1 }) {
  return (
    <group position={position} scale={[scale, scale, scale]}>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.035, 0.05, 0.4, 5]} />
        <meshStandardMaterial color="#5a3a1a" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.55, 0]}>
        <sphereGeometry args={[0.28, 7, 6]} />
        <meshStandardMaterial color="#1a4a1a" roughness={0.85} />
      </mesh>
      <mesh position={[0.08, 0.65, 0.06]}>
        <sphereGeometry args={[0.2, 6, 5]} />
        <meshStandardMaterial color="#1e5a1e" roughness={0.85} />
      </mesh>
      <mesh position={[-0.06, 0.6, -0.08]}>
        <sphereGeometry args={[0.18, 6, 5]} />
        <meshStandardMaterial color="#165016" roughness={0.85} />
      </mesh>
    </group>
  );
}

// Evergreen / pine tree
function PineTree({ position, scale = 1 }) {
  return (
    <group position={position} scale={[scale, scale, scale]}>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.03, 0.04, 0.3, 5]} />
        <meshStandardMaterial color="#4a2a10" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.4, 0]}>
        <coneGeometry args={[0.22, 0.4, 6]} />
        <meshStandardMaterial color="#143a14" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.6, 0]}>
        <coneGeometry args={[0.16, 0.35, 6]} />
        <meshStandardMaterial color="#1a4a1a" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.78, 0]}>
        <coneGeometry args={[0.10, 0.25, 6]} />
        <meshStandardMaterial color="#205a20" roughness={0.8} />
      </mesh>
    </group>
  );
}

// Lamp post — no point light per lamp (performance), just emissive glow
function LampPost({ position }) {
  return (
    <group position={position}>
      {/* Pole */}
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.018, 0.025, 0.9, 5]} />
        <meshStandardMaterial color="#555" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Arm */}
      <mesh position={[0.08, 0.88, 0]} rotation={[0, 0, -0.3]}>
        <cylinderGeometry args={[0.01, 0.012, 0.18, 4]} />
        <meshStandardMaterial color="#555" metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Lamp head */}
      <mesh position={[0.14, 0.92, 0]}>
        <sphereGeometry args={[0.045, 6, 6]} />
        <meshStandardMaterial color="#ffeeaa" emissive="#ffdd88" emissiveIntensity={1.2} />
      </mesh>
      {/* Glow cone on ground */}
      <mesh position={[0.14, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.5, 8]} />
        <meshBasicMaterial color="#ffdd88" transparent opacity={0.04} />
      </mesh>
    </group>
  );
}

// Bench
function Bench({ position, rotation = 0 }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[0.4, 0.03, 0.12]} />
        <meshStandardMaterial color="#6a4020" roughness={0.8} />
      </mesh>
      {[-0.16, 0.16].map((x, i) => (
        <mesh key={i} position={[x, 0.06, 0]}>
          <boxGeometry args={[0.03, 0.12, 0.12]} />
          <meshStandardMaterial color="#555" metalness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

// Paved road with center dashes
function PavedRoad({ from, to, width = 0.7 }) {
  const dx = to[0] - from[0], dz = to[1] - from[1];
  const len = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dx, dz);
  const cx = (from[0] + to[0]) / 2, cz = (from[1] + to[1]) / 2;
  // Dashed center line
  const dashes = [];
  const dashCount = Math.floor(len / 0.8);
  for (let i = 0; i < dashCount; i++) {
    const t = (i + 0.5) / dashCount;
    dashes.push(
      <mesh key={i} position={[from[0] + dx * t, 0.014, from[1] + dz * t]}
        rotation={[-Math.PI / 2, 0, -angle]}>
        <planeGeometry args={[0.03, 0.25]} />
        <meshBasicMaterial color="#555" />
      </mesh>
    );
  }
  return (
    <group>
      {/* Road surface */}
      <mesh position={[cx, 0.013, cz]} rotation={[-Math.PI / 2, 0, -angle]}>
        <planeGeometry args={[width, len]} />
        <meshStandardMaterial color="#2c2c2c" roughness={0.88} metalness={0.05} />
      </mesh>
      {/* Curbs / edges */}
      <mesh position={[cx, 0.014, cz]} rotation={[-Math.PI / 2, 0, -angle]}>
        <planeGeometry args={[width + 0.08, len]} />
        <meshStandardMaterial color="#3a3a3a" roughness={0.85} />
      </mesh>
      {dashes}
    </group>
  );
}

// Walking path — concrete sidewalk
function WalkPath({ from, to }) {
  const dx = to[0] - from[0], dz = to[1] - from[1];
  const len = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dx, dz);
  return (
    <mesh position={[(from[0] + to[0]) / 2, 0.012, (from[1] + to[1]) / 2]}
      rotation={[-Math.PI / 2, 0, -angle]}>
      <planeGeometry args={[0.35, len]} />
      <meshStandardMaterial color="#4a4640" roughness={0.9} />
    </mesh>
  );
}

// Zone label
function ZoneLabel({ position, label, count, color, totalPower }) {
  return (
    <Html position={position} center distanceFactor={28} style={{ pointerEvents: "none" }}>
      <div style={{
        background: `${color}15`, border: `1px solid ${color}44`,
        borderRadius: 8, padding: "8px 14px", textAlign: "center",
        fontFamily: "system-ui, sans-serif",
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color, letterSpacing: 0.5 }}>{label}</div>
        <div style={{ fontSize: 10, color: "#6b7080", marginTop: 2 }}>
          {count} buildings &middot; {(totalPower / 1000).toFixed(1)}k kW
        </div>
      </div>
    </Html>
  );
}

// Central campus quad (grass area) — brighter green
function CampusQuad({ center, size }) {
  return (
    <group>
      <mesh position={[center[0], 0.01, center[1]]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={size} />
        <meshStandardMaterial color="#1e4a1c" roughness={0.92} metalness={0} />
      </mesh>
      {/* Concrete path border */}
      <mesh position={[center[0], 0.012, center[1]]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[Math.min(size[0], size[1]) / 2 - 0.08, Math.min(size[0], size[1]) / 2 + 0.04, 32]} />
        <meshStandardMaterial color="#3a3a36" roughness={0.85} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// Parking lot with lane markings
function ParkingLot({ center, size }) {
  const stripes = [];
  const count = Math.floor(size[0] / 0.5);
  for (let i = 0; i < count; i++) {
    stripes.push(
      <mesh key={i} position={[center[0] - size[0] / 2 + (i + 0.5) * (size[0] / count), 0.009, center[1]]}
        rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.04, size[1] * 0.6]} />
        <meshBasicMaterial color="#444" />
      </mesh>
    );
  }
  return (
    <group>
      <mesh position={[center[0], 0.008, center[1]]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={size} />
        <meshStandardMaterial color="#222222" roughness={0.9} metalness={0.05} />
      </mesh>
      {stripes}
    </group>
  );
}

// Campus HUD
function CampusHUD({ stats }) {
  return (
    <Html position={[-24, 12, -18]} style={{ pointerEvents: "none" }}>
      <div style={{
        background: "rgba(10,12,16,0.9)", border: "1px solid #1e2230",
        borderRadius: 10, padding: "14px 18px", width: 210,
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

// ─── Full scene ──────────────────────────────────────────────────────

function CampusScene({ buildings, selectedId, hoveredId, onSelectBuilding, onHoverBuilding, showLabels }) {
  // Generate trees along paths and in quads
  const trees = useMemo(() => {
    const t = []; const tr = seededRandom(77);
    // Trees along roads
    for (let x = -18; x <= 22; x += 2.5) { t.push([x + (tr() - 0.5) * 0.4, 0, -0.5 + (tr() - 0.5) * 0.3]); }
    for (let z = -14; z <= 26; z += 2.5) { t.push([-1.5 + (tr() - 0.5) * 0.3, 0, z + (tr() - 0.5) * 0.4]); }
    // Extra trees in green areas
    for (let i = 0; i < 40; i++) { t.push([tr() * 52 - 22, 0, tr() * 46 - 16]); }
    return t.filter(tp => !buildings.some(b =>
      Math.abs(tp[0] - b.gridX) < 1.8 && Math.abs(tp[2] - b.gridZ) < 1.8
    ));
  }, [buildings]);

  const pines = useMemo(() => {
    const t = []; const tr = seededRandom(200);
    for (let i = 0; i < 25; i++) { t.push([tr() * 52 - 22, 0, tr() * 46 - 16]); }
    return t.filter(tp => !buildings.some(b =>
      Math.abs(tp[0] - b.gridX) < 1.8 && Math.abs(tp[2] - b.gridZ) < 1.8
    ));
  }, [buildings]);

  const lamps = useMemo(() => {
    const l = [];
    // Along main east-west road
    for (let x = -16; x <= 20; x += 4) { l.push([x, 0, 0.8]); l.push([x, 0, -0.8]); }
    // Along main north-south road
    for (let z = -13; z <= 25; z += 4) { l.push([-0.8, 0, z]); l.push([0.8, 0, z]); }
    return l;
  }, []);

  const benches = useMemo(() => {
    const b = []; const br = seededRandom(555);
    for (let i = 0; i < 12; i++) {
      b.push({ pos: [br() * 30 - 12, 0, br() * 30 - 8], rot: br() * Math.PI });
    }
    return b;
  }, []);

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
      camera={{ position: [30, 20, 30], fov: 42 }}
      style={{ height: "100%", background: "#060810" }}
      shadows
      onPointerMissed={() => onSelectBuilding(null)}
    >
      <color attach="background" args={["#080c14"]} />
      <fog attach="fog" args={["#080c14", 50, 95]} />

      {/* Lighting — brighter, more contrast */}
      <ambientLight intensity={0.45} />
      <directionalLight position={[20, 28, 15]} intensity={1.0} castShadow color="#fff8ee"
        shadow-mapSize={[2048, 2048]} shadow-camera-far={70}
        shadow-camera-left={-35} shadow-camera-right={35}
        shadow-camera-top={35} shadow-camera-bottom={-35}
      />
      <directionalLight position={[-15, 12, -8]} intensity={0.25} color="#8899bb" />
      <pointLight position={[-18, 6, -12]} intensity={0.3} color="#6688cc" distance={30} />
      <pointLight position={[18, 6, 22]} intensity={0.2} color="#cc9944" distance={30} />
      <pointLight position={[0, 10, 5]} intensity={0.25} color="#aabbdd" distance={40} />
      <hemisphereLight intensity={0.25} color="#99bbdd" groundColor="#2a2010" />

      {/* Ground plane — richer dark green-brown */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 5]} receiveShadow>
        <planeGeometry args={[70, 60]} />
        <meshStandardMaterial color="#121e12" roughness={0.92} metalness={0} />
      </mesh>

      {/* Campus quads — green spaces */}
      <CampusQuad center={[-1, -6]} size={[7, 7]} />
      <CampusQuad center={[5, 14]} size={[5, 5]} />
      <CampusQuad center={[15, 0]} size={[5, 5]} />
      <CampusQuad center={[-8, 15]} size={[5, 4]} />
      <CampusQuad center={[8, -6]} size={[3, 3]} />

      {/* Central fountain in main quad */}
      <group position={[-1, 0, -6]}>
        <mesh position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.6, 0.7, 0.12, 16]} />
          <meshStandardMaterial color="#4a6070" metalness={0.4} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.55, 16]} />
          <meshStandardMaterial color="#2244667" metalness={0.6} roughness={0.2}
            emissive="#224466" emissiveIntensity={0.15} />
        </mesh>
        <mesh position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.06, 0.08, 0.3, 8]} />
          <meshStandardMaterial color="#667788" metalness={0.5} roughness={0.4} />
        </mesh>
      </group>

      {/* Campus entrance sign */}
      <group position={[-20, 0, -16]}>
        <mesh position={[0, 0.4, 0]}>
          <boxGeometry args={[2.5, 0.8, 0.1]} />
          <meshStandardMaterial color="#1a2030" metalness={0.3} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.4, 0.06]}>
          <planeGeometry args={[2.3, 0.6]} />
          <meshStandardMaterial color="#daa520" emissive="#daa520" emissiveIntensity={0.3} />
        </mesh>
        {/* Supports */}
        {[-0.9, 0.9].map((x, i) => (
          <mesh key={i} position={[x, 0.2, 0]}>
            <boxGeometry args={[0.06, 0.4, 0.08]} />
            <meshStandardMaterial color="#2a2a2a" />
          </mesh>
        ))}
      </group>

      {/* Parking lots */}
      <ParkingLot center={[22, -14]} size={[4, 6]} />
      <ParkingLot center={[-18, 16]} size={[3, 4]} />
      <ParkingLot center={[8, -14]} size={[3, 3]} />

      {/* Main roads */}
      <PavedRoad from={[-22, 0]} to={[26, 0]} width={0.8} />
      <PavedRoad from={[0, -18]} to={[0, 30]} width={0.8} />
      {/* Secondary roads */}
      <PavedRoad from={[-18, -8]} to={[8, -8]} width={0.5} />
      <PavedRoad from={[10, -15]} to={[10, 2]} width={0.5} />
      <PavedRoad from={[-14, 0]} to={[-14, 18]} width={0.5} />
      <PavedRoad from={[-18, 18]} to={[2, 18]} width={0.5} />
      <PavedRoad from={[8, 2]} to={[22, 2]} width={0.5} />

      {/* Walking paths — connecting buildings to roads */}
      <WalkPath from={[-6, -6]} to={[4, -6]} />
      <WalkPath from={[-1, -9]} to={[-1, -3]} />
      <WalkPath from={[-1, 1]} to={[-1, 6]} />
      <WalkPath from={[5, 8]} to={[5, 18]} />
      <WalkPath from={[-8, 8]} to={[-8, 16]} />
      <WalkPath from={[14, -8]} to={[20, -8]} />
      <WalkPath from={[3, -6]} to={[3, 0]} />
      <WalkPath from={[-5, -6]} to={[-5, -12]} />
      <WalkPath from={[15, 2]} to={[15, 8]} />
      <WalkPath from={[-10, 0]} to={[-10, 8]} />
      <WalkPath from={[6, 0]} to={[10, 0]} />
      <WalkPath from={[-18, -6]} to={[-14, -6]} />

      {/* Zone labels */}
      <ZoneLabel position={[-8, 5.5, -14.5]} label="RESEARCH LABS" count={20}
        color="#e74c3c" totalPower={zoneStats["Research Lab"]?.power || 0} />
      <ZoneLabel position={[4, 5.5, -0.5]} label="ACADEMIC" count={60}
        color="#3498db" totalPower={zoneStats["Academic"]?.power || 0} />
      <ZoneLabel position={[17, 5.5, -14.5]} label="RESIDENCES" count={25}
        color="#2ecc71" totalPower={zoneStats["Residence"]?.power || 0} />
      <ZoneLabel position={[-5, 5.5, 27]} label="ATHLETICS" count={15}
        color="#f39c12" totalPower={zoneStats["Athletic"]?.power || 0} />

      {/* Trees */}
      {trees.map((p, i) => <Tree key={`t${i}`} position={p} scale={0.7 + (i % 3) * 0.2} />)}
      {pines.map((p, i) => <PineTree key={`p${i}`} position={p} scale={0.8 + (i % 3) * 0.15} />)}

      {/* Lamp posts */}
      {lamps.map((p, i) => <LampPost key={i} position={p} />)}

      {/* Benches */}
      {benches.map((b, i) => <Bench key={i} position={b.pos} rotation={b.rot} />)}

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

      {/* HUD */}
      <CampusHUD stats={campusStats} />

      <OrbitControls
        enablePan enableZoom enableRotate
        maxPolarAngle={Math.PI / 2.15}
        minDistance={8} maxDistance={60}
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
  const [proxyEnabled, setProxyEnabled] = useState(true);

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

  // ── With vs Without proxy metrics ──
  const meteredOnly = useMemo(() => ALL_BUILDINGS.filter(b => b.metered_status === "existing"), []);
  const withProxy = useMemo(() => ({
    monitored: 120,
    monitoredLabel: "50 metered + 70 proxy",
    power: CAMPUS_POWER,
    dailyCost: Math.round(CAMPUS_POWER * 24 * 0.13),
    alertsFound: 4,
    wasteFound: 330000,
    annualSavings: 330000,
    accuracy: "R² = 0.99",
    visibility: "100%",
    investmentCost: 2800000,
    payback: "22 months",
    roi5yr: 15000000,
  }), []);
  const withoutProxy = useMemo(() => ({
    monitored: 30,
    monitoredLabel: "30 metered only",
    power: Math.round(meteredOnly.reduce((s, b) => s + getBuildingData(b).currentPower, 0) * (120 / 30)),
    dailyCost: Math.round(meteredOnly.reduce((s, b) => s + getBuildingData(b).currentPower, 0) * (120 / 30) * 24 * 0.13),
    alertsFound: 1,
    wasteFound: 62000,
    annualSavings: 0,
    accuracy: "N/A",
    visibility: "25%",
    investmentCost: 0,
    payback: "N/A",
    roi5yr: 0,
  }), [meteredOnly]);
  const current = proxyEnabled ? withProxy : withoutProxy;

  return (
    <div style={S.page}>
      {/* ── HEADER ── */}
      <div style={S.header}>
        <div style={S.container}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={S.headerTitle}>GRIDMIND CAMPUS MONITOR</div>
              <div style={S.headerSub}>MSU Energy Intelligence Platform &middot; Real-time ML Proxy Metering</div>
            </div>
            {/* ── PROXY TOGGLE ── */}
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              background: "#12151e", border: "1px solid #1e2230", borderRadius: 8,
              padding: "8px 16px",
            }}>
              <span style={{ fontSize: 11, color: "#6b7080", fontFamily: "system-ui, sans-serif" }}>
                Proxy Metering
              </span>
              <button onClick={() => setProxyEnabled(!proxyEnabled)} style={{
                width: 48, height: 26, borderRadius: 13, border: "none", cursor: "pointer",
                background: proxyEnabled
                  ? "linear-gradient(90deg, #27ae60, #2ecc71)"
                  : "#2a2a2a",
                position: "relative", transition: "background 0.3s",
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: "50%", background: "#fff",
                  position: "absolute", top: 3,
                  left: proxyEnabled ? 25 : 3,
                  transition: "left 0.3s", boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                }} />
              </button>
              <span style={{
                fontSize: 11, fontWeight: 600,
                color: proxyEnabled ? "#27ae60" : "#e74c3c",
              }}>
                {proxyEnabled ? "ON" : "OFF"}
              </span>
            </div>
          </div>

          <div style={S.metricsRow}>
            <MetricCard label="Total Power Now" value={`${current.power.toLocaleString()} kW`} />
            <MetricCard label="Today's Est. Cost" value={`$${current.dailyCost.toLocaleString()}`} accent="#27ae60" />
            <MetricCard label="Model Accuracy" value={proxyEnabled ? "R² = 0.99" : "N/A"}
              badge={proxyEnabled ? { text: "validated", color: "#27ae60" } : { text: "no model", color: "#e74c3c" }} />
            <MetricCard label="Monitored" value={String(current.monitored)}
              badge={{ text: current.monitoredLabel, color: proxyEnabled ? "#3498db" : "#e74c3c" }} />
            <MetricCard label="Alerts Found" value={String(current.alertsFound)}
              accent={current.alertsFound > 1 ? "#27ae60" : "#e74c3c"}
              badge={proxyEnabled ? { text: "ML-detected", color: "#27ae60" } : undefined} />
            <MetricCard label="Campus Visibility" value={current.visibility}
              accent={proxyEnabled ? "#27ae60" : "#e74c3c"} />
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
        {/* ── PROXY vs NO-PROXY COMPARISON PANEL ── */}
        <div style={S.section}>
          <div style={S.sectionTitle}>
            <span style={{ color: proxyEnabled ? "#27ae60" : "#e74c3c" }}>&#9632;</span>
            {proxyEnabled ? "With Proxy Metering System" : "Without Proxy Metering"}
            <span style={{
              fontSize: 11, marginLeft: "auto", padding: "4px 12px", borderRadius: 5,
              background: proxyEnabled ? "#27ae6022" : "#e74c3c22",
              color: proxyEnabled ? "#27ae60" : "#e74c3c",
              border: `1px solid ${proxyEnabled ? "#27ae6044" : "#e74c3c44"}`,
              fontFamily: "'SF Mono', monospace",
            }}>
              Toggle above to compare
            </span>
          </div>

          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20,
          }}>
            {/* LEFT: Side-by-side comparison table */}
            <div style={{
              background: "#12151e", border: "1px solid #1e2230", borderRadius: 10, padding: 20,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#e8eaf0", marginBottom: 14,
                fontFamily: "system-ui, sans-serif" }}>
                System Comparison
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ ...S.th, width: "40%" }}>Metric</th>
                    <th style={{ ...S.th, color: "#e74c3c" }}>Without Proxy</th>
                    <th style={{ ...S.th, color: "#27ae60" }}>With Proxy</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Buildings Monitored", "30 (25%)", "120 (100%)", true],
                    ["Campus Visibility", "25%", "100%", true],
                    ["Anomalies Detectable", "~1 (metered only)", "4 (all buildings)", true],
                    ["Annual Waste Found", "$62,000", "$330,000", true],
                    ["Prediction Accuracy", "None", "R² = 0.99", true],
                    ["Unmetered Insight", "Monthly bills only", "Hourly estimates ±14%", true],
                    ["Alert Response Time", "Quarterly review", "Real-time", true],
                    ["Data Granularity", "Monthly kWh", "Hourly kW + sensors", true],
                  ].map(([metric, without, withP, better], i) => (
                    <tr key={i} style={{
                      background: !proxyEnabled && i % 2 === 0 ? "#e74c3c08" :
                        proxyEnabled && i % 2 === 0 ? "#27ae6008" : "transparent",
                    }}>
                      <td style={{ ...S.td, color: "#c0c4d0", fontWeight: 500 }}>{metric}</td>
                      <td style={{
                        ...S.td, color: !proxyEnabled ? "#e8eaf0" : "#6b7080",
                        fontWeight: !proxyEnabled ? 700 : 400,
                        background: !proxyEnabled ? "#e74c3c11" : "transparent",
                      }}>{without}</td>
                      <td style={{
                        ...S.td, color: proxyEnabled ? "#e8eaf0" : "#6b7080",
                        fontWeight: proxyEnabled ? 700 : 400,
                        background: proxyEnabled ? "#27ae6011" : "transparent",
                      }}>{withP}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* RIGHT: Cost-benefit analysis */}
            <div style={{
              background: "#12151e", border: "1px solid #1e2230", borderRadius: 10, padding: 20,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#e8eaf0", marginBottom: 14,
                fontFamily: "system-ui, sans-serif" }}>
                Cost &amp; Benefits (5-Year Outlook)
              </div>

              {/* Investment */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "#6b7080", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                  Investment
                </div>
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
                }}>
                  <div style={{ background: "#0d1117", borderRadius: 6, padding: 12 }}>
                    <div style={{ fontSize: 10, color: "#6b7080" }}>20 New Smart Meters</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#e8eaf0" }}>$1.8M</div>
                  </div>
                  <div style={{ background: "#0d1117", borderRadius: 6, padding: 12 }}>
                    <div style={{ fontSize: 10, color: "#6b7080" }}>ML Platform + Integration</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#e8eaf0" }}>$1.0M</div>
                  </div>
                </div>
                <div style={{
                  marginTop: 8, padding: "8px 12px", borderRadius: 6,
                  background: "#0d1117", display: "flex", justifyContent: "space-between",
                }}>
                  <span style={{ color: "#6b7080", fontSize: 12 }}>Total Investment</span>
                  <span style={{ color: "#e74c3c", fontSize: 16, fontWeight: 700 }}>$2.8M</span>
                </div>
              </div>

              {/* Returns */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "#6b7080", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                  Annual Returns
                </div>
                {[
                  ["Waste elimination (4 buildings)", "$330K", "#27ae60"],
                  ["HVAC optimization campus-wide", "$1.2M", "#27ae60"],
                  ["Preventive maintenance savings", "$450K", "#27ae60"],
                  ["Demand response & peak shaving", "$520K", "#3498db"],
                ].map(([label, val, color], i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", padding: "5px 0",
                    borderBottom: "1px solid #111520", fontSize: 12,
                  }}>
                    <span style={{ color: "#c0c4d0" }}>{label}</span>
                    <span style={{ color, fontWeight: 600 }}>{val}</span>
                  </div>
                ))}
                <div style={{
                  marginTop: 6, padding: "8px 12px", borderRadius: 6,
                  background: "#27ae6015", border: "1px solid #27ae6033",
                  display: "flex", justifyContent: "space-between",
                }}>
                  <span style={{ color: "#27ae60", fontSize: 12, fontWeight: 600 }}>Total Annual Savings</span>
                  <span style={{ color: "#27ae60", fontSize: 16, fontWeight: 700 }}>$2.5M/yr</span>
                </div>
              </div>

              {/* Key metrics */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[
                  ["Payback", "22 mo", "#daa520"],
                  ["5-Year ROI", "$15M", "#27ae60"],
                  ["IRR", "45-55%", "#3498db"],
                ].map(([label, val, color], i) => (
                  <div key={i} style={{
                    background: "#0d1117", borderRadius: 6, padding: "10px 8px", textAlign: "center",
                  }}>
                    <div style={{ fontSize: 9, color: "#6b7080", textTransform: "uppercase" }}>{label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color, marginTop: 2 }}>{val}</div>
                  </div>
                ))}
              </div>

              {/* Year-by-year cumulative */}
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, color: "#6b7080", marginBottom: 6 }}>Cumulative Net Value</div>
                <ResponsiveContainer width="100%" height={90}>
                  <BarChart data={[
                    { year: "Y1", value: -1000000, label: "-$1.0M" },
                    { year: "Y2", value: 2100000, label: "+$2.1M" },
                    { year: "Y3", value: 5100000, label: "+$5.1M" },
                    { year: "Y4", value: 8500000, label: "+$8.5M" },
                    { year: "Y5", value: 15000000, label: "+$15M" },
                  ]} margin={{ left: 0, right: 0, top: 5, bottom: 0 }}>
                    <XAxis dataKey="year" tick={{ fill: "#6b7080", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={0} stroke="#333" />
                    <Bar dataKey="value" name="Net Value ($)" radius={[3, 3, 0, 0]}>
                      {[
                        { value: -1000000 },
                        { value: 2100000 },
                        { value: 5100000 },
                        { value: 8500000 },
                        { value: 15000000 },
                      ].map((d, i) => (
                        <Cell key={i} fill={d.value < 0 ? "#e74c3c" : "#27ae60"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ textAlign: "center", fontSize: 10, color: "#6b7080", marginTop: 2 }}>
                  Breakeven at Year 2 &middot; $15M net value by Year 5
                </div>
              </div>
            </div>
          </div>

          {/* Without-proxy warning banner (shows when toggled off) */}
          {!proxyEnabled && (
            <div style={{
              marginTop: 16, padding: "16px 20px", borderRadius: 8,
              background: "#e74c3c11", border: "1px solid #e74c3c33",
              display: "flex", gap: 16, alignItems: "center",
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: "50%", background: "#e74c3c22",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, flexShrink: 0,
              }}>
                &#9888;
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#e74c3c", fontFamily: "system-ui, sans-serif" }}>
                  70 Buildings Are Invisible
                </div>
                <div style={{ fontSize: 12, color: "#c0c4d0", marginTop: 4, lineHeight: 1.5 }}>
                  Without proxy metering, 70 buildings (58% of campus) have <strong>no hourly data</strong>.
                  Energy waste goes undetected. You only see monthly utility bills — by then, a stuck valve
                  has already wasted $12,000. The ML proxy system provides <strong>hourly estimates ±14%</strong> for
                  every building, enabling real-time anomaly detection across the entire campus.
                </div>
              </div>
            </div>
          )}

          {proxyEnabled && (
            <div style={{
              marginTop: 16, padding: "16px 20px", borderRadius: 8,
              background: "#27ae6011", border: "1px solid #27ae6033",
              display: "flex", gap: 16, alignItems: "center",
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: "50%", background: "#27ae6022",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, flexShrink: 0, color: "#27ae60",
              }}>
                &#10003;
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#27ae60", fontFamily: "system-ui, sans-serif" }}>
                  Full Campus Visibility Active
                </div>
                <div style={{ fontSize: 12, color: "#c0c4d0", marginTop: 4, lineHeight: 1.5 }}>
                  All 120 buildings monitored. ML model predicts hourly energy for 70 unmetered buildings
                  with <strong>R² = 0.99 accuracy</strong>. 4 anomalies detected, <strong>$330K/year</strong> in
                  waste identified. System pays for itself in <strong>22 months</strong>.
                </div>
              </div>
            </div>
          )}
        </div>

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
