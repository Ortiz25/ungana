// RN port of frontend/src/lib/components/MultiLineChartMini.svelte — the
// multi-series sibling of AreaChartMini, one line per series (no fill area;
// several overlapping fills would read as noise rather than signal), sharing
// a single y-scale across all series so line heights stay comparable. Same
// viewBox="0 0 100 100" + preserveAspectRatio="none" scaling trick via
// react-native-svg as AreaChartMini.
import { View, Text } from "react-native";
import Svg, { Path } from "react-native-svg";

export type LineSeries = { siteId?: string | number | null; siteName: string; data: number[] };

const DEFAULT_COLORS = ["#C45C38", "#5B8ED6", "#4E8050", "#CC8830", "#B565A7", "#5AAFAE"];

export default function MultiLineChartMini({
  days = [],
  series = [],
  colors = DEFAULT_COLORS,
  height = 160,
  showGrid = true,
  showXLabels = true,
  showYLabels = true,
  showLegend = true,
  yAxisWidth = 32,
  labelColor = "#AECAAE",
  labelSize = 9,
}: {
  days?: string[];
  series?: LineSeries[];
  colors?: string[];
  height?: number;
  showGrid?: boolean;
  showXLabels?: boolean;
  showYLabels?: boolean;
  showLegend?: boolean;
  yAxisWidth?: number;
  labelColor?: string;
  labelSize?: number;
}) {
  const n = days.length;
  const max = Math.max(0.0001, ...series.flatMap((s) => s.data.map((v) => Number(v) || 0)));

  function formatAxisValue(v: number): string {
    if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
    if (v >= 10 || Number.isInteger(v)) return String(Math.round(v));
    return v.toFixed(1);
  }

  function yv(val: number): number {
    return 98 - (val / max) * 92;
  }
  function xv(i: number): number {
    return n <= 1 ? 0 : (i / (n - 1)) * 100;
  }

  function linePath(data: number[]): string {
    return data.map((v, i) => `${i === 0 ? "M" : "L"} ${xv(i)} ${yv(Number(v) || 0)}`).join(" ");
  }

  let labelIdx: number[] = [];
  if (n > 0) {
    if (n <= 7) {
      labelIdx = days.map((_, i) => i);
    } else {
      const step = Math.ceil(n / 6);
      for (let i = 0; i < n; i += step) labelIdx.push(i);
      if (labelIdx[labelIdx.length - 1] !== n - 1) labelIdx.push(n - 1);
    }
  }

  function formatDay(dateStr: string): string {
    return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  }

  return (
    <View style={{ width: "100%", flexDirection: "column" }}>
      <View style={{ height, flexDirection: "column" }}>
        <View style={{ flex: 1, minHeight: 0, flexDirection: "row" }}>
          {showYLabels && (
            <View style={{ width: yAxisWidth, flexShrink: 0 }}>
              {[0, 25, 50, 75, 100].map((g) => (
                <Text
                  key={g}
                  numberOfLines={1}
                  style={{ position: "absolute", right: 4, top: `${g}%`, transform: [{ translateY: -6 }], color: labelColor, fontSize: labelSize }}
                >
                  {formatAxisValue(max * (1 - g / 100))}
                </Text>
              ))}
            </View>
          )}
          <View style={{ flex: 1, minHeight: 0, position: "relative" }}>
            {showGrid &&
              [0, 25, 50, 75, 100].map((g) => (
                <View
                  key={g}
                  style={{ position: "absolute", left: 0, right: 0, top: `${g}%`, borderTopWidth: 1, borderStyle: "dashed", borderTopColor: "rgba(255,255,255,0.12)" }}
                />
              ))}
            <Svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, width: "100%", height: "100%" }}>
              {series.map((s, i) => (
                <Path
                  key={s.siteId ?? i}
                  d={linePath(s.data)}
                  fill="none"
                  stroke={colors[i % colors.length]}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </Svg>
          </View>
        </View>
        {showXLabels && n > 0 && (
          <View style={{ flexDirection: "row" }}>
            {showYLabels && <View style={{ width: yAxisWidth, flexShrink: 0 }} />}
            <View style={{ flex: 1, minWidth: 0, position: "relative", height: 14, marginTop: 2 }}>
              {labelIdx.map((i) => (
                <Text
                  key={i}
                  numberOfLines={1}
                  style={{ position: "absolute", left: `${xv(i)}%`, transform: [{ translateX: -10 }], color: labelColor, fontSize: labelSize }}
                >
                  {formatDay(days[i])}
                </Text>
              ))}
            </View>
          </View>
        )}
      </View>

      {showLegend && series.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10, paddingLeft: showYLabels ? yAxisWidth : 0 }}>
          {series.map((s, i) => (
            <View key={s.siteId ?? i} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors[i % colors.length] }} />
              <Text style={{ fontSize: labelSize, color: labelColor }}>{s.siteName}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
