#!/usr/bin/env python3
"""
MSU Campus Energy Data Generator
Generates realistic synthetic sensor data for 120 campus buildings.
"""

import numpy as np
import pandas as pd
import json
import os
from datetime import datetime, timedelta

np.random.seed(42)

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
os.makedirs(DATA_DIR, exist_ok=True)

# ─── Building Definitions ─────────────────────────────────────────────

LAB_NAMES = [
    "Chemistry Lab", "Physics Research", "Bio Sciences", "Materials Science",
    "Computer Science Lab", "Geology Research", "Environmental Science",
    "Mech Engineering Lab", "Electrical Engineering Lab", "Chemical Engineering",
    "Pharma Research", "Neuroscience Lab", "Agricultural Research",
    "Nanotech Center", "Robotics Lab", "Optics Research",
    "Plasma Physics Lab", "Genetics Lab", "Molecular Biology", "Data Science Lab",
]

RESIDENCE_NAMES = [
    "North Residence", "South Residence", "East Dorm", "West Hall",
    "Maple Court", "Oak Residence", "Cedar Hall", "Elm Dormitory",
    "Pine Lodge", "Birch Residence", "Aspen Hall", "Willow Dorm",
    "Juniper Residence", "Spruce Hall", "Hawthorn Lodge", "Magnolia Court",
    "Dogwood Residence", "Chestnut Hall", "Hickory Dorm", "Walnut Residence",
    "Ivy Hall", "Laurel Court", "Poplar Residence", "Sycamore Dorm",
    "Sequoia Hall",
]

ATHLETIC_NAMES = [
    "Main Field House", "Aquatic Center", "Ice Arena", "Football Stadium",
    "Basketball Pavilion", "Tennis Center", "Track & Field Complex",
    "Gymnastics Center", "Wrestling Arena", "Baseball Stadium",
    "Volleyball Center", "Soccer Complex", "Rowing Boathouse",
    "Recreation Center", "Fitness Pavilion",
]


def generate_buildings():
    buildings = []
    # Campus grid coordinates (fake but plausible)
    base_lat, base_lng = 42.7325, -84.4822

    # ── Research Labs (20) ──
    for i in range(20):
        sqft = np.random.randint(35000, 85001)
        age = np.random.randint(5, 56)
        metered = i < 10
        new_meter = not metered and i < 16
        buildings.append({
            "id": f"LAB-{i+1:02d}",
            "name": LAB_NAMES[i],
            "type": "Research Lab",
            "sqft": int(sqft),
            "age_years": int(age),
            "avg_annual_kwh": 4_900_000,
            "metered": metered or new_meter,
            "metered_status": "existing" if metered else ("new" if new_meter else "proxy"),
            "lat": round(base_lat + np.random.uniform(-0.008, 0.008), 6),
            "lng": round(base_lng + np.random.uniform(-0.008, 0.008), 6),
        })

    # ── Academic Buildings (60) ──
    for i in range(60):
        sqft = np.random.randint(15000, 50001)
        age = np.random.randint(10, 66)
        metered = i < 12
        new_meter = not metered and i < 20
        letter = ""
        idx = i
        while True:
            letter = chr(65 + idx % 26) + letter
            idx = idx // 26 - 1
            if idx < 0:
                break
        buildings.append({
            "id": f"ACA-{i+1:02d}",
            "name": f"Academic Hall {letter}",
            "type": "Academic",
            "sqft": int(sqft),
            "age_years": int(age),
            "avg_annual_kwh": 1_200_000,
            "metered": metered or new_meter,
            "metered_status": "existing" if metered else ("new" if new_meter else "proxy"),
            "lat": round(base_lat + np.random.uniform(-0.012, 0.012), 6),
            "lng": round(base_lng + np.random.uniform(-0.012, 0.012), 6),
        })

    # ── Residence Halls (25) ──
    for i in range(25):
        sqft = np.random.randint(25000, 60001)
        age = np.random.randint(8, 51)
        metered = i < 5
        new_meter = not metered and i < 9
        buildings.append({
            "id": f"RES-{i+1:02d}",
            "name": RESIDENCE_NAMES[i],
            "type": "Residence",
            "sqft": int(sqft),
            "age_years": int(age),
            "avg_annual_kwh": 1_800_000,
            "metered": metered or new_meter,
            "metered_status": "existing" if metered else ("new" if new_meter else "proxy"),
            "lat": round(base_lat + np.random.uniform(-0.010, 0.010), 6),
            "lng": round(base_lng + np.random.uniform(-0.010, 0.010), 6),
        })

    # ── Athletic Facilities (15) ──
    for i in range(15):
        sqft = np.random.randint(30000, 100001)
        age = np.random.randint(5, 41)
        metered = i < 3
        new_meter = not metered and i < 5
        buildings.append({
            "id": f"ATH-{i+1:02d}",
            "name": ATHLETIC_NAMES[i],
            "type": "Athletic",
            "sqft": int(sqft),
            "age_years": int(age),
            "avg_annual_kwh": 2_500_000,
            "metered": metered or new_meter,
            "metered_status": "existing" if metered else ("new" if new_meter else "proxy"),
            "lat": round(base_lat + np.random.uniform(-0.006, 0.006), 6),
            "lng": round(base_lng + np.random.uniform(-0.006, 0.006), 6),
        })

    return buildings


# ─── Weather Generation ───────────────────────────────────────────────

def generate_weather(n_hours=168, start_month=1):
    """Generate hourly weather for n_hours starting from a winter week."""
    timestamps = []
    temps = []
    humidities = []
    wind_speeds = []
    solar_rads = []

    start = datetime(2024, start_month, 15, 0, 0)  # mid-January start for demo week

    for h in range(n_hours):
        t = start + timedelta(hours=h)
        timestamps.append(t.isoformat())

        day_of_year = t.timetuple().tm_yday
        hour = t.hour

        # Annual temperature cycle (Midwest)
        annual_component = 50 + 30 * np.sin(2 * np.pi * (day_of_year - 80) / 365)
        daily_component = 10 * np.sin(2 * np.pi * (hour - 6) / 24)
        noise = np.random.normal(0, 3)
        temp = annual_component + daily_component + noise
        temps.append(round(temp, 1))

        # Humidity: higher in summer, correlated with temp
        base_humidity = 55 + 15 * np.sin(2 * np.pi * (day_of_year - 80) / 365)
        humidity = np.clip(base_humidity + np.random.normal(0, 8), 25, 95)
        humidities.append(round(humidity, 1))

        # Wind
        wind = max(0, 8 + np.random.normal(0, 4))
        wind_speeds.append(round(wind, 1))

        # Solar radiation (0 at night)
        if 7 <= hour <= 18:
            solar = max(0, 400 * np.sin(np.pi * (hour - 6) / 13) + np.random.normal(0, 50))
        else:
            solar = 0
        solar_rads.append(round(solar, 1))

    return pd.DataFrame({
        "timestamp": timestamps,
        "outdoor_temp_f": temps,
        "humidity_pct": humidities,
        "wind_speed_mph": wind_speeds,
        "solar_radiation": solar_rads,
    })


# ─── Occupancy Profiles ──────────────────────────────────────────────

def get_occupancy(building_type, hour, is_weekend):
    """Return occupancy fraction 0-1 based on building type, hour, weekend."""
    if building_type == "Research Lab":
        if is_weekend:
            return 0.10 + np.random.uniform(0, 0.10)
        if 8 <= hour <= 18:
            return 0.50 + np.random.uniform(0, 0.25)
        if 18 < hour <= 22:
            return 0.15 + np.random.uniform(0, 0.15)
        return 0.05 + np.random.uniform(0, 0.05)

    if building_type == "Academic":
        if is_weekend:
            return 0.03 + np.random.uniform(0, 0.05)
        if 8 <= hour <= 17:
            return 0.60 + np.random.uniform(0, 0.30)
        if 17 < hour <= 21:
            return 0.08 + np.random.uniform(0, 0.08)
        return 0.02 + np.random.uniform(0, 0.02)

    if building_type == "Residence":
        if is_weekend:
            return 0.55 + np.random.uniform(0, 0.20)
        if 8 <= hour <= 17:
            return 0.25 + np.random.uniform(0, 0.20)
        if 17 < hour <= 23:
            return 0.65 + np.random.uniform(0, 0.20)
        return 0.80 + np.random.uniform(0, 0.15)

    # Athletic
    if is_weekend:
        return 0.40 + np.random.uniform(0, 0.30)
    if 8 <= hour <= 17:
        return 0.35 + np.random.uniform(0, 0.25)
    if 17 < hour <= 22:
        return 0.50 + np.random.uniform(0, 0.30)  # evening events
    return 0.03 + np.random.uniform(0, 0.03)


# ─── Energy Calculation ──────────────────────────────────────────────

# Anomalous buildings: these will have elevated consumption
ANOMALOUS_IDS = {"LAB-07", "LAB-14", "ATH-03", "RES-12"}

# Degradation buildings: energy increases over the week (simulating months)
DEGRADATION_IDS = {"LAB-07", "ATH-03"}


def calculate_energy(building, hour_idx, outdoor_temp, occupancy):
    """Calculate HVAC, lighting, equipment loads for one hour."""
    sqft = building["sqft"]
    age = building["age_years"]
    btype = building["type"]
    bid = building["id"]

    age_factor = 1 + age / 120  # older buildings less efficient

    # Anomaly multiplier
    anomaly_mult = 1.0
    if bid in ANOMALOUS_IDS:
        anomaly_mult = 1.25 + np.random.uniform(0, 0.10)

    # Degradation: simulate slow increase over the sample week
    degrade_mult = 1.0
    if bid in DEGRADATION_IDS:
        degrade_mult = 1.0 + 0.002 * hour_idx  # ~33% increase over 168 hrs

    # ── HVAC ──
    hvac = 0.0
    if outdoor_temp > 70:
        hvac = sqft * 0.001 * (outdoor_temp - 70) * age_factor
    elif outdoor_temp < 65:
        hvac = sqft * 0.0008 * (65 - outdoor_temp) * age_factor

    # ── Lighting ──
    hour_of_day = hour_idx % 24
    dark_bonus = 1.3 if (hour_of_day < 7 or hour_of_day > 18) else 0.8
    lighting = sqft * 0.002 * max(occupancy, 0.05) * dark_bonus

    # ── Equipment ──
    if btype == "Research Lab":
        base_equip = sqft * 0.012
        equipment = base_equip * (0.7 + 0.3 * occupancy) + np.random.uniform(-10, 10)
    elif btype == "Academic":
        equipment = sqft * 0.003 * (0.2 + 0.8 * occupancy) + np.random.uniform(-3, 3)
    elif btype == "Residence":
        equipment = sqft * 0.005 * (0.4 + 0.6 * occupancy) + np.random.uniform(-5, 5)
    else:  # Athletic
        # Pool pump / ice rink constant loads
        base = sqft * 0.004
        event_spike = sqft * 0.003 * occupancy if occupancy > 0.5 else 0
        equipment = base + event_spike + np.random.uniform(-8, 8)

    total = (hvac + lighting + equipment) * anomaly_mult * degrade_mult
    noise = total * np.random.uniform(-0.05, 0.05)
    total = max(10, total + noise)

    return {
        "hvac_load_kw": round(hvac, 1),
        "lighting_kw": round(lighting, 1),
        "equipment_kw": round(max(0, equipment), 1),
        "power_kw": round(total, 1),
    }


# ─── Sensor Generation ───────────────────────────────────────────────

def generate_sensors(building, power_kw, occupancy, outdoor_temp):
    """Generate additional sensor readings for metered buildings."""
    sensors = {
        "supply_air_temp_f": round(55 + np.random.uniform(0, 8), 1),
        "return_air_temp_f": round(68 + np.random.uniform(0, 8), 1),
        "zone_temp_f": round(70 + np.random.uniform(-2, 3), 1),
        "co2_ppm": int(400 + occupancy * 600 + np.random.normal(0, 30)),
    }
    if building["type"] == "Research Lab":
        # Occasional VOC spikes
        if np.random.random() < 0.04:
            sensors["voc_ppb"] = int(150 + np.random.uniform(0, 350))
        else:
            sensors["voc_ppb"] = int(np.random.uniform(0, 50))
        sensors["ventilation_ach"] = round(
            (8 + np.random.uniform(0, 4)) if occupancy > 0.3 else (2 + np.random.uniform(0, 2)), 1
        )
        sensors["fume_hood_cfm"] = int(np.random.uniform(50, 600) * occupancy + 20)
    return sensors


# ─── Main Generation ─────────────────────────────────────────────────

def main():
    print("Generating MSU campus energy data for 120 buildings...")

    buildings = generate_buildings()
    weather = generate_weather(n_hours=168, start_month=1)

    metered_buildings = [b for b in buildings if b["metered_status"] in ("existing", "new")]
    unmetered_buildings = [b for b in buildings if b["metered_status"] == "proxy"]

    print(f"  Buildings: {len(buildings)} total")
    print(f"  Metered (existing): {sum(1 for b in buildings if b['metered_status'] == 'existing')}")
    print(f"  Metered (new):      {sum(1 for b in buildings if b['metered_status'] == 'new')}")
    print(f"  Proxy (unmetered):  {sum(1 for b in buildings if b['metered_status'] == 'proxy')}")

    # ── Generate metered hourly data ──
    print("Generating hourly data for metered buildings...")
    metered_rows = []
    for b in metered_buildings:
        for h in range(168):
            w = weather.iloc[h]
            hour_of_day = h % 24
            day_of_week = h // 24
            is_weekend = day_of_week >= 5

            occ = get_occupancy(b["type"], hour_of_day, is_weekend)
            energy = calculate_energy(b, h, w["outdoor_temp_f"], occ)
            sensors = generate_sensors(b, energy["power_kw"], occ, w["outdoor_temp_f"])

            row = {
                "building_id": b["id"],
                "timestamp": w["timestamp"],
                "hour": h,
                "hour_of_day": hour_of_day,
                "day_of_week": day_of_week,
                "month": 1,
                "is_weekend": is_weekend,
                "outdoor_temp_f": w["outdoor_temp_f"],
                "humidity_pct": w["humidity_pct"],
                "occupancy_pct": round(occ * 100, 1),
                **energy,
                **sensors,
            }
            metered_rows.append(row)

    metered_df = pd.DataFrame(metered_rows)
    metered_df.to_csv(os.path.join(DATA_DIR, "metered_hourly.csv"), index=False)
    print(f"  Saved metered_hourly.csv ({len(metered_df)} rows)")

    # ── Generate unmetered monthly data ──
    print("Generating monthly data for unmetered buildings...")
    unmetered_rows = []
    for b in unmetered_buildings:
        # Simulate 12 months of totals
        for month in range(1, 13):
            # Rough monthly estimate based on building characteristics
            base = b["avg_annual_kwh"] / 12
            # Seasonal variation
            season_factor = 1.0 + 0.3 * abs(np.sin(np.pi * (month - 4) / 6))
            # Anomaly
            anomaly = 1.25 if b["id"] in ANOMALOUS_IDS else 1.0
            total = base * season_factor * anomaly * np.random.uniform(0.9, 1.1)
            sqft_ratio = b["sqft"] / (65000 if b["type"] == "Research Lab" else
                                       30000 if b["type"] == "Academic" else
                                       40000 if b["type"] == "Residence" else 60000)
            total *= sqft_ratio

            unmetered_rows.append({
                "building_id": b["id"],
                "month": month,
                "total_kwh": round(total, 0),
                "building_type": b["type"],
                "sqft": b["sqft"],
                "age_years": b["age_years"],
            })

    unmetered_df = pd.DataFrame(unmetered_rows)
    unmetered_df.to_csv(os.path.join(DATA_DIR, "unmetered_monthly.csv"), index=False)
    print(f"  Saved unmetered_monthly.csv ({len(unmetered_df)} rows)")

    # ── Save weather ──
    weather.to_csv(os.path.join(DATA_DIR, "weather.csv"), index=False)
    print(f"  Saved weather.csv ({len(weather)} rows)")

    # ── Save building metadata ──
    with open(os.path.join(DATA_DIR, "buildings.json"), "w") as f:
        json.dump(buildings, f, indent=2)
    print(f"  Saved buildings.json ({len(buildings)} buildings)")

    # ── Summary stats ──
    total_metered_kwh = metered_df["power_kw"].sum()
    avg_power = metered_df.groupby("building_id")["power_kw"].mean()
    print(f"\n  Total metered energy (sample week): {total_metered_kwh:,.0f} kWh")
    print(f"  Avg building power: {avg_power.mean():.0f} kW")
    print(f"  Max building power: {avg_power.max():.0f} kW ({avg_power.idxmax()})")
    print(f"  Min building power: {avg_power.min():.0f} kW ({avg_power.idxmin()})")

    print("\nData generation complete.")


if __name__ == "__main__":
    main()
