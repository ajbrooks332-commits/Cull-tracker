import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  useColorScheme,
  Platform,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import {
  CullRecord,
  SPECIES_LABELS,
  SEX_LABELS,
  CONDITION_LABELS,
} from "@/constants/types";
import { getMarkerColor } from "@/utils/markerColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Props {
  cull: CullRecord | null;
  visible: boolean;
  onClose: () => void;
  onEdit: (cull: CullRecord) => void;
  onDelete: (id: number) => void;
}

export default function CullDetailSheet({
  cull,
  visible,
  onClose,
  onEdit,
  onDelete,
}: Props) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  if (!cull) return null;
  const color = getMarkerColor(cull.species, cull.sex);

  function handleDelete() {
    Alert.alert(
      "Delete Record",
      `Delete cull record #${cull!.id}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            onDelete(cull!.id);
            onClose();
          },
        },
      ]
    );
  }

  const styles = makeStyles(C, isDark, color);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.container,
          { paddingTop: Platform.OS === "web" ? insets.top + 12 : 16 },
        ]}
      >
        <View style={styles.header}>
          <View style={[styles.colorBar, { backgroundColor: color }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.id}>Record #{cull.id}</Text>
            <Text style={styles.title}>
              {SPECIES_LABELS[cull.species]} — {SEX_LABELS[cull.sex]}
            </Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={C.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.grid}>
            <InfoTile
              icon="scale-outline"
              label="Weight"
              value={cull.weight != null ? `${cull.weight} kg` : "Not recorded"}
              C={C}
              dimmed={cull.weight == null}
            />
            <InfoTile
              icon="heart-outline"
              label="Condition"
              value={CONDITION_LABELS[cull.condition]}
              C={C}
            />
            <InfoTile
              icon="calendar-outline"
              label="Date & Time"
              value={new Date(cull.culledAt).toLocaleString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
              C={C}
            />
            {cull.stalkerName && (
              <InfoTile
                icon="person-outline"
                label="Stalker"
                value={cull.stalkerName}
                C={C}
              />
            )}
            {cull.pregnant != null && (
              <InfoTile
                icon="baby-outline"
                label="Pregnant"
                value={cull.pregnant ? "Yes" : "No"}
                C={C}
                highlight={cull.pregnant}
              />
            )}
          </View>

          <View style={styles.locationCard}>
            <Ionicons name="location-outline" size={18} color={C.primary} />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={styles.locationLabel}>GPS Location</Text>
              <Text style={styles.locationValue}>
                {cull.latitude.toFixed(6)}°N, {cull.longitude.toFixed(6)}°E
              </Text>
            </View>
          </View>

          {cull.notes ? (
            <View style={styles.notesCard}>
              <Text style={styles.notesLabel}>Notes</Text>
              <Text style={styles.notesText}>{cull.notes}</Text>
            </View>
          ) : null}

          <Text style={styles.timestamp}>
            Logged:{" "}
            {new Date(cull.createdAt).toLocaleString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
          {cull.updatedAt !== cull.createdAt && (
            <Text style={styles.timestamp}>
              Updated:{" "}
              {new Date(cull.updatedAt).toLocaleString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          )}
        </ScrollView>

        <View
          style={[
            styles.actions,
            { paddingBottom: Math.max(insets.bottom, 20) },
          ]}
        >
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              styles.editBtn,
              { opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onEdit(cull);
            }}
          >
            <Ionicons name="pencil" size={18} color="#fff" />
            <Text style={styles.actionText}>Edit</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              styles.deleteBtn,
              { opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={handleDelete}
          >
            <Ionicons name="trash-outline" size={18} color={C.danger} />
            <Text style={[styles.actionText, { color: C.danger }]}>Delete</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function InfoTile({
  icon,
  label,
  value,
  C,
  dimmed,
  highlight,
}: {
  icon: string;
  label: string;
  value: string;
  C: (typeof Colors)["light"];
  dimmed?: boolean;
  highlight?: boolean;
}) {
  return (
    <View style={tileSt.tile}>
      <Ionicons
        name={icon as any}
        size={20}
        color={highlight ? C.warning : C.primary}
        style={{ marginBottom: 6 }}
      />
      <Text style={[tileSt.value, dimmed && { color: C.textSecondary }]}>
        {value}
      </Text>
      <Text style={tileSt.label}>{label}</Text>
    </View>
  );
}

const tileSt = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "rgba(0,0,0,0.04)",
    borderRadius: 12,
    padding: 14,
    margin: 4,
    alignItems: "flex-start",
  },
  value: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: "#1C1C1E",
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  label: {
    fontSize: 12,
    color: "#8B6F47",
    fontFamily: "Inter_400Regular",
  },
});

function makeStyles(C: (typeof Colors)["light"], isDark: boolean, color: string) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? "#1C1C1E" : "#F5F0E8",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    colorBar: {
      width: 6,
      height: 48,
      borderRadius: 3,
      marginRight: 14,
    },
    id: {
      fontSize: 12,
      color: C.textSecondary,
      fontFamily: "Inter_500Medium",
      letterSpacing: 0.5,
      textTransform: "uppercase",
      marginBottom: 2,
    },
    title: {
      fontSize: 20,
      fontWeight: "700" as const,
      color: C.text,
      fontFamily: "Inter_700Bold",
    },
    closeBtn: { padding: 4 },
    content: {
      padding: 16,
      paddingBottom: 24,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      margin: -4,
      marginBottom: 12,
    },
    locationCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: C.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: C.border,
    },
    locationLabel: {
      fontSize: 12,
      color: C.textSecondary,
      fontFamily: "Inter_500Medium",
      marginBottom: 2,
    },
    locationValue: {
      fontSize: 14,
      color: C.text,
      fontFamily: "Inter_400Regular",
    },
    notesCard: {
      backgroundColor: C.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: C.border,
    },
    notesLabel: {
      fontSize: 12,
      color: C.textSecondary,
      fontFamily: "Inter_500Medium",
      marginBottom: 4,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    notesText: {
      fontSize: 15,
      color: C.text,
      fontFamily: "Inter_400Regular",
      lineHeight: 22,
    },
    timestamp: {
      fontSize: 11,
      color: C.textSecondary,
      fontFamily: "Inter_400Regular",
      marginBottom: 2,
    },
    actions: {
      flexDirection: "row",
      padding: 16,
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: C.border,
    },
    actionBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 14,
      borderRadius: 12,
      gap: 8,
    },
    editBtn: {
      backgroundColor: C.primary,
    },
    deleteBtn: {
      backgroundColor: isDark ? "#2C2C2E" : "#FFF0EE",
      borderWidth: 1,
      borderColor: C.danger + "40",
    },
    actionText: {
      fontSize: 16,
      fontWeight: "600" as const,
      color: "#fff",
      fontFamily: "Inter_600SemiBold",
    },
  });
}
