import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  useColorScheme,
  ScrollView,
} from "react-native";
import MapView, { MapType } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useCulls, useCreateCull, useUpdateCull, useDeleteCull } from "@/hooks/useCulls";
import type { CullRecord } from "@/constants/types";
import CullMarker from "@/components/CullMarker";
import CullForm from "@/components/CullForm";
import CullDetailSheet from "@/components/CullDetailSheet";
import MapLegend from "@/components/MapLegend";
import { generatePDF } from "@/utils/pdf";
import { useStalker } from "@/contexts/StalkerContext";
import {
  getAvailablePlanYears,
  getCurrentPlanYear,
  isInPlanYear,
  seasonLabel,
} from "@/constants/types";

const DEFAULT_REGION = {
  latitude: 56.4907,
  longitude: -4.2026,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};
const PLAN_YEARS = getAvailablePlanYears();

export default function MapScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const mapRef = useRef<MapView>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);
  const [mapType, setMapType] = useState<MapType>("satellite");
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedCull, setSelectedCull] = useState<CullRecord | null>(null);
  const [editingCull, setEditingCull] = useState<CullRecord | null>(null);
  const [dropCoords, setDropCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [selectedPlanYear, setSelectedPlanYear] = useState(getCurrentPlanYear);
  const [showSeasonPicker, setShowSeasonPicker] = useState(false);

  const { stalker } = useStalker();
  const { data: culls = [], isLoading } = useCulls();
  const createCull = useCreateCull();
  const updateCull = useUpdateCull();
  const deleteCull = useDeleteCull();
  const visibleCulls = useMemo(
    () => culls.filter((cull) => isInPlanYear(cull.culledAt, selectedPlanYear)),
    [culls, selectedPlanYear]
  );

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationGranted(status === "granted");
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setLocation(loc);
        mapRef.current?.animateToRegion(
          {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          },
          800
        );
      }
    })();
  }, []);

  function handleMapPress(event: any) {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDropCoords({ lat: latitude, lng: longitude });
    setEditingCull(null);
    setShowForm(true);
  }

  function handleMarkerPress(cull: CullRecord) {
    setSelectedCull(cull);
    setShowDetail(true);
  }

  async function handleFormSubmit(data: Omit<CullRecord, "id" | "createdAt" | "updatedAt" | "stalkerName">) {
    const payload = { ...data, stalkerId: data.stalkerId ?? stalker?.id ?? null };
    if (editingCull) {
      await updateCull.mutateAsync({ id: editingCull.id, data: payload });
    } else {
      await createCull.mutateAsync(payload);
    }
    setShowForm(false);
    setEditingCull(null);
    setDropCoords(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function handleEdit(cull: CullRecord) {
    setEditingCull(cull);
    setShowDetail(false);
    setShowForm(true);
  }

  async function handleDelete(id: number) {
    await deleteCull.mutateAsync(id);
  }

  function goToMyLocation() {
    if (location) {
      mapRef.current?.animateToRegion(
        {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        600
      );
    }
  }

  async function handleExport() {
    if (visibleCulls.length === 0) {
      Alert.alert("No Records", "There are no cull records to export.");
      return;
    }
    setExporting(true);
    try {
      await generatePDF(visibleCulls, { season: selectedPlanYear });
    } catch (e) {
      Alert.alert("Export Failed", "Could not generate the PDF report.");
    } finally {
      setExporting(false);
    }
  }

  const topPad = insets.top + 12;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={DEFAULT_REGION}
        mapType={mapType}
        showsUserLocation={locationGranted === true}
        showsMyLocationButton={false}
        showsCompass={false}
        onPress={handleMapPress}
        rotateEnabled={false}
      >
        {visibleCulls.map((cull) => (
          <CullMarker key={cull.id} cull={cull} onPress={handleMarkerPress} />
        ))}
      </MapView>

      {isLoading && (
        <View style={[styles.loadingOverlay, { top: topPad }]}>
          <ActivityIndicator color={C.primary} />
        </View>
      )}

      <View style={[styles.topBar, { top: topPad }]}>
        <View
          style={[
            styles.titleCard,
            isDark && { backgroundColor: "rgba(28,28,30,0.95)" },
          ]}
        >
          <Text style={styles.appTitle}>Deer Records</Text>
            <Pressable
              style={({ pressed }) => [
                styles.seasonControl,
                { opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={() => setShowSeasonPicker((visible) => !visible)}
              accessibilityRole="button"
              accessibilityLabel="Select cull season"
            >
              <Text style={styles.seasonControlText}>Cull season {seasonLabel(selectedPlanYear)}</Text>
              <Ionicons
                name={showSeasonPicker ? "chevron-up" : "chevron-down"}
                size={15}
                color="#4A7C59"
              />
            </Pressable>
            <Text style={styles.countBadge}>{visibleCulls.length} logged</Text>
        </View>

        <View style={styles.topButtons}>
          <MapButton
            icon={mapType === "satellite" ? "map-outline" : "globe-outline"}
            onPress={() =>
              setMapType(mapType === "satellite" ? "standard" : "satellite")
            }
            dark={isDark}
          />
          <MapButton
            icon="locate-outline"
            onPress={goToMyLocation}
            dark={isDark}
            disabled={!locationGranted}
          />
        </View>
      </View>

      {showSeasonPicker && (
        <View
          style={[
            styles.seasonPicker,
            { top: topPad + 77, backgroundColor: C.surface, borderColor: C.border },
          ]}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            {PLAN_YEARS.map((year) => {
              const selected = year === selectedPlanYear;
              return (
                <Pressable
                  key={year}
                  style={({ pressed }) => [
                    styles.seasonOption,
                    selected && { backgroundColor: C.primary },
                    { opacity: pressed ? 0.78 : 1 },
                  ]}
                  onPress={() => {
                    setSelectedPlanYear(year);
                    setShowSeasonPicker(false);
                  }}
                >
                  <Text style={[styles.seasonOptionText, { color: selected ? "#fff" : C.text }]}>
                    {seasonLabel(year)}
                  </Text>
                  <Text style={[styles.seasonOptionSubtext, { color: selected ? "rgba(255,255,255,0.82)" : C.textSecondary }]}>
                    May {year} – Apr {year + 1}
                  </Text>
                  {selected && <Ionicons name="checkmark" size={18} color="#fff" />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      <MapLegend culls={visibleCulls} />

      <View
        style={[
          styles.bottomBar,
          { paddingBottom: Math.max(insets.bottom + 8, 24) },
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.exportBtn,
            { opacity: pressed || exporting ? 0.75 : 1 },
          ]}
          onPress={handleExport}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator color={C.primary} size="small" />
          ) : (
            <Ionicons
              name="document-text-outline"
              size={20}
              color={C.primary}
            />
          )}
          <Text style={[styles.exportText, { color: C.primary }]}>
            Export PDF
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.addBtn,
            { backgroundColor: C.primary, opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setDropCoords(
              location
                ? {
                    lat: location.coords.latitude,
                    lng: location.coords.longitude,
                  }
                : null
            );
            setEditingCull(null);
            setShowForm(true);
          }}
        >
          <Ionicons name="add" size={28} color="#fff" />
          <Text style={styles.addText}>Log Cull</Text>
        </Pressable>
      </View>

      <View
        style={[
          styles.tapHint,
          { bottom: Math.max(insets.bottom + 8, 24) + 80 },
        ]}
      >
        <Text style={styles.tapHintText}>Tap map to pin a location</Text>
      </View>

      <CullForm
        visible={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingCull(null);
          setDropCoords(null);
        }}
        onSubmit={handleFormSubmit}
        initialData={editingCull ?? undefined}
        latitude={dropCoords?.lat ?? location?.coords.latitude}
        longitude={dropCoords?.lng ?? location?.coords.longitude}
        isLoading={createCull.isPending || updateCull.isPending}
        editMode={!!editingCull}
      />

      <CullDetailSheet
        cull={selectedCull}
        visible={showDetail}
        onClose={() => setShowDetail(false)}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </View>
  );
}

function MapButton({
  icon,
  onPress,
  dark,
  disabled,
}: {
  icon: string;
  onPress: () => void;
  dark: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.mapBtn,
        {
          backgroundColor: dark
            ? "rgba(28,28,30,0.95)"
            : "rgba(255,255,255,0.95)",
        },
        { opacity: pressed || disabled ? 0.6 : 1 },
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Ionicons
        name={icon as any}
        size={20}
        color={dark ? "#F0EBE1" : "#1A3A2A"}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingOverlay: {
    position: "absolute",
    right: 16,
    backgroundColor: "rgba(255,255,255,0.8)",
    borderRadius: 20,
    padding: 8,
  },
  topBar: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  titleCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  appTitle: {
    fontSize: 17,
    fontWeight: "700" as const,
    color: "#1A3A2A",
    fontFamily: "Inter_700Bold",
  },
  countBadge: {
    fontSize: 12,
    color: "#4A7C59",
    fontFamily: "Inter_500Medium",
    marginTop: 1,
  },
  seasonControl: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 3,
    marginTop: 3,
  },
  seasonControlText: {
    fontSize: 12,
    color: "#4A7C59",
    fontFamily: "Inter_600SemiBold",
  },
  topButtons: {
    gap: 8,
  },
  seasonPicker: {
    position: "absolute",
    left: 12,
    width: 236,
    maxHeight: 280,
    borderRadius: 14,
    borderWidth: 1,
    padding: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 7,
    zIndex: 10,
  },
  seasonOption: {
    minHeight: 48,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    justifyContent: "center",
    position: "relative",
  },
  seasonOptionText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  seasonOptionSubtext: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  mapBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  tapHint: {
    position: "absolute",
    alignSelf: "center",
  },
  tapHintText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
    fontFamily: "Inter_400Regular",
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  exportText: {
    fontSize: 15,
    fontWeight: "600" as const,
    fontFamily: "Inter_600SemiBold",
  },
  addBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  addText: {
    fontSize: 17,
    fontWeight: "700" as const,
    color: "#fff",
    fontFamily: "Inter_700Bold",
  },
});
