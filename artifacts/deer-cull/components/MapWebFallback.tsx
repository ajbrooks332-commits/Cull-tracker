import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "react-native";
import Colors from "@/constants/colors";

export default function MapWebFallback({ onAdd }: { onAdd: () => void }) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;

  return (
    <View style={[styles.container, { backgroundColor: "#2D5A3D" }]}>
      <View style={styles.pattern}>
        {Array.from({ length: 12 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.gridLine,
              {
                top: `${(i / 12) * 100}%`,
                opacity: 0.08,
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.centre}>
        <Ionicons name="map-outline" size={64} color="rgba(255,255,255,0.6)" />
        <Text style={styles.title}>Interactive Map</Text>
        <Text style={styles.sub}>
          Scan the QR code in the Replit preview bar to open this app in Expo
          Go on your phone — the full map with GPS tracking works there.
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.btn,
            { opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={onAdd}
        >
          <Ionicons name="add" size={20} color="#1A3A2A" />
          <Text style={styles.btnText}>Log a Cull Manually</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
  },
  pattern: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#fff",
  },
  centre: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: "#fff",
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  sub: {
    fontSize: 15,
    color: "rgba(255,255,255,0.75)",
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 340,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F5F0E8",
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginTop: 8,
  },
  btnText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#1A3A2A",
    fontFamily: "Inter_700Bold",
  },
});
