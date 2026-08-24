import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useColorScheme,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useStalker } from "@/contexts/StalkerContext";
import { useStalkers, useStalkerLogin, useCreateStalker } from "@/hooks/useStalkers";

export default function LoginScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const { signIn } = useStalker();
  const login = useStalkerLogin();
  const { data: stalkers = [], isLoading: loadingStalkers } = useStalkers();
  const createStalker = useCreateStalker();

  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  const [setupName, setSetupName] = useState("");
  const [setupPin, setSetupPin] = useState("");
  const [setupPinConfirm, setSetupPinConfirm] = useState("");

  const noStalkers = !loadingStalkers && stalkers.length === 0;

  async function handleLogin() {
    if (!selectedName || pin.length !== 4) return;
    setIsSubmitting(true);
    try {
      const stalker = await login(selectedName, pin);
      await signIn(stalker);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Sign In Failed", err.message ?? "Invalid name or PIN");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSetupAdmin() {
    if (!setupName.trim()) {
      Alert.alert("Error", "Please enter your name");
      return;
    }
    if (setupPin.length !== 4) {
      Alert.alert("Error", "PIN must be exactly 4 digits");
      return;
    }
    if (setupPin !== setupPinConfirm) {
      Alert.alert("Error", "PINs do not match");
      return;
    }
    setIsSubmitting(true);
    try {
      const stalker = await createStalker.mutateAsync({
        name: setupName.trim(),
        pin: setupPin,
        isAdmin: true,
      });
      await signIn(stalker);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Failed to create account");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            backgroundColor: C.background,
            paddingTop: insets.top + 48,
            paddingBottom: insets.bottom + 32,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoArea}>
          <View style={[styles.logoCircle, { backgroundColor: "#2D5A3D" }]}>
            <Ionicons name="leaf" size={40} color="#fff" />
          </View>
          <Text style={[styles.appName, { color: C.text }]}>
            Deer Cull Records
          </Text>
          <Text style={[styles.appSub, { color: C.textSecondary }]}>
            Estate Management
          </Text>
        </View>

        {loadingStalkers ? (
          <ActivityIndicator color="#2D5A3D" size="large" style={{ marginTop: 48 }} />
        ) : noStalkers || showSetup ? (
          <View style={styles.card}>
            <Text style={[styles.cardTitle, { color: C.text }]}>
              {noStalkers ? "First Time Setup" : "Add Your Account"}
            </Text>
            <Text style={[styles.cardSub, { color: C.textSecondary }]}>
              {noStalkers
                ? "Create the first account. You will be set as administrator."
                : "Create a new stalker account."}
            </Text>

            <Text style={[styles.label, { color: C.textSecondary }]}>Your Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: C.surface, borderColor: C.border, color: C.text }]}
              value={setupName}
              onChangeText={setSetupName}
              placeholder="e.g. John MacLeod"
              placeholderTextColor={C.textSecondary}
              autoCapitalize="words"
            />

            <Text style={[styles.label, { color: C.textSecondary }]}>PIN (4 digits)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: C.surface, borderColor: C.border, color: C.text }]}
              value={setupPin}
              onChangeText={(t) => setSetupPin(t.replace(/\D/g, "").slice(0, 4))}
              placeholder="••••"
              placeholderTextColor={C.textSecondary}
              keyboardType="number-pad"
              secureTextEntry
            />

            <Text style={[styles.label, { color: C.textSecondary }]}>Confirm PIN</Text>
            <TextInput
              style={[styles.input, { backgroundColor: C.surface, borderColor: C.border, color: C.text }]}
              value={setupPinConfirm}
              onChangeText={(t) => setSetupPinConfirm(t.replace(/\D/g, "").slice(0, 4))}
              placeholder="••••"
              placeholderTextColor={C.textSecondary}
              keyboardType="number-pad"
              secureTextEntry
            />

            <Pressable
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: "#2D5A3D", opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={handleSetupAdmin}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Create Account</Text>
              )}
            </Pressable>

            {!noStalkers && (
              <Pressable onPress={() => setShowSetup(false)} style={{ marginTop: 16, alignItems: "center" }}>
                <Text style={{ color: "#2D5A3D", fontFamily: "Inter_500Medium", fontSize: 14 }}>
                  Back to Sign In
                </Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={[styles.cardTitle, { color: C.text }]}>Sign In</Text>
            <Text style={[styles.cardSub, { color: C.textSecondary }]}>
              Select your name and enter your PIN
            </Text>

            <Text style={[styles.label, { color: C.textSecondary }]}>Select Stalker</Text>
            <View style={styles.stalkerList}>
              {stalkers.map((s) => (
                <Pressable
                  key={s.id}
                  style={[
                    styles.stalkerPill,
                    {
                      backgroundColor:
                        selectedName === s.name ? "#2D5A3D" : C.surface,
                      borderColor:
                        selectedName === s.name ? "#2D5A3D" : C.border,
                    },
                  ]}
                  onPress={() => {
                    setSelectedName(s.name);
                    Haptics.selectionAsync();
                  }}
                >
                  <Ionicons
                    name="person-outline"
                    size={14}
                    color={selectedName === s.name ? "#fff" : C.textSecondary}
                  />
                  <Text
                    style={[
                      styles.stalkerPillText,
                      { color: selectedName === s.name ? "#fff" : C.text },
                    ]}
                  >
                    {s.name}
                    {s.isAdmin ? " ★" : ""}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.label, { color: C.textSecondary }]}>PIN</Text>
            <TextInput
              style={[styles.input, { backgroundColor: C.surface, borderColor: C.border, color: C.text }]}
              value={pin}
              onChangeText={(t) => setPin(t.replace(/\D/g, "").slice(0, 4))}
              placeholder="4-digit PIN"
              placeholderTextColor={C.textSecondary}
              keyboardType="number-pad"
              secureTextEntry
            />

            <Pressable
              style={({ pressed }) => [
                styles.btn,
                {
                  backgroundColor:
                    selectedName && pin.length === 4 ? "#2D5A3D" : C.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              onPress={handleLogin}
              disabled={isSubmitting || !selectedName || pin.length !== 4}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Sign In</Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => setShowSetup(true)}
              style={{ marginTop: 16, alignItems: "center" }}
            >
              <Text
                style={{
                  color: "#2D5A3D",
                  fontFamily: "Inter_500Medium",
                  fontSize: 14,
                }}
              >
                Add a new stalker account
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  logoArea: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  appName: {
    fontSize: 26,
    fontWeight: "700" as const,
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
  },
  appSub: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  card: {
    width: "100%",
    maxWidth: 420,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: "700" as const,
    fontFamily: "Inter_700Bold",
    marginBottom: 6,
  },
  cardSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginBottom: 28,
    lineHeight: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: "600" as const,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase" as const,
    marginBottom: 8,
    marginTop: 4,
  },
  stalkerList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  stalkerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1.5,
  },
  stalkerPillText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontFamily: "Inter_400Regular",
    marginBottom: 16,
    letterSpacing: 4,
  },
  btn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  btnText: {
    fontSize: 17,
    fontWeight: "600" as const,
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
  },
});
