#!/usr/bin/env python3
"""Build compact, constituency-scoped timetable replay assets.

The inputs are reviewed one-day GTFS-derived rail, bus and tram snapshots. Output is
static browser data: the published route geometry is clipped once at build time
instead of being filtered or routed by the visitor's browser.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import unicodedata
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CELL = 0.1


def slug(value: str) -> str:
    text = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    text = text.replace("&", " and ").replace("'", "")
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def key(lon: float, lat: float) -> tuple[int, int]:
    return math.floor(lon / CELL), math.floor(lat / CELL)


def visit_bounds(value: object, extent: list[float]) -> None:
    if isinstance(value, list) and value:
        if isinstance(value[0], (int, float)):
            extent[0] = min(extent[0], value[0]); extent[1] = min(extent[1], value[1])
            extent[2] = max(extent[2], value[0]); extent[3] = max(extent[3], value[1])
        else:
            for child in value: visit_bounds(child, extent)


def in_ring(point: list[float], ring: list[list[float]]) -> bool:
    x, y = point[:2]; inside = False
    for index, current in enumerate(ring):
        previous = ring[index - 1]; x1, y1 = current; x2, y2 = previous
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: inside = not inside
    return inside


def contains(point: list[float], geometry: dict) -> bool:
    polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
    return any(in_ring(point, polygon[0]) and not any(in_ring(point, hole) for hole in polygon[1:]) for polygon in polygons)


def build_grid(features: list[dict]) -> tuple[set[str], dict[tuple[int, int], list[dict]]]:
    names, cells = set(), defaultdict(list)
    for feature in features:
        name, geometry = feature.get("properties", {}).get("ENG_NAME_VALUE"), feature.get("geometry", {})
        if not name or geometry.get("type") not in {"Polygon", "MultiPolygon"}: continue
        name = re.sub(r"\s*\(\d+\)\s*$", "", name).strip(); names.add(name)
        extent = [math.inf, math.inf, -math.inf, -math.inf]; visit_bounds(geometry["coordinates"], extent)
        record = {"name": name, "geometry": geometry}
        west, south = key(extent[0], extent[1]); east, north = key(extent[2], extent[3])
        for lon in range(west, east + 1):
            for lat in range(south, north + 1): cells[lon, lat].append(record)
    return names, cells


def clip(trips: list[dict], cells: dict[tuple[int, int], list[dict]]) -> dict[str, list[dict]]:
    output, cache = defaultdict(list), {}
    for trip in trips:
        shape = tuple((point[0], point[1]) for point in trip["points"])
        segments = cache.get(shape)
        if segments is None:
            segments, active = defaultdict(list), {}
            for index, point in enumerate(trip["points"]):
                matching = {record["name"] for record in cells.get(key(point[0], point[1]), []) if contains(point, record["geometry"])}
                for name, start in list(active.items()):
                    if name not in matching:
                        if index - start > 1: segments[name].append((start, index))
                        del active[name]
                for name in matching: active.setdefault(name, index)
            for name, start in active.items():
                if len(trip["points"]) - start > 1: segments[name].append((start, len(trip["points"])))
            cache[shape] = segments
        for name, ranges in segments.items():
            for index, (start, end) in enumerate(ranges):
                output[name].append({**trip, "id": f"{trip['id']}-{index}", "points": trip["points"][start:end]})
    return output


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rail", type=Path, required=True, help="one-day rail timetable JSON")
    parser.add_argument("--bus", type=Path, required=True, help="one-day bus timetable JSON")
    parser.add_argument("--tram", type=Path, required=True, help="one-day tram timetable JSON")
    parser.add_argument("--output", type=Path, default=ROOT / "data/derived/transport-timetables")
    parser.add_argument("--constituencies", type=Path, default=ROOT / "data/geo/constituencies.json")
    args = parser.parse_args()
    rail, bus, tram = json.loads(args.rail.read_text()), json.loads(args.bus.read_text()), json.loads(args.tram.read_text())
    names, cells = build_grid(json.loads(args.constituencies.read_text())["features"])
    rail_by_name, bus_by_name, tram_by_name = clip(rail["trips"], cells), clip(bus["trips"], cells), clip(tram["trips"], cells)
    args.output.mkdir(parents=True, exist_ok=True)
    manifest = {"date": rail["date"], "constituencies": {}}
    for name in sorted(names):
        filename = f"{slug(name)}.json"
        payload = {"date": rail["date"], "constituency": name, "railTrips": rail_by_name[name], "busTrips": bus_by_name[name], "tramTrips": tram_by_name[name]}
        (args.output / filename).write_text(json.dumps(payload, separators=(",", ":")))
        manifest["constituencies"][name] = filename
        print(f"{name}: {len(payload['railTrips'])} rail, {len(payload['busTrips'])} bus, {len(payload['tramTrips'])} tram segments")
    (args.output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__": main()
