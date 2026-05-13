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
import { Feather } from "@expo/vector-icons";
import { useGetAnalyticsSummary } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { Skeleton } from "@/components/SkeletonLoader";

interface MetricRowProps {
  label: string;
  value: string | number;
  icon: React.ComponentProps<typeof Feather>["name"];
  accent?: string;
  note?: string;
}

function MetricRow({ label, value, icon, accent, note }: MetricRowProps) {
  const colors = useColors();
  const iconColor = accent ?? colors.primary;
  return (
    <View style={[styles.metricRow, { borderBottomColor: colors.border }]}>
      <View style={[styles.metricIcon, { backgroundColor: iconColor + "18" }]}>
        <Feather name={icon} size={16} color={iconColor} />
      </View>
      <View style={styles.metricBody}>
        <Text style={[styles.metricLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          {label}
        </Text>
        {note && (
          <Text style={[styles.metricNote, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {note}
          </Text>
        )}
      </View>
      <Text style={[styles.metricValue, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
        {value}
      </Text>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  const colors = useColors();
  return (
    <Text style={[styles.sectionHeader, { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
      {title}
    </Text>
  );
}

function SeoScoreBar({ score }: { score: number }) {
  const colors = useColors();
  const color =
    score >= 70 ? "#10b981"
    : score >= 40 ? "#f59e0b"
    : colors.destructive;
  return (
    <View style={[styles.scoreCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.scoreTop}>
        <Text style={[styles.scoreLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
          Avg SEO Score
        </Text>
        <Text style={[styles.scoreValue, { color, fontFamily: "Inter_700Bold" }]}>
          {Math.round(score)}/100
        </Text>
      </View>
      <View style={[styles.barTrack, { backgroundColor: colors.muted }]}>
        <View style={[styles.barFill, { width: `${score}%` as `${number}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export default function AnalyticsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data, isLoading, isError, refetch, isFetching } = useGetAnalyticsSummary();

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
      <Text style={[styles.pageTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
        Analytics
      </Text>

      {isError ? (
        <View style={[styles.errorBox, { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "40" }]}>
          <Feather name="alert-circle" size={20} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.destructive, fontFamily: "Inter_500Medium" }]}>
            Failed to load. Pull to refresh.
          </Text>
        </View>
      ) : isLoading ? (
        <View style={{ gap: 16 }}>
          {[...Array(8)].map((_, i) => (
            <View key={i} style={styles.skeletonRow}>
              <Skeleton width={36} height={36} borderRadius={8} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width="60%" height={13} />
                <Skeleton width="40%" height={11} />
              </View>
              <Skeleton width={40} height={18} />
            </View>
          ))}
        </View>
      ) : (
        <>
          {/* SEO Score */}
          {data?.avgSeoScore != null && (
            <>
              <SectionHeader title="SEO HEALTH" />
              <SeoScoreBar score={data.avgSeoScore} />
            </>
          )}

          {/* Content & Reach */}
          <SectionHeader title="CONTENT & REACH" />
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <MetricRow
              label="Tracked Keywords"
              value={data?.totalKeywords ?? 0}
              icon="search"
              accent="#6366f1"
            />
            <MetricRow
              label="Websites"
              value={data?.totalWebsites ?? 0}
              icon="globe"
              accent={colors.primary}
            />
            <MetricRow
              label="Backlinks"
              value={data?.totalBacklinks ?? 0}
              icon="link"
              accent="#8b5cf6"
              note={`${data?.securedBacklinks ?? 0} secured`}
            />
          </View>

          {/* Lead Pipeline */}
          <SectionHeader title="LEAD PIPELINE" />
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <MetricRow
              label="Total Leads"
              value={data?.totalLeads ?? 0}
              icon="users"
              accent="#10b981"
            />
            <MetricRow
              label="Converted"
              value={data?.convertedLeads ?? 0}
              icon="check-circle"
              accent="#10b981"
              note={`${data?.totalLeads ? Math.round(((data.convertedLeads ?? 0) / data.totalLeads) * 100) : 0}% rate`}
            />
            <MetricRow
              label="High Intent"
              value={data?.highIntentLeads ?? 0}
              icon="star"
              accent="#f59e0b"
            />
          </View>

          {/* Campaigns */}
          <SectionHeader title="CAMPAIGNS" />
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <MetricRow
              label="Total Campaigns"
              value={data?.totalCampaigns ?? 0}
              icon="zap"
              accent="#f59e0b"
            />
            <MetricRow
              label="Active Now"
              value={data?.activeCampaigns ?? 0}
              icon="play-circle"
              accent="#10b981"
            />
            <MetricRow
              label="Scheduled Posts"
              value={data?.scheduledPosts ?? 0}
              icon="calendar"
              accent={colors.primary}
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    gap: 10,
  },
  pageTitle: {
    fontSize: 22,
    lineHeight: 28,
    marginBottom: 10,
  },
  sectionHeader: {
    fontSize: 11,
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 2,
  },
  section: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  metricIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  metricBody: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  metricNote: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 1,
  },
  metricValue: {
    fontSize: 18,
    lineHeight: 22,
  },
  scoreCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  scoreTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scoreLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  scoreValue: {
    fontSize: 22,
    lineHeight: 28,
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
  },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
  },
  errorText: {
    fontSize: 14,
    flex: 1,
  },
});
