/**
 * LalouFlower - Custom D3.js visualization for Laloux organizational model
 * 
 * Displays 6 dimensions as petals in a flower pattern
 */

'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { ComputedReportData, ConfigOptions } from '@/lib/reports/types';

interface LalouFlowerProps {
  data: ComputedReportData;
  options: ConfigOptions;
}

export function LalouFlower({ data, options }: LalouFlowerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dimensions = (options.dimensions || []) as string[];
  const width = (options.width || 600) as number;
  const height = (options.height || 600) as number;
  const colors = (options.colors || ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']) as string[];
  const showLabels = (options.showLabels !== undefined ? options.showLabels : true) as boolean;
  const showValues = (options.showValues !== undefined ? options.showValues : true) as boolean;

  useEffect(() => {
    if (!svgRef.current || !data.dimensions) return;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current);
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) / 2 - 60;
    const centerRadius = 40;

    // Extract dimension values
    const dimensionData = dimensions.map((dim, index) => {
      const dimData = data.dimensions?.[dim];
      return {
        name: dim,
        value: dimData?.value || 0,
        color: colors[index % colors.length],
        angle: (index * 2 * Math.PI) / dimensions.length
      };
    });

    // Create main group
    const g = svg
      .append('g')
      .attr('transform', `translate(${centerX}, ${centerY})`);

    // Draw petals
    dimensionData.forEach((dim) => {
      const petalRadius = centerRadius + (maxRadius - centerRadius) * (dim.value / 100);
      const angle = dim.angle - Math.PI / 2; // Start from top

      // Calculate petal path
      const petalPath = d3.path();
      const angleSpread = (2 * Math.PI) / dimensions.length;
      const controlPointDistance = petalRadius * 0.8;

      // Start at center circle edge
      const startX = centerRadius * Math.cos(angle);
      const startY = centerRadius * Math.sin(angle);
      petalPath.moveTo(startX, startY);

      // Curve to petal tip
      const tipX = petalRadius * Math.cos(angle);
      const tipY = petalRadius * Math.sin(angle);
      
      const cp1X = controlPointDistance * Math.cos(angle - angleSpread / 4);
      const cp1Y = controlPointDistance * Math.sin(angle - angleSpread / 4);
      
      petalPath.quadraticCurveTo(cp1X, cp1Y, tipX, tipY);

      // Curve back to center
      const cp2X = controlPointDistance * Math.cos(angle + angleSpread / 4);
      const cp2Y = controlPointDistance * Math.sin(angle + angleSpread / 4);
      
      const endX = centerRadius * Math.cos(angle + angleSpread);
      const endY = centerRadius * Math.sin(angle + angleSpread);
      
      petalPath.quadraticCurveTo(cp2X, cp2Y, endX, endY);
      petalPath.closePath();

      // Draw petal
      g.append('path')
        .attr('d', petalPath.toString())
        .attr('fill', dim.color)
        .attr('fill-opacity', 0.7)
        .attr('stroke', dim.color)
        .attr('stroke-width', 2)
        .attr('class', 'petal')
        .on('mouseenter', function() {
          d3.select(this)
            .transition()
            .duration(200)
            .attr('fill-opacity', 0.9);
        })
        .on('mouseleave', function() {
          d3.select(this)
            .transition()
            .duration(200)
            .attr('fill-opacity', 0.7);
        });

      // Add labels
      if (showLabels) {
        const labelDistance = maxRadius + 30;
        const labelX = labelDistance * Math.cos(angle);
        const labelY = labelDistance * Math.sin(angle);

        g.append('text')
          .attr('x', labelX)
          .attr('y', labelY)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('class', 'text-sm font-medium')
          .text(dim.name);
      }

      // Add values
      if (showValues) {
        const valueDistance = petalRadius * 0.7;
        const valueX = valueDistance * Math.cos(angle);
        const valueY = valueDistance * Math.sin(angle);

        g.append('text')
          .attr('x', valueX)
          .attr('y', valueY)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'middle')
          .attr('class', 'text-xs font-bold fill-white')
          .text(dim.value.toFixed(0));
      }
    });

    // Draw center circle
    g.append('circle')
      .attr('cx', 0)
      .attr('cy', 0)
      .attr('r', centerRadius)
      .attr('fill', '#f3f4f6')
      .attr('stroke', '#9ca3af')
      .attr('stroke-width', 2);

    // Add overall score in center
    if (data.overall_score !== undefined) {
      g.append('text')
        .attr('x', 0)
        .attr('y', 0)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('class', 'text-2xl font-bold')
        .text(data.overall_score.toFixed(0));
    }

  }, [data, dimensions, width, height, colors, showLabels, showValues]);

  return (
    <div className="flex justify-center items-center">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="lalou-flower"
      />
    </div>
  );
}

