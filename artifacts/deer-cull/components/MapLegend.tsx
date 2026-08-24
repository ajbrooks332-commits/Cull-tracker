import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  useColorScheme,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { LEGEND_ENTRIES } from "@/utils/markerColors";
import type { CullRecord } from "@/constants/types";

interface Props {
  culls: CullRecord[];
}

export default function MapLegend({ culls }: Props) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const [expanded, setExpanded] = useState(false);

  const activeEntries = LEGEND_ENTRIES.filter((e) =>
    culls.some((c) => c.species === e.species && c.sex === e.sex)
  );

  if (activeEntries.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <Pressable
        style={[
          styles.container,
          { backgroundColor: isDark ? "rgba(28,28,30,0.94)" : "rgba(255,255,255,0.94)" },
        ]}
        onPress={() => setExpanded((e) => !e)}
      >
        <View style={styles.header}>
          <Ionicons name="map-outline" size={14} color={C.primary} />
          <Text style={[styles.title, { color: C.text }]}>Legend</Text>
          <Ionicons
            name={expanded ? "chevron-down" : "chevron-up"}
            size={14}
            color={C.textSecondary}
          />
        </View>
        {expanded && (
          <View style={styles.entries}>
            {activeEntries.map((e) => (
              <View key={`${e.species}-${e.sex}`} style={styles.entry}>
                <View
                  style={[styles.dot, { backgroundColor: e.color }]}
                />
                <Text style={[styles.label, { color: C.text }]}>
                  {e.label}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 100,
    left: 12,
    right: 12,
  },
  container: {
    borderRadius: 12,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600" as const,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },
  entries: {
    marginTop: 8,
    gap: 6,
  },
  entry: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
