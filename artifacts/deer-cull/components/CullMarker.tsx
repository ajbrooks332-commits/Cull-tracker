import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Marker, Callout } from "react-native-maps";
import type { CullRecord } from "@/constants/types";
import { SPECIES_LABELS, SEX_LABELS } from "@/constants/types";
import { getMarkerColor } from "@/utils/markerColors";

interface Props {
  cull: CullRecord;
  onPress: (cull: CullRecord) => void;
}

export default function CullMarker({ cull, onPress }: Props) {
  const color = getMarkerColor(cull.species, cull.sex);

  return (
    <Marker
      coordinate={{ latitude: cull.latitude, longitude: cull.longitude }}
      onPress={() => onPress(cull)}
    >
      <View style={styles.markerContainer}>
        <View style={[styles.dot, { backgroundColor: color }]}>
          <Text style={styles.dotText}>{cull.id}</Text>
        </View>
        <View style={[styles.pin, { borderTopColor: color }]} />
      </View>
      <Callout tooltip onPress={() => onPress(cull)}>
        <View style={styles.callout}>
          <Text style={styles.calloutTitle}>
            {SPECIES_LABELS[cull.species]} — {SEX_LABELS[cull.sex]}
          </Text>
          {cull.weight && (
            <Text style={styles.calloutText}>{cull.weight} kg</Text>
          )}
          <Text style={styles.calloutSub}>
            {new Date(cull.culledAt).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </Text>
          <Text style={styles.calloutHint}>Tap to view / edit</Text>
        </View>
      </Callout>
    </Marker>
  );
}

const styles = StyleSheet.create({
  markerContainer: {
    alignItems: "center",
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  dotText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700" as const,
  },
  pin: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  callout: {
    backgroundColor: "#1A3A2A",
    borderRadius: 10,
    padding: 12,
    minWidth: 160,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  calloutTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600" as const,
    marginBottom: 4,
  },
  calloutText: {
    color: "#A8D5B5",
    fontSize: 13,
    marginBottom: 2,
  },
  calloutSub: {
    color: "#C4A882",
    fontSize: 12,
    marginBottom: 4,
  },
  calloutHint: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontStyle: "italic",
  },
});
