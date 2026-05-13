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
import { useListKeywords } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { ListItemSkeleton } from "@/components/SkeletonLoader";

interface Keyword {
  id: number;
  keyword: string;
  currentPosition?: number | null;
  previousPosition?: number | null;
  volume?: number | null;
  difficulty?: number | null;
  createdAt?: string;
}

function RankBadge({ pos }: { pos: number | null | undefined }) {
  const colors = useColors();
  if (pos == null) {
    return (
      <View style={[styles.badge, { backgroundColor: colors.muted }]}>
        <Text style={[styles.badgeText, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
          —
        </Text>
      </View>
    );
  }
  const bg =
    pos <= 3 ? "#10b981" + "20"
    : pos <= 10 ? colors.primary + "20"
    : pos <= 30 ? "#f59e0b" + "20"
    : colors.muted;
  const fg =
    pos <= 3 ? "#10b981"
    : pos <= 10 ? colors.primary
    : pos <= 30 ? "#f59e0b"
    : colors.mutedForeground;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg, fontFamily: "Inter_600SemiBold" }]}>
        #{pos}
      </Text>
    </View>
  );
}

function TrendIcon({ current, previous }: { current?: number | null; previous?: number | null }) {
  const colors = useColors();
  if (current == null || previous == null) return null;
  const diff = previous - current;
  if (diff > 0) {
    return <Feather name="trending-up" size={13} color="#10b981" style={{ marginLeft: 4 }} />;
  } else if (diff < 0) {
    return <Feather name="trending-down" size={13} color={colors.destructive} style={{ marginLeft: 4 }} />;
  }
  return <Feather name="minus" size={13} color={colors.mutedForeground} style={{ marginLeft: 4 }} />;
}

function KeywordRow({ item }: { item: Keyword }) {
  const colors = useColors();
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={styles.rowLeft}>
        <View style={styles.keywordLine}>
          <Text
            style={[styles.keyword, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}
            numberOfLines={1}
          >
            {item.keyword}
          </Text>
          <TrendIcon current={item.currentPosition} previous={item.previousPosition} />
        </View>
        <View style={styles.meta}>
          {item.volume != null && (
            <Text style={[styles.metaText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {item.volume.toLocaleString()} vol
            </Text>
          )}
          {item.difficulty != null && (
            <Text style={[styles.metaText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              · KD {item.difficulty}
            </Text>
          )}
        </View>
      </View>
      <RankBadge pos={item.currentPosition} />
    </View>
  );
}

export default function KeywordsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data, isLoading, isError, refetch, isFetching } = useListKeywords();

  const keywords = (data as Keyword[] | undefined) ?? [];

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: topPad }}>
        <View style={[styles.screenHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.screenTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            Keywords
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
        <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          Pull to refresh
        </Text>
      </View>
    );
  }

  return (
    <FlatList<Keyword>
      data={keywords}
      keyExtractor={(item) => String(item.id)}
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: topPad }}
      scrollEnabled={!!keywords.length}
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
            Keywords
          </Text>
          <Text style={[styles.screenCount, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {keywords.length} tracked
          </Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.centered}>
          <Feather name="search" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            No keywords yet
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Add keywords from the web app to track rankings
          </Text>
        </View>
      }
      renderItem={({ item }) => <KeywordRow item={item} />}
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  rowLeft: {
    flex: 1,
    marginRight: 12,
  },
  keywordLine: {
    flexDirection: "row",
    alignItems: "center",
  },
  keyword: {
    fontSize: 15,
    lineHeight: 20,
    flexShrink: 1,
  },
  meta: {
    flexDirection: "row",
    marginTop: 3,
    gap: 2,
  },
  metaText: {
    fontSize: 12,
    lineHeight: 16,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 48,
    alignItems: "center",
  },
  badgeText: {
    fontSize: 13,
    lineHeight: 18,
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
