// RN port of frontend/src/lib/components/AreaChartMini.svelte. Same
// viewBox="0 0 100 100" + preserveAspectRatio="none" scaling trick, via
// react-native-svg (already a dependency through react-native-qrcode-svg).
import { useId } from "react";
import { View, Text } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Path } from "react-native-svg";

export type AreaChartDatum = Record<string, any>;

export default function AreaChartMini({
  data = [],
  yKey = "earnings",
  xKey = null,
  color = "#C45C38",
  height = 140,
  showGrid = true,
  showXLabels = true,
  showYLabels = false,
  yAxisWidth = 30,
  labelColor = "#AECAAE",
  labelSize = 9,
}: {
  data?: AreaChartDatum[];
  yKey?: string;
  xKey?: string | null;
  color?: string;
  height?: number;
  showGrid?: boolean;
  showXLabels?: boolean;
  showYLabels?: boolean;
  yAxisWidth?: number;
  labelColor?: string;
  labelSize?: number;
}) {
  const gid = `og-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const max = Math.max(0.0001, ...data.map((d) => Number(d[yKey]) || 0));
  const n = data.length;

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

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xv(i)} ${yv(Number(d[yKey]) || 0)}`).join(" ");
  const areaPath = n > 0 ? `${linePath} L 100 100 L 0 100 Z` : "";

  let labelIdx: number[] = [];
  if (xKey && n > 0) {
    if (n <= 7) {
      labelIdx = data.map((_, i) => i);
    } else {
      const step = Math.ceil(n / 6);
      for (let i = 0; i < n; i += step) labelIdx.push(i);
      if (labelIdx[labelIdx.length - 1] !== n - 1) labelIdx.push(n - 1);
    }
  }

  return (
    <View style={{ height, width: "100%", flexDirection: "column" }}>
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
            <Defs>
              <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="5%" stopColor={color} stopOpacity={0.5} />
                <Stop offset="95%" stopColor={color} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {!!areaPath && (
              <>
                <Path d={areaPath} fill={`url(#${gid})`} stroke="none" />
                <Path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </>
            )}
          </Svg>
        </View>
      </View>
      {showXLabels && xKey && (
        <View style={{ flexDirection: "row" }}>
          {showYLabels && <View style={{ width: yAxisWidth, flexShrink: 0 }} />}
          <View style={{ flex: 1, minWidth: 0, position: "relative", height: 14, marginTop: 2 }}>
            {labelIdx.map((i) => (
              <Text
                key={i}
                numberOfLines={1}
                style={{ position: "absolute", left: `${xv(i)}%`, transform: [{ translateX: -10 }], color: labelColor, fontSize: labelSize }}
              >
                {data[i][xKey]}
              </Text>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
