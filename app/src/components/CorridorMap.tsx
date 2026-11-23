"use client";

import React from "react";

export interface MapNode {
  id: string;
  label: string;
  sublabel?: string;
  lat: number;
  lng: number;
  kind: "ACOPIO" | "BUYER" | "CORABASTOS" | "ALERT";
  severity?: "LOW" | "MEDIUM" | "HIGH";
  kg?: number;
}

interface CorridorMapProps {
  nodes: MapNode[];
  routeStopCoords?: Array<{ lat: number; lng: number; label: string; stopOrder: number }>;
  height?: number;
  title?: string;
}

// Bounding box covering Boyacá (Toca/Ventaquemada) -> Cundinamarca -> Bogotá
const MIN_LAT = 4.38;
const MAX_LAT = 5.66;
const MIN_LNG = -74.28;
const MAX_LNG = -73.08;

function project(lat: number, lng: number, w: number, h: number) {
  const padX = 48;
  const padY = 36;
  const x = padX + ((lng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * (w - padX * 2);
  const y = h - padY - ((lat - MIN_LAT) / (MAX_LAT - MIN_LAT)) * (h - padY * 2);
  return { x, y };
}

export function CorridorMap({
  nodes,
  routeStopCoords = [],
  height = 340,
  title = "Corredor Boyacá · Cundinamarca -> Zona Piloto Bogotá",
}: CorridorMapProps) {
  const width = 680;
  const projectedStops = routeStopCoords
    .slice()
    .sort((a, b) => a.stopOrder - b.stopOrder)
    .map((s) => ({ ...s, ...project(s.lat, s.lng, width, height) }));

  const pathD =
    projectedStops.length > 1
      ? projectedStops
          .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
          .join(" ")
      : "";

  const bogotaCenter = project(4.6425, -74.0655, width, height);

  return (
    <div className="rounded-2xl border border-rf-border bg-white p-4 shadow-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-sm font-bold text-rf-graphite">{title}</h3>
          <p className="text-xs text-slate-500">
            Proyección geográfica real · Sin dependencia de tiles externos (100 % offline)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rf-green" /> Acopio campesino
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rf-graphite" /> Comedor Bogotá
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 border-t-2 border-dashed border-rf-yellow" /> Ruta compartida
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full rounded-xl border border-rf-border bg-[#F7FAF6]"
          style={{ minHeight: 240 }}
        >
          {/* Subtle grid */}
          {[0.25, 0.5, 0.75].map((ratio) => (
            <React.Fragment key={ratio}>
              <line
                x1={0}
                y1={height * ratio}
                x2={width}
                y2={height * ratio}
                stroke="#E2EAE0"
                strokeDasharray="3 4"
              />
              <line
                x1={width * ratio}
                y1={0}
                x2={width * ratio}
                y2={height}
                stroke="#E2EAE0"
                strokeDasharray="3 4"
              />
            </React.Fragment>
          ))}

          {/* Department region labels */}
          <text x={width - 150} y={32} className="fill-slate-400 text-[11px] font-semibold uppercase tracking-widest">
            BOYACÁ (ALTIPLANO)
          </text>
          <text x={58} y={height - 135} className="fill-slate-400 text-[11px] font-semibold uppercase tracking-widest">
            CUNDINAMARCA (SABANA)
          </text>

          {/* Pilot zone highlight halo in Bogotá */}
          <circle
            cx={bogotaCenter.x}
            cy={bogotaCenter.y}
            r={30}
            fill="#F4B400"
            fillOpacity={0.14}
            stroke="#F4B400"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
          <text
            x={bogotaCenter.x + 34}
            y={bogotaCenter.y + 4}
            className="fill-[#263238] text-[10px] font-bold"
          >
            Zona Piloto Bogotá
          </text>

          {/* Shared route polyline */}
          {pathD && (
            <>
              <path
                d={pathD}
                fill="none"
                stroke="#263238"
                strokeWidth={4}
                strokeOpacity={0.12}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={pathD}
                fill="none"
                stroke="#F4B400"
                strokeWidth={3}
                strokeDasharray="7 5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {/* Nodes */}
          {nodes.map((node) => {
            const { x, y } = project(node.lat, node.lng, width, height);
            const fill =
              node.kind === "ACOPIO"
                ? "#3A9D4A"
                : node.kind === "BUYER"
                ? "#263238"
                : node.kind === "CORABASTOS"
                ? "#D97706"
                : "#D32F2F";
            return (
              <g key={node.id}>
                {node.severity === "HIGH" && (
                  <circle
                    cx={x}
                    cy={y}
                    r={17}
                    fill="#D32F2F"
                    fillOpacity={0.18}
                    stroke="#D32F2F"
                    strokeWidth={1.2}
                  />
                )}
                <circle cx={x} cy={y} r={7} fill={fill} stroke="#FFFFFF" strokeWidth={2} />
                <text
                  x={x + 10}
                  y={y - 4}
                  className="fill-[#263238] text-[10.5px] font-semibold"
                >
                  {node.label.length > 26 ? `${node.label.slice(0, 26)}…` : node.label}
                </text>
                {node.sublabel && (
                  <text x={x + 10} y={y + 9} className="fill-slate-500 text-[9px]">
                    {node.sublabel}
                  </text>
                )}
              </g>
            );
          })}

          {/* Numbered route stop badges */}
          {projectedStops.map((s) => (
            <g key={`stop-${s.stopOrder}`}>
              <circle cx={s.x} cy={s.y} r={9} fill="#263238" stroke="#F4B400" strokeWidth={2} />
              <text
                x={s.x}
                y={s.y + 3.5}
                textAnchor="middle"
                className="fill-white text-[9.5px] font-bold"
              >
                {s.stopOrder}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
