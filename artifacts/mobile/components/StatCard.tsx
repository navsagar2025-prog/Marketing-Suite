import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentProps<typeof Feather>["name"];
  accent?: string;
  sub?: string;
}

export function StatCard({ label, value, icon, accent, sub }: StatCardProps) {
  const colors = useColors();
  const iconColor = accent ?? colors.primary;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: iconColor + "18" },
        ]}
      >
        <Feather name={icon} size={18} color={iconColor} />
      </View>
      <Text
        style={[styles.value, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}
        numberOfLines={1}
      >
        {value ?? "—"}
      </Text>
      <Text
        style={[styles.label, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {sub != null && (
        <Text
          style={[styles.sub, { color: iconColor, fontFamily: "Inter_500Medium" }]}
          numberOfLines={1}
        >
          {sub}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  value: {
    fontSize: 24,
    lineHeight: 28,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
  },
  sub: {
    fontSize: 11,
    lineHeight: 14,
    marginTop: 2,
  },
});
