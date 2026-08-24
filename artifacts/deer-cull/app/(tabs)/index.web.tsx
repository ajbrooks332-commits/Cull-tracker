import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCulls, useCreateCull, useUpdateCull, useDeleteCull } from "@/hooks/useCulls";
import type { CullRecord } from "@/constants/types";
import CullForm from "@/components/CullForm";
import CullDetailSheet from "@/components/CullDetailSheet";
import MapWebFallback from "@/components/MapWebFallback";
import * as Haptics from "expo-haptics";
import { useStalker } from "@/contexts/StalkerContext";

export default function MapScreenWeb() {
  const insets = useSafeAreaInsets();
  const { stalker } = useStalker();
  const { data: culls = [] } = useCulls();
  const createCull = useCreateCull();
  const updateCull = useUpdateCull();
  const deleteCull = useDeleteCull();

  const [showForm, setShowForm] = useState(false);
  const [editingCull, setEditingCull] = useState<CullRecord | null>(null);
  const [selectedCull, setSelectedCull] = useState<CullRecord | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  async function handleFormSubmit(data: Omit<CullRecord, "id" | "createdAt" | "updatedAt" | "stalkerName">) {
    const payload = { ...data, stalkerId: data.stalkerId ?? stalker?.id ?? null };
    if (editingCull) {
      await updateCull.mutateAsync({ id: editingCull.id, data: payload });
    } else {
      await createCull.mutateAsync(payload);
    }
    setShowForm(false);
    setEditingCull(null);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 67 }]}>
      <MapWebFallback
        onAdd={() => {
          setEditingCull(null);
          setShowForm(true);
        }}
      />
      <CullForm
        visible={showForm}
        onClose={() => { setShowForm(false); setEditingCull(null); }}
        onSubmit={handleFormSubmit}
        initialData={editingCull ?? undefined}
        isLoading={createCull.isPending || updateCull.isPending}
        editMode={!!editingCull}
      />
      <CullDetailSheet
        cull={selectedCull}
        visible={showDetail}
        onClose={() => setShowDetail(false)}
        onEdit={(cull) => {
          setEditingCull(cull);
          setShowDetail(false);
          setShowForm(true);
        }}
        onDelete={async (id) => {
          await deleteCull.mutateAsync(id);
          setShowDetail(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
