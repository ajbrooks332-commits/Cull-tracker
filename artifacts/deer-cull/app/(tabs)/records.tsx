import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  useColorScheme,
  Platform,
  TextInput,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import {
  CullRecord,
  SPECIES_LABELS,
  SEX_LABELS,
  CONDITION_LABELS,
  getCurrentSeasonYear,
  seasonLabel,
  getAvailableSeasons,
} from "@/constants/types";
import {
  useCulls,
  useDeleteCull,
  useUpdateCull,
} from "@/hooks/useCulls";
import { useStalkers } from "@/hooks/useStalkers";
import { getMarkerColor } from "@/utils/markerColors";
import CullDetailSheet from "@/components/CullDetailSheet";
import CullForm from "@/components/CullForm";
import { useStalker } from "@/contexts/StalkerContext";
import { generatePDF } from "@/utils/pdf";

const ALL_SEASONS = getAvailableSeasons();

export default function RecordsScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { stalker: currentStalker } = useStalker();

  const [search, setSearch] = useState("");
  const [selectedSeason, setSelectedSeason] = useState<number | null>(getCurrentSeasonYear());
  const [selectedStalkerId, setSelectedStalkerId] = useState<number | null>(null);
  const [showSeasonPicker, setShowSeasonPicker] = useState(false);
  const [showStalkerPicker, setShowStalkerPicker] = useState(false);
  const [selectedCull, setSelectedCull] = useState<CullRecord | null>(null);
  const [editingCull, setEditingCull] = useState<CullRecord | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const { data: stalkers = [] } = useStalkers();
  const { data: culls = [], isLoading, refetch, isFetching } = useCulls({
    season: selectedSeason,
    stalkerId: selectedStalkerId,
  });
  const deleteCull = useDeleteCull();
  const updateCull = useUpdateCull();

  const filtered = culls
    .filter((c) => {
      const q = search.toLowerCase();
      return (
        !q ||
        SPECIES_LABELS[c.species].toLowerCase().includes(q) ||
        SEX_LABELS[c.sex].toLowerCase().includes(q) ||
        CONDITION_LABELS[c.condition].toLowerCase().includes(q) ||
        c.notes?.toLowerCase().includes(q) ||
        c.stalkerName?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => new Date(b.culledAt).getTime() - new Date(a.culledAt).getTime());

  const topPad = Platform.OS === "web" ? insets.top + 67 : insets.top + 12;

  async function handleExport() {
    setExportLoading(true);
    try {
      const stalkerForExport = selectedStalkerId
        ? stalkers.find((s) => s.id === selectedStalkerId)
        : undefined;
      await generatePDF(filtered, {
        season: selectedSeason ?? undefined,
        stalker: stalkerForExport,
      });
    } catch (err: any) {
      Alert.alert("Export Failed", err.message ?? "Could not generate PDF");
    } finally {
      setExportLoading(false);
    }
  }

  const activeFilterCount =
    (selectedSeason !== null ? 1 : 0) + (selectedStalkerId !== null ? 1 : 0);

  function renderItem({ item }: { item: CullRecord }) {
    const color = getMarkerColor(item.species, item.sex);
    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: C.surface,
            borderColor: C.border,
            opacity: pressed ? 0.92 : 1,
          },
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setSelectedCull(item);
          setShowDetail(true);
        }}
      >
        <View style={[styles.colorStripe, { backgroundColor: color }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardTop}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: C.text }]}>
                {SPECIES_LABELS[item.species]} — {SEX_LABELS[item.sex]}
              </Text>
              <Text style={[styles.cardSub, { color: C.textSecondary }]}>
                {new Date(item.culledAt).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
                {" · "}
                {new Date(item.culledAt).toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {item.stalkerName ? ` · ${item.stalkerName}` : ""}
              </Text>
            </View>
            <View style={styles.cardMeta}>
              {item.weight != null ? (
                <Text style={[styles.weight, { color: C.primary }]}>
                  {item.weight} kg
                </Text>
              ) : (
                <Text style={[styles.noWeight, { color: C.textSecondary }]}>
                  No weight
                </Text>
              )}
              <View
                style={[
                  styles.condBadge,
                  {
                    backgroundColor:
                      item.condition === "excellent"
                        ? "#E8F5E9"
                        : item.condition === "good"
                        ? "#E3F2FD"
                        : item.condition === "fair"
                        ? "#FFF8E1"
                        : "#FFEBEE",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.condText,
                    {
                      color:
                        item.condition === "excellent"
                          ? "#2E7D32"
                          : item.condition === "good"
                          ? "#1565C0"
                          : item.condition === "fair"
                          ? "#E65100"
                          : "#C62828",
                    },
                  ]}
                >
                  {CONDITION_LABELS[item.condition]}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.cardFooter}>
            <Ionicons name="location-outline" size={12} color={C.textSecondary} />
            <Text style={[styles.coords, { color: C.textSecondary }]}>
              {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
            </Text>
            {item.pregnant && (
              <>
                <View style={styles.dot2} />
                <Text style={[styles.coords, { color: C.warning }]}>Pregnant</Text>
              </>
            )}
            {item.notes && (
              <>
                <View style={styles.dot2} />
                <Ionicons name="chatbubble-outline" size={11} color={C.textSecondary} />
              </>
            )}
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.headerArea, { paddingTop: topPad }]}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.screenTitle, { color: C.text }]}>Records</Text>
            <Text style={[styles.screenSub, { color: C.textSecondary }]}>
              {filtered.length} cull{filtered.length !== 1 ? "s" : ""}
              {selectedSeason != null ? ` · Season ${seasonLabel(selectedSeason)}` : ""}
            </Text>
          </View>
          <Pressable
            onPress={handleExport}
            disabled={exportLoading || filtered.length === 0}
            style={({ pressed }) => [
              styles.exportBtn,
              { backgroundColor: "#2D5A3D", opacity: pressed || filtered.length === 0 ? 0.6 : 1 },
            ]}
          >
            {exportLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="document-text-outline" size={16} color="#fff" />
                <Text style={styles.exportBtnText}>PDF</Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.filterRow}>
          <Pressable
            onPress={() => setShowSeasonPicker(!showSeasonPicker)}
            style={[
              styles.filterChip,
              {
                backgroundColor: selectedSeason !== null ? "#2D5A3D" : C.surface,
                borderColor: selectedSeason !== null ? "#2D5A3D" : C.border,
              },
            ]}
          >
            <Ionicons
              name="calendar-outline"
              size={13}
              color={selectedSeason !== null ? "#fff" : C.textSecondary}
            />
            <Text
              style={[
                styles.filterChipText,
                { color: selectedSeason !== null ? "#fff" : C.text },
              ]}
            >
              {selectedSeason != null ? seasonLabel(selectedSeason) : "All Seasons"}
            </Text>
            <Ionicons
              name="chevron-down"
              size={12}
              color={selectedSeason !== null ? "#fff" : C.textSecondary}
            />
          </Pressable>

          <Pressable
            onPress={() => setShowStalkerPicker(!showStalkerPicker)}
            style={[
              styles.filterChip,
              {
                backgroundColor: selectedStalkerId !== null ? "#2D5A3D" : C.surface,
                borderColor: selectedStalkerId !== null ? "#2D5A3D" : C.border,
              },
            ]}
          >
            <Ionicons
              name="person-outline"
              size={13}
              color={selectedStalkerId !== null ? "#fff" : C.textSecondary}
            />
            <Text
              style={[
                styles.filterChipText,
                { color: selectedStalkerId !== null ? "#fff" : C.text },
              ]}
            >
              {selectedStalkerId != null
                ? stalkers.find((s) => s.id === selectedStalkerId)?.name ?? "Stalker"
                : "All Stalkers"}
            </Text>
            <Ionicons
              name="chevron-down"
              size={12}
              color={selectedStalkerId !== null ? "#fff" : C.textSecondary}
            />
          </Pressable>

          {activeFilterCount > 0 && (
            <Pressable
              onPress={() => {
                setSelectedSeason(null);
                setSelectedStalkerId(null);
              }}
              style={[styles.clearBtn, { borderColor: C.border }]}
            >
              <Ionicons name="close" size={14} color={C.textSecondary} />
            </Pressable>
          )}
        </View>

        {showSeasonPicker && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.pickerScroll}
            contentContainerStyle={{ gap: 6, paddingHorizontal: 0 }}
          >
            <Pressable
              onPress={() => { setSelectedSeason(null); setShowSeasonPicker(false); }}
              style={[
                styles.pickerPill,
                { backgroundColor: selectedSeason === null ? "#2D5A3D" : C.surface, borderColor: selectedSeason === null ? "#2D5A3D" : C.border },
              ]}
            >
              <Text style={[styles.pickerPillText, { color: selectedSeason === null ? "#fff" : C.text }]}>
                All
              </Text>
            </Pressable>
            {ALL_SEASONS.map((y) => (
              <Pressable
                key={y}
                onPress={() => { setSelectedSeason(y); setShowSeasonPicker(false); }}
                style={[
                  styles.pickerPill,
                  { backgroundColor: selectedSeason === y ? "#2D5A3D" : C.surface, borderColor: selectedSeason === y ? "#2D5A3D" : C.border },
                ]}
              >
                <Text style={[styles.pickerPillText, { color: selectedSeason === y ? "#fff" : C.text }]}>
                  {seasonLabel(y)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {showStalkerPicker && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.pickerScroll}
            contentContainerStyle={{ gap: 6, paddingHorizontal: 0 }}
          >
            <Pressable
              onPress={() => { setSelectedStalkerId(null); setShowStalkerPicker(false); }}
              style={[
                styles.pickerPill,
                { backgroundColor: selectedStalkerId === null ? "#2D5A3D" : C.surface, borderColor: selectedStalkerId === null ? "#2D5A3D" : C.border },
              ]}
            >
              <Text style={[styles.pickerPillText, { color: selectedStalkerId === null ? "#fff" : C.text }]}>
                All
              </Text>
            </Pressable>
            {stalkers.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => { setSelectedStalkerId(s.id); setShowStalkerPicker(false); }}
                style={[
                  styles.pickerPill,
                  { backgroundColor: selectedStalkerId === s.id ? "#2D5A3D" : C.surface, borderColor: selectedStalkerId === s.id ? "#2D5A3D" : C.border },
                ]}
              >
                <Text style={[styles.pickerPillText, { color: selectedStalkerId === s.id ? "#fff" : C.text }]}>
                  {s.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <View style={[styles.searchBar, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Ionicons name="search-outline" size={16} color={C.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: C.text }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search species, stalker, condition..."
            placeholderTextColor={C.textSecondary}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color={C.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.centre}>
          <ActivityIndicator color={C.primary} size="large" />
          <Text style={[styles.loadText, { color: C.textSecondary }]}>
            Loading records...
          </Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centre}>
          <Ionicons name="leaf-outline" size={56} color={C.border} />
          <Text style={[styles.emptyTitle, { color: C.text }]}>
            {search ? "No matching records" : "No culls logged yet"}
          </Text>
          <Text style={[styles.emptyText, { color: C.textSecondary }]}>
            {search
              ? "Try a different search term"
              : "Tap the map to pin a location and log your first record"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: Math.max(insets.bottom + 8, 34) },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refetch}
              tintColor={C.primary}
            />
          }
        />
      )}

      <CullDetailSheet
        cull={selectedCull}
        visible={showDetail}
        onClose={() => setShowDetail(false)}
        onEdit={(cull) => {
          setEditingCull(cull);
          setShowDetail(false);
          setShowEdit(true);
        }}
        onDelete={async (id) => {
          await deleteCull.mutateAsync(id);
          setShowDetail(false);
        }}
      />

      <CullForm
        visible={showEdit}
        onClose={() => {
          setShowEdit(false);
          setEditingCull(null);
        }}
        onSubmit={async (data) => {
          if (editingCull) {
            await updateCull.mutateAsync({ id: editingCull.id, data });
          }
          setShowEdit(false);
          setEditingCull(null);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
        initialData={editingCull ?? undefined}
        isLoading={updateCull.isPending}
        editMode
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerArea: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    gap: 12,
  },
  screenTitle: {
    fontSize: 32,
    fontWeight: "700" as const,
    fontFamily: "Inter_700Bold",
  },
  screenSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 6,
  },
  exportBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600" as const,
    fontFamily: "Inter_600SemiBold",
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    fontWeight: "500" as const,
  },
  clearBtn: {
    padding: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  pickerScroll: {
    marginBottom: 8,
  },
  pickerPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  pickerPillText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    fontWeight: "500" as const,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    padding: 0,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 10,
  },
  card: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  colorStripe: { width: 5 },
  cardBody: {
    flex: 1,
    padding: 14,
    gap: 6,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600" as const,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  cardSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  cardMeta: {
    alignItems: "flex-end",
    gap: 4,
  },
  weight: {
    fontSize: 15,
    fontWeight: "700" as const,
    fontFamily: "Inter_700Bold",
  },
  noWeight: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
  },
  condBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  condText: {
    fontSize: 11,
    fontWeight: "600" as const,
    fontFamily: "Inter_600SemiBold",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  coords: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  dot2: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#ccc",
  },
  centre: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  loadText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  emptyText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
});
