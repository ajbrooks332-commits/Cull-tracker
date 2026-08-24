import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Switch,
  useColorScheme,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import type { Stalker } from "@/constants/types";
import { useStalkers, useCreateStalker, useUpdateStalker, useDeleteStalker } from "@/hooks/useStalkers";
import { useStalker } from "@/contexts/StalkerContext";

export default function AdminScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { stalker: currentStalker } = useStalker();

  const { data: stalkers = [], isLoading } = useStalkers();
  const createStalker = useCreateStalker();
  const updateStalker = useUpdateStalker();
  const deleteStalker = useDeleteStalker();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Stalker | null>(null);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  function openCreate() {
    setEditing(null);
    setName("");
    setPin("");
    setIsAdmin(false);
    setShowForm(true);
  }

  function openEdit(s: Stalker) {
    setEditing(s);
    setName(s.name);
    setPin("");
    setIsAdmin(s.isAdmin);
    setShowForm(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert("Error", "Name is required");
      return;
    }
    if (!editing && pin.length !== 4) {
      Alert.alert("Error", "PIN must be exactly 4 digits");
      return;
    }
    if (editing && pin && pin.length !== 4) {
      Alert.alert("Error", "PIN must be exactly 4 digits");
      return;
    }
    setIsSaving(true);
    try {
      if (editing) {
        const data: { name?: string; pin?: string; isAdmin?: boolean } = {
          name: name.trim(),
          isAdmin,
        };
        if (pin) data.pin = pin;
        await updateStalker.mutateAsync({ id: editing.id, data });
      } else {
        await createStalker.mutateAsync({ name: name.trim(), pin, isAdmin });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowForm(false);
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }

  function handleDelete(s: Stalker) {
    if (s.id === currentStalker?.id) {
      Alert.alert("Error", "You cannot delete your own account");
      return;
    }
    Alert.alert(
      "Delete Stalker",
      `Remove ${s.name}? Their cull records will be kept but unassigned.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteStalker.mutateAsync(s.id);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            } catch (err: any) {
              Alert.alert("Error", err.message ?? "Failed to delete");
            }
          },
        },
      ]
    );
  }

  const topPad = Platform.OS === "web" ? insets.top + 67 : insets.top + 12;

  return (
    <View style={[styles.container, { backgroundColor: C.background }]}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </Pressable>
        <Text style={[styles.title, { color: C.text }]}>Manage Stalkers</Text>
        <Pressable
          onPress={openCreate}
          style={[styles.addBtn, { backgroundColor: "#2D5A3D" }]}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.centre}>
          <ActivityIndicator color="#2D5A3D" size="large" />
        </View>
      ) : (
        <FlatList
          data={stalkers}
          keyExtractor={(s) => String(s.id)}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: Math.max(insets.bottom + 8, 34) },
          ]}
          renderItem={({ item }) => (
            <View
              style={[
                styles.card,
                { backgroundColor: C.surface, borderColor: C.border },
              ]}
            >
              <View style={[styles.avatar, { backgroundColor: "#2D5A3D" + "22" }]}>
                <Ionicons name="person" size={22} color="#2D5A3D" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: C.text }]}>
                  {item.name}
                  {item.id === currentStalker?.id ? " (you)" : ""}
                </Text>
                <Text style={[styles.role, { color: C.textSecondary }]}>
                  {item.isAdmin ? "Administrator" : "Stalker"}
                </Text>
              </View>
              <Pressable
                onPress={() => openEdit(item)}
                style={styles.iconBtn}
              >
                <Ionicons name="pencil-outline" size={20} color={C.textSecondary} />
              </Pressable>
              <Pressable
                onPress={() => handleDelete(item)}
                style={styles.iconBtn}
              >
                <Ionicons name="trash-outline" size={20} color={C.danger} />
              </Pressable>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.centre}>
              <Text style={[styles.emptyText, { color: C.textSecondary }]}>
                No stalkers yet
              </Text>
            </View>
          }
        />
      )}

      <Modal
        visible={showForm}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowForm(false)}
      >
        <View
          style={[
            styles.modal,
            {
              backgroundColor: isDark ? "#1C1C1E" : "#F5F0E8",
              paddingTop: Platform.OS === "web" ? insets.top + 12 : 24,
            },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: C.text }]}>
              {editing ? "Edit Stalker" : "Add Stalker"}
            </Text>
            <Pressable onPress={() => setShowForm(false)} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color={C.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.modalBody}>
            <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: C.surface, borderColor: C.border, color: C.text }]}
              value={name}
              onChangeText={setName}
              placeholder="Full name"
              placeholderTextColor={C.textSecondary}
              autoCapitalize="words"
            />

            <Text style={[styles.fieldLabel, { color: C.textSecondary }]}>
              {editing ? "New PIN (leave blank to keep current)" : "PIN (4 digits)"}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: C.surface, borderColor: C.border, color: C.text }]}
              value={pin}
              onChangeText={(t) => setPin(t.replace(/\D/g, "").slice(0, 4))}
              placeholder="••••"
              placeholderTextColor={C.textSecondary}
              keyboardType="number-pad"
              secureTextEntry
            />

            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: C.text }]}>
                Administrator
              </Text>
              <Switch
                value={isAdmin}
                onValueChange={setIsAdmin}
                trackColor={{ false: C.border, true: "#2D5A3D" }}
                thumbColor="#fff"
              />
            </View>
            <Text style={[styles.switchHint, { color: C.textSecondary }]}>
              Administrators can manage stalker accounts
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.saveBtn,
                { backgroundColor: "#2D5A3D", opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>
                  {editing ? "Save Changes" : "Add Stalker"}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  backBtn: { padding: 4 },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: "700" as const,
    fontFamily: "Inter_700Bold",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600" as const,
    fontFamily: "Inter_600SemiBold",
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 10,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontSize: 16,
    fontWeight: "600" as const,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  role: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  iconBtn: { padding: 6 },
  centre: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  modal: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E0D8CC",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    fontFamily: "Inter_700Bold",
  },
  modalBody: {
    padding: 20,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600" as const,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase" as const,
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    marginBottom: 4,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 4,
  },
  switchLabel: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    fontWeight: "500" as const,
  },
  switchHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 28,
  },
  saveBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveBtnText: {
    fontSize: 17,
    fontWeight: "600" as const,
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
  },
});
