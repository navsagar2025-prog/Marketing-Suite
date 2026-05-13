import React from "react";
import {
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useListLeads } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { ListItemSkeleton } from "@/components/SkeletonLoader";

interface Lead {
  id: number;
  name: string;
  email?: string | null;
  company?: string | null;
  status: string;
  score?: number | null;
  value?: number | null;
  source?: string | null;
  createdAt?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  new: { label: "New", color: "#0ea5e9" },
  contacted: { label: "Contacted", color: "#8b5cf6" },
  qualified: { label: "Qualified", color: "#f59e0b" },
  converted: { label: "Converted", color: "#10b981" },
  lost: { label: "Lost", color: "#64748b" },
};

function StatusBadge({ status }: { status: string }) {
  const colors = useColors();
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: colors.mutedForeground };
  return (
    <View style={[styles.statusBadge, { backgroundColor: cfg.color + "20" }]}>
      <Text style={[styles.statusText, { color: cfg.color, fontFamily: "Inter_600SemiBold" }]}>
        {cfg.label}
      </Text>
    </View>
  );
}

function ScoreDot({ score }: { score?: number | null }) {
  const colors = useColors();
  if (score == null) return null;
  const color =
    score >= 70 ? "#10b981"
    : score >= 40 ? "#f59e0b"
    : colors.mutedForeground;
  return (
    <View style={styles.scoreRow}>
      <View style={[styles.scoreDot, { backgroundColor: color }]} />
      <Text style={[styles.scoreText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
        {score}
      </Text>
    </View>
  );
}

function LeadRow({ item }: { item: Lead }) {
  const colors = useColors();
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={styles.avatar}>
        <Text style={[styles.avatarText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}>
          {item.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text
            style={[styles.name, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <StatusBadge status={item.status} />
        </View>
        <View style={styles.rowBottom}>
          <Text
            style={[styles.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}
            numberOfLines={1}
          >
            {item.email ?? item.company ?? item.source ?? "No details"}
          </Text>
          <ScoreDot score={item.score} />
        </View>
      </View>
    </View>
  );
}

export default function LeadsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data, isLoading, isError, refetch, isFetching } = useListLeads();
  const leads = (data as Lead[] | undefined) ?? [];

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: topPad }}>
        <View style={[styles.screenHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.screenTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            Leads
          </Text>
        </View>
        {[...Array(8)].map((_, i) => <ListItemSkeleton key={i} />)}
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={40} color={colors.destructive} />
        <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
          Failed to load
        </Text>
      </View>
    );
  }

  return (
    <FlatList<Lead>
      data={leads}
      keyExtractor={(item) => String(item.id)}
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: topPad }}
      scrollEnabled={!!leads.length}
      refreshControl={
        <RefreshControl
          refreshing={isFetching && !isLoading}
          onRefresh={refetch}
          tintColor={colors.primary}
        />
      }
      ListHeaderComponent={
        <View style={[styles.screenHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.screenTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            Leads
          </Text>
          <Text style={[styles.screenCount, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {leads.length} total
          </Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.centered}>
          <Feather name="users" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            No leads yet
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Leads captured from your forms will appear here
          </Text>
        </View>
      }
      renderItem={({ item }) => <LeadRow item={item} />}
      contentInsetAdjustmentBehavior="automatic"
    />
  );
}

const styles = StyleSheet.create({
  screenHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    marginBottom: 4,
  },
  screenTitle: {
    fontSize: 22,
    lineHeight: 28,
  },
  screenCount: {
    fontSize: 13,
    marginTop: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#0ea5e9",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 16,
    lineHeight: 20,
  },
  rowBody: {
    flex: 1,
    gap: 3,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  rowBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: {
    fontSize: 15,
    lineHeight: 20,
    flex: 1,
  },
  sub: {
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    lineHeight: 16,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  scoreDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  scoreText: {
    fontSize: 11,
    lineHeight: 16,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingTop: 80,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    lineHeight: 22,
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
