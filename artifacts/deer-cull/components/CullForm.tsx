import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  useColorScheme,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import {
  Species,
  Sex,
  Condition,
  CullRecord,
  SPECIES_LABELS,
  SEX_LABELS,
  CONDITION_LABELS,
  VALID_SEX_FOR_SPECIES,
  FEMALE_SEX,
} from "@/constants/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SPECIES_LIST = Object.keys(SPECIES_LABELS) as Species[];
const CONDITIONS: Condition[] = ["excellent", "good", "fair", "poor"];

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<CullRecord, "id" | "createdAt" | "updatedAt">) => void;
  initialData?: Partial<CullRecord>;
  latitude?: number;
  longitude?: number;
  isLoading?: boolean;
  editMode?: boolean;
}

export default function CullForm({
  visible,
  onClose,
  onSubmit,
  initialData,
  latitude,
  longitude,
  isLoading,
  editMode,
}: Props) {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();

  const [species, setSpecies] = useState<Species>("red_deer");
  const [sex, setSex] = useState<Sex>("stag");
  const [weight, setWeight] = useState("");
  const [condition, setCondition] = useState<Condition>("good");
  const [pregnant, setPregnant] = useState(false);
  const [notes, setNotes] = useState("");
  const [lat, setLat] = useState(latitude?.toFixed(6) ?? "");
  const [lng, setLng] = useState(longitude?.toFixed(6) ?? "");

  useEffect(() => {
    if (visible) {
      if (initialData) {
        setSpecies((initialData.species as Species) ?? "red_deer");
        setSex((initialData.sex as Sex) ?? "stag");
        setWeight(initialData.weight?.toString() ?? "");
        setCondition((initialData.condition as Condition) ?? "good");
        setPregnant(initialData.pregnant ?? false);
        setNotes(initialData.notes ?? "");
        setLat(initialData.latitude?.toFixed(6) ?? "");
        setLng(initialData.longitude?.toFixed(6) ?? "");
      } else {
        setSpecies("red_deer");
        setSex("stag");
        setWeight("");
        setCondition("good");
        setPregnant(false);
        setNotes("");
        setLat(latitude?.toFixed(6) ?? "");
        setLng(longitude?.toFixed(6) ?? "");
      }
    }
  }, [visible, initialData, latitude, longitude]);

  const validSexOptions = VALID_SEX_FOR_SPECIES[species];
  const isFemale = FEMALE_SEX.includes(sex);
  const showPregnant = isFemale;

  function handleSpeciesChange(s: Species) {
    setSpecies(s);
    const validSex = VALID_SEX_FOR_SPECIES[s];
    if (!validSex.includes(sex)) {
      setSex(validSex[0]);
    }
    Haptics.selectionAsync();
  }

  function handleSubmit() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSubmit({
      species,
      sex,
      weight: weight ? parseFloat(weight) : null,
      condition,
      pregnant: showPregnant ? pregnant : null,
      latitude: parseFloat(lat),
      longitude: parseFloat(lng),
      notes: notes || null,
      culledAt: initialData?.culledAt ?? new Date().toISOString(),
    });
  }

  const styles = makeStyles(C, isDark);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={[
            styles.container,
            { paddingTop: Platform.OS === "web" ? insets.top + 12 : 16 },
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.title}>
              {editMode ? "Edit Record" : "Log Deer Cull"}
            </Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={C.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Section title="Species" C={C}>
              <View style={styles.pillRow}>
                {SPECIES_LIST.map((s) => (
                  <Pressable
                    key={s}
                    style={[
                      styles.pill,
                      species === s && { backgroundColor: C.primary },
                    ]}
                    onPress={() => handleSpeciesChange(s)}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        species === s && { color: "#fff" },
                      ]}
                    >
                      {SPECIES_LABELS[s]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Section>

            <Section title="Sex" C={C}>
              <View style={styles.pillRow}>
                {validSexOptions.map((s) => (
                  <Pressable
                    key={s}
                    style={[
                      styles.pill,
                      sex === s && { backgroundColor: C.primary },
                    ]}
                    onPress={() => {
                      setSex(s);
                      Haptics.selectionAsync();
                    }}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        sex === s && { color: "#fff" },
                      ]}
                    >
                      {SEX_LABELS[s]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Section>

            <Section title="Body Condition" C={C}>
              <View style={styles.pillRow}>
                {CONDITIONS.map((c) => (
                  <Pressable
                    key={c}
                    style={[
                      styles.pill,
                      condition === c && { backgroundColor: C.primary },
                    ]}
                    onPress={() => {
                      setCondition(c);
                      Haptics.selectionAsync();
                    }}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        condition === c && { color: "#fff" },
                      ]}
                    >
                      {CONDITION_LABELS[c]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Section>

            <Section title="Weight (kg)" C={C} optional>
              <TextInput
                style={styles.input}
                value={weight}
                onChangeText={setWeight}
                placeholder="e.g. 68.5  (optional)"
                placeholderTextColor={C.textSecondary}
                keyboardType="decimal-pad"
              />
            </Section>

            {showPregnant && (
              <Section title="Pregnant" C={C}>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>
                    {pregnant ? "Yes" : "No"}
                  </Text>
                  <Switch
                    value={pregnant}
                    onValueChange={(v) => {
                      setPregnant(v);
                      Haptics.selectionAsync();
                    }}
                    trackColor={{ false: C.border, true: C.primary }}
                    thumbColor="#fff"
                  />
                </View>
              </Section>
            )}

            <Section title="Location" C={C}>
              <View style={styles.coordRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.coordLabel}>Latitude</Text>
                  <TextInput
                    style={styles.input}
                    value={lat}
                    onChangeText={setLat}
                    placeholder="51.5074"
                    placeholderTextColor={C.textSecondary}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.coordLabel}>Longitude</Text>
                  <TextInput
                    style={styles.input}
                    value={lng}
                    onChangeText={setLng}
                    placeholder="-0.1278"
                    placeholderTextColor={C.textSecondary}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            </Section>

            <Section title="Notes" C={C} optional>
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Any additional observations..."
                placeholderTextColor={C.textSecondary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </Section>

            <Pressable
              style={({ pressed }) => [
                styles.submitBtn,
                { backgroundColor: C.primary, opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>
                  {editMode ? "Save Changes" : "Log Cull"}
                </Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Section({
  title,
  children,
  C,
  optional,
}: {
  title: string;
  children: React.ReactNode;
  C: (typeof Colors)["light"];
  optional?: boolean;
}) {
  return (
    <View style={{ marginBottom: 20 }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
        <Text
          style={{
            fontSize: 13,
            fontWeight: "600" as const,
            letterSpacing: 0.8,
            textTransform: "uppercase" as const,
            color: C.textSecondary,
            fontFamily: "Inter_600SemiBold",
          }}
        >
          {title}
        </Text>
        {optional && (
          <Text
            style={{
              fontSize: 11,
              color: C.textSecondary,
              opacity: 0.6,
              marginLeft: 6,
              fontFamily: "Inter_400Regular",
            }}
          >
            optional
          </Text>
        )}
      </View>
      {children}
    </View>
  );
}

function makeStyles(C: (typeof Colors)["light"], isDark: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? "#1C1C1E" : "#F5F0E8",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    title: {
      fontSize: 20,
      fontWeight: "700" as const,
      color: C.text,
      fontFamily: "Inter_700Bold",
    },
    closeBtn: {
      padding: 4,
    },
    scroll: { flex: 1 },
    content: {
      padding: 20,
      paddingBottom: 40,
    },
    pillRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    pill: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.surface,
    },
    pillText: {
      fontSize: 14,
      color: C.text,
      fontFamily: "Inter_500Medium",
    },
    input: {
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: C.text,
      fontFamily: "Inter_400Regular",
    },
    notesInput: {
      height: 80,
      paddingTop: 12,
    },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: C.surface,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    switchLabel: {
      fontSize: 16,
      color: C.text,
      fontFamily: "Inter_400Regular",
    },
    coordRow: {
      flexDirection: "row",
    },
    coordLabel: {
      fontSize: 12,
      color: C.textSecondary,
      marginBottom: 4,
      fontFamily: "Inter_500Medium",
    },
    submitBtn: {
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 8,
    },
    submitText: {
      fontSize: 17,
      fontWeight: "600" as const,
      color: "#fff",
      fontFamily: "Inter_600SemiBold",
    },
  });
}
