import React from "react";
import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGetAnalyticsSummary } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { StatCard } from "@/components/StatCard";
import { StatCardSkeleton } from "@/components/SkeletonLoader";

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const { data, isLoading, isError, refetch, isFetching } = useGetAnalyticsSummary();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 16 }]}
      refreshControl={
        <RefreshControl
          refreshing={isFetching && !isLoading}
          onRefresh={refetch}
          tintColor={colors.primary}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            Welcome back
          </Text>
          <Text style={[styles.username, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            {user?.username ?? "Admin"}
          </Text>
        </View>
      </View>

      <Text style={[styles.sectionLabel, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
        OVERVIEW
      </Text>

      {isError ? (
        <View style={[styles.errorBox, { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "40" }]}>
          <Text style={[styles.errorText, { color: colors.destructive, fontFamily: "Inter_500Medium" }]}>
            Failed to load data. Pull to refresh.
          </Text>
        </View>
      ) : isLoading ? (
        <>
          <View style={styles.row}>
            <StatCardSkeleton />
            <StatCardSkeleton />
          </View>
          <View style={styles.row}>
            <StatCardSkeleton />
            <StatCardSkeleton />
          </View>
          <View style={styles.row}>
            <StatCardSkeleton />
            <StatCardSkeleton />
          </View>
        </>
      ) : (
        <>
          <View style={styles.row}>
            <StatCard
              label="Websites"
              value={data?.totalWebsites ?? 0}
              icon="globe"
              accent={colors.primary}
            />
            <StatCard
              label="Keywords"
              value={data?.totalKeywords ?? 0}
              icon="search"
              accent="#6366f1"
            />
          </View>
          <View style={styles.row}>
            <StatCard
              label="Total Leads"
              value={data?.totalLeads ?? 0}
              icon="users"
              accent="#10b981"
              sub={`${data?.highIntentLeads ?? 0} high intent`}
            />
            <StatCard
              label="Converted"
              value={data?.convertedLeads ?? 0}
              icon="check-circle"
              accent="#10b981"
            />
          </View>
          <View style={styles.row}>
            <StatCard
              label="Campaigns"
              value={data?.totalCampaigns ?? 0}
              icon="zap"
              accent="#f59e0b"
              sub={`${data?.activeCampaigns ?? 0} active`}
            />
            <StatCard
              label="Backlinks"
              value={data?.totalBacklinks ?? 0}
              icon="link"
              accent="#8b5cf6"
              sub={`${data?.securedBacklinks ?? 0} secured`}
            />
          </View>
          {data?.avgSeoScore != null && (
            <View style={styles.row}>
              <StatCard
                label="Avg SEO Score"
                value={`${Math.round(data.avgSeoScore)}/100`}
                icon="bar-chart-2"
                accent={data.avgSeoScore >= 70 ? "#10b981" : data.avgSeoScore >= 40 ? "#f59e0b" : colors.destructive}
              />
              <StatCard
                label="Scheduled Posts"
                value={data?.scheduledPosts ?? 0}
                icon="calendar"
                accent="#0ea5e9"
              />
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  greeting: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 2,
  },
  username: {
    fontSize: 22,
    lineHeight: 28,
  },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
  },
  errorText: {
    fontSize: 14,
    textAlign: "center",
  },
});
