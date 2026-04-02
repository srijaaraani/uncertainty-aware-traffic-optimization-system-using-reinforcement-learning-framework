/**
 * RoadView Component
 * 
 * Renders the road infrastructure including:
 * - Road surface
 * - Lane markings
 * - Crosswalks
 * - Intersection center
 * 
 * IMPORTANT: This component contains NO decision-making logic.
 */

import React from 'react';
import { SimulationConfig, LaneConfig } from '@/types/simulation';

interface RoadViewProps {
  config: SimulationConfig;
  width: number;
  height: number;
}

export function RoadView({ config, width, height }: RoadViewProps) {
  const { intersectionSize, roadWidth, laneConfig } = config;
  const centerX = width / 2;
  const centerY = height / 2;
  const halfIntersection = intersectionSize / 2;

  // Calculate road widths based on lane configuration
  const nsLanes = Math.max(laneConfig.north, laneConfig.south);
  const ewLanes = Math.max(laneConfig.east, laneConfig.west);
  const nsRoadWidth = nsLanes * roadWidth * 2; // Both directions
  const ewRoadWidth = ewLanes * roadWidth * 2;

  return (
    <svg
      width={width}
      height={height}
      className="absolute inset-0"
    >
      {/* Background - using CSS variable for theme-aware color */}
      <rect
        width={width}
        height={height}
        style={{ fill: 'hsl(var(--muted))' }}
      />

      {/* North-South Road */}
      <rect
        x={centerX - nsRoadWidth / 2}
        y={0}
        width={nsRoadWidth}
        height={height}
        style={{ fill: 'hsl(215, 16%, 25%)' }}
      />

      {/* East-West Road */}
      <rect
        x={0}
        y={centerY - ewRoadWidth / 2}
        width={width}
        height={ewRoadWidth}
        style={{ fill: 'hsl(215, 16%, 25%)' }}
      />

      {/* Intersection center (slightly darker) */}
      <rect
        x={centerX - intersectionSize / 2}
        y={centerY - intersectionSize / 2}
        width={intersectionSize}
        height={intersectionSize}
        style={{ fill: 'hsl(215, 16%, 20%)' }}
      />

      {/* Lane markings - NS Road */}
      {/* Center line (double yellow) */}
      <line
        x1={centerX - 2}
        y1={0}
        x2={centerX - 2}
        y2={centerY - halfIntersection}
        stroke="#F4C430"
        strokeWidth={2}
      />
      <line
        x1={centerX + 2}
        y1={0}
        x2={centerX + 2}
        y2={centerY - halfIntersection}
        stroke="#F4C430"
        strokeWidth={2}
      />
      <line
        x1={centerX - 2}
        y1={centerY + halfIntersection}
        x2={centerX - 2}
        y2={height}
        stroke="#F4C430"
        strokeWidth={2}
      />
      <line
        x1={centerX + 2}
        y1={centerY + halfIntersection}
        x2={centerX + 2}
        y2={height}
        stroke="#F4C430"
        strokeWidth={2}
      />

      {/* Lane markings - EW Road */}
      {/* Center line (double yellow) */}
      <line
        x1={0}
        y1={centerY - 2}
        x2={centerX - halfIntersection}
        y2={centerY - 2}
        stroke="#F4C430"
        strokeWidth={2}
      />
      <line
        x1={0}
        y1={centerY + 2}
        x2={centerX - halfIntersection}
        y2={centerY + 2}
        stroke="#F4C430"
        strokeWidth={2}
      />
      <line
        x1={centerX + halfIntersection}
        y1={centerY - 2}
        x2={width}
        y2={centerY - 2}
        stroke="#F4C430"
        strokeWidth={2}
      />
      <line
        x1={centerX + halfIntersection}
        y1={centerY + 2}
        x2={width}
        y2={centerY + 2}
        stroke="#F4C430"
        strokeWidth={2}
      />

      {/* NS Lane dividers (white dashed) - North approach */}
      {nsLanes === 2 && (
        <>
          {/* Right side lanes (northbound traffic) */}
          <line
            x1={centerX + roadWidth}
            y1={0}
            x2={centerX + roadWidth}
            y2={centerY - halfIntersection}
            stroke="white"
            strokeWidth={2}
            strokeDasharray="20,10"
          />
          {/* Left side lanes (southbound traffic) */}
          <line
            x1={centerX - roadWidth}
            y1={0}
            x2={centerX - roadWidth}
            y2={centerY - halfIntersection}
            stroke="white"
            strokeWidth={2}
            strokeDasharray="20,10"
          />
          {/* South approach */}
          <line
            x1={centerX + roadWidth}
            y1={centerY + halfIntersection}
            x2={centerX + roadWidth}
            y2={height}
            stroke="white"
            strokeWidth={2}
            strokeDasharray="20,10"
          />
          <line
            x1={centerX - roadWidth}
            y1={centerY + halfIntersection}
            x2={centerX - roadWidth}
            y2={height}
            stroke="white"
            strokeWidth={2}
            strokeDasharray="20,10"
          />
        </>
      )}

      {/* EW Lane dividers (white dashed) */}
      {ewLanes === 2 && (
        <>
          {/* West approach */}
          <line
            x1={0}
            y1={centerY - roadWidth}
            x2={centerX - halfIntersection}
            y2={centerY - roadWidth}
            stroke="white"
            strokeWidth={2}
            strokeDasharray="20,10"
          />
          <line
            x1={0}
            y1={centerY + roadWidth}
            x2={centerX - halfIntersection}
            y2={centerY + roadWidth}
            stroke="white"
            strokeWidth={2}
            strokeDasharray="20,10"
          />
          {/* East approach */}
          <line
            x1={centerX + halfIntersection}
            y1={centerY - roadWidth}
            x2={width}
            y2={centerY - roadWidth}
            stroke="white"
            strokeWidth={2}
            strokeDasharray="20,10"
          />
          <line
            x1={centerX + halfIntersection}
            y1={centerY + roadWidth}
            x2={width}
            y2={centerY + roadWidth}
            stroke="white"
            strokeWidth={2}
            strokeDasharray="20,10"
          />
        </>
      )}

      {/* Crosswalks - North */}
      <CrosswalkStripes
        x={centerX - nsRoadWidth / 2 + 5}
        y={centerY - halfIntersection - 20}
        width={nsRoadWidth - 10}
        height={15}
        isVertical={false}
      />

      {/* Crosswalks - South */}
      <CrosswalkStripes
        x={centerX - nsRoadWidth / 2 + 5}
        y={centerY + halfIntersection + 5}
        width={nsRoadWidth - 10}
        height={15}
        isVertical={false}
      />

      {/* Crosswalks - East */}
      <CrosswalkStripes
        x={centerX + halfIntersection + 5}
        y={centerY - ewRoadWidth / 2 + 5}
        width={15}
        height={ewRoadWidth - 10}
        isVertical={true}
      />

      {/* Crosswalks - West */}
      <CrosswalkStripes
        x={centerX - halfIntersection - 20}
        y={centerY - ewRoadWidth / 2 + 5}
        width={15}
        height={ewRoadWidth - 10}
        isVertical={true}
      />

      {/* STOP lines */}
      {/* North approach */}
      <line
        x1={centerX}
        y1={centerY - halfIntersection - 25}
        x2={centerX + nsRoadWidth / 2 - 5}
        y2={centerY - halfIntersection - 25}
        stroke="white"
        strokeWidth={4}
      />
      {/* South approach */}
      <line
        x1={centerX - nsRoadWidth / 2 + 5}
        y1={centerY + halfIntersection + 25}
        x2={centerX}
        y2={centerY + halfIntersection + 25}
        stroke="white"
        strokeWidth={4}
      />
      {/* East approach */}
      <line
        x1={centerX + halfIntersection + 25}
        y1={centerY}
        x2={centerX + halfIntersection + 25}
        y2={centerY + ewRoadWidth / 2 - 5}
        stroke="white"
        strokeWidth={4}
      />
      {/* West approach */}
      <line
        x1={centerX - halfIntersection - 25}
        y1={centerY - ewRoadWidth / 2 + 5}
        x2={centerX - halfIntersection - 25}
        y2={centerY}
        stroke="white"
        strokeWidth={4}
      />

      {/* Road edge lines */}
      <line
        x1={centerX - nsRoadWidth / 2}
        y1={0}
        x2={centerX - nsRoadWidth / 2}
        y2={centerY - ewRoadWidth / 2}
        stroke="white"
        strokeWidth={3}
      />
      <line
        x1={centerX + nsRoadWidth / 2}
        y1={0}
        x2={centerX + nsRoadWidth / 2}
        y2={centerY - ewRoadWidth / 2}
        stroke="white"
        strokeWidth={3}
      />
      <line
        x1={centerX - nsRoadWidth / 2}
        y1={centerY + ewRoadWidth / 2}
        x2={centerX - nsRoadWidth / 2}
        y2={height}
        stroke="white"
        strokeWidth={3}
      />
      <line
        x1={centerX + nsRoadWidth / 2}
        y1={centerY + ewRoadWidth / 2}
        x2={centerX + nsRoadWidth / 2}
        y2={height}
        stroke="white"
        strokeWidth={3}
      />

      <line
        x1={0}
        y1={centerY - ewRoadWidth / 2}
        x2={centerX - nsRoadWidth / 2}
        y2={centerY - ewRoadWidth / 2}
        stroke="white"
        strokeWidth={3}
      />
      <line
        x1={0}
        y1={centerY + ewRoadWidth / 2}
        x2={centerX - nsRoadWidth / 2}
        y2={centerY + ewRoadWidth / 2}
        stroke="white"
        strokeWidth={3}
      />
      <line
        x1={centerX + nsRoadWidth / 2}
        y1={centerY - ewRoadWidth / 2}
        x2={width}
        y2={centerY - ewRoadWidth / 2}
        stroke="white"
        strokeWidth={3}
      />
      <line
        x1={centerX + nsRoadWidth / 2}
        y1={centerY + ewRoadWidth / 2}
        x2={width}
        y2={centerY + ewRoadWidth / 2}
        stroke="white"
        strokeWidth={3}
      />
    </svg>
  );
}

// Crosswalk stripes helper component
function CrosswalkStripes({
  x,
  y,
  width,
  height,
  isVertical,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  isVertical: boolean;
}) {
  const stripeCount = isVertical ? Math.floor(height / 12) : Math.floor(width / 12);
  const stripes = [];

  for (let i = 0; i < stripeCount; i++) {
    if (isVertical) {
      stripes.push(
        <rect
          key={i}
          x={x}
          y={y + i * 12 + 2}
          width={width}
          height={8}
          fill="white"
        />
      );
    } else {
      stripes.push(
        <rect
          key={i}
          x={x + i * 12 + 2}
          y={y}
          width={8}
          height={height}
          fill="white"
        />
      );
    }
  }

  return <>{stripes}</>;
}
