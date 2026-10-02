// RN port of frontend/src/lib/components/BarChartMini.svelte. Plain flexbox
// Views — no SVG needed, since the web version itself is just
// percentage-height divs, which flexbox does natively in RN too.
import { View, Text } from "react-native";

export type BarChartDatum = Record<string, any>;

export default function BarChartMini({
  data = [],
  yKey = "earnings",
  xKey = null,
  color = "#C45C38",
  barSize = 16,
  height = 140,
  radius = 4,
  opacity = 1,
  showXLabels = true,
  showGrid = false,
  showYLabels = false,
  yAxisWidth = 30,
  labelColor = "#AECAAE",
  labelSize = 9,
}: {
  data?: BarChartDatum[];
  yKey?: string;
  xKey?: string | null;
  color?: string;
  barSize?: number;
  height?: number;
  radius?: number;
  opacity?: number;
  showXLabels?: boolean;
  showGrid?: boolean;
  showYLabels?: boolean;
  yAxisWidth?: number;
  labelColor?: string;
  labelSize?: number;
}) {
  const max = Math.max(0.0001, ...data.map((d) => Number(d[yKey]) || 0));

  function formatAxisValue(v: number): string {
    if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
    if (v >= 10 || Number.isInteger(v)) return String(Math.round(v));
    return v.toFixed(1);
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
        <View style={{ flex: 1, minHeight: 0, flexDirection: "row", alignItems: "flex-end" }}>
          {showGrid &&
            [0, 25, 50, 75].map((g) => (
              <View
                key={g}
                style={{ position: "absolute", left: 0, right: 0, top: `${g}%`, borderTopWidth: 1, borderStyle: "dashed", borderTopColor: "rgba(255,255,255,0.12)" }}
              />
            ))}
          {data.map((d, i) => (
            <View key={i} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
              <View
                style={{
                  width: barSize,
                  height: `${((Number(d[yKey]) || 0) / max) * 100}%`,
                  backgroundColor: color,
                  opacity,
                  borderTopLeftRadius: radius,
                  borderTopRightRadius: radius,
                }}
              />
            </View>
          ))}
        </View>
      </View>
      {showXLabels && xKey && (
        <View style={{ flexDirection: "row", marginTop: 4 }}>
          {showYLabels && <View style={{ width: yAxisWidth, flexShrink: 0 }} />}
          {data.map((d, i) => (
            <Text key={i} numberOfLines={1} style={{ flex: 1, textAlign: "center", color: labelColor, fontSize: labelSize }}>
              {d[xKey]}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}
