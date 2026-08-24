import { BlurView } from "expo-blur";
import { Tabs, router } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SymbolView } from "expo-symbols";
import Colors from "@/constants/colors";
import { useStalker } from "@/contexts/StalkerContext";

function TabHeader() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const C = isDark ? Colors.dark : Colors.light;
  const { stalker, signOut } = useStalker();
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";

  return (
    <View
      style={[
        headerStyles.bar,
        {
          paddingTop: isIOS ? insets.top : insets.top + 8,
          backgroundColor: "#2D5A3D",
        },
      ]}
    >
      <View style={headerStyles.left}>
        <Ionicons name="leaf" size={16} color="#A8D5B0" />
        <Text style={headerStyles.stalkerName}>{stalker?.name ?? "Unknown"}</Text>
        {stalker?.isAdmin && (
          <View style={headerStyles.adminBadge}>
            <Text style={headerStyles.adminText}>Admin</Text>
          </View>
        )}
      </View>
      <View style={headerStyles.right}>
        {stalker?.isAdmin && (
          <Pressable
            onPress={() => router.push("/admin")}
            style={headerStyles.headerBtn}
          >
            <Ionicons name="people-outline" size={18} color="#A8D5B0" />
          </Pressable>
        )}
        <Pressable
          onPress={() => {
            signOut();
            router.replace("/login");
          }}
          style={headerStyles.headerBtn}
        >
          <Ionicons name="log-out-outline" size={18} color="#A8D5B0" />
        </Pressable>
      </View>
    </View>
  );
}

const headerStyles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  left: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  stalkerName: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600" as const,
    fontFamily: "Inter_600SemiBold",
  },
  adminBadge: {
    backgroundColor: "#A8D5B022",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "#A8D5B044",
  },
  adminText: {
    color: "#A8D5B0",
    fontSize: 10,
    fontWeight: "600" as const,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  right: {
    flexDirection: "row",
    gap: 4,
  },
  headerBtn: {
    padding: 6,
  },
});

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const safeAreaInsets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1 }}>
      <TabHeader />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#2D5A3D",
          tabBarInactiveTintColor: isDark ? "#636366" : "#8E8E93",
          tabBarStyle: {
            position: "absolute",
            backgroundColor: isIOS ? "transparent" : isDark ? "#000" : "#fff",
            borderTopWidth: isWeb ? 1 : 0,
            borderTopColor: isDark ? "#333" : "#ccc",
            elevation: 0,
            paddingBottom: isWeb ? 0 : safeAreaInsets.bottom,
            ...(isWeb ? { height: 84 } : {}),
          },
          tabBarBackground: () =>
            isIOS ? (
              <BlurView
                intensity={100}
                tint={isDark ? "dark" : "light"}
                style={StyleSheet.absoluteFill}
              />
            ) : isWeb ? (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: isDark ? "#000" : "#fff" },
                ]}
              />
            ) : null,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Map",
            tabBarIcon: ({ color }) =>
              isIOS ? (
                <SymbolView name="map" tintColor={color} size={24} />
              ) : (
                <Ionicons name="map-outline" size={22} color={color} />
              ),
          }}
        />
        <Tabs.Screen
          name="records"
          options={{
            title: "Records",
            tabBarIcon: ({ color }) =>
              isIOS ? (
                <SymbolView name="list.bullet" tintColor={color} size={24} />
              ) : (
                <Feather name="list" size={22} color={color} />
              ),
          }}
        />
      </Tabs>
    </View>
  );
}
