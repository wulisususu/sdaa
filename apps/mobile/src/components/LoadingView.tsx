import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export function LoadingView() {
  return (
    <View style={styles.root} accessibilityRole="progressbar">
      <ActivityIndicator size="small" />
      <Text style={styles.label}>正在打开「问得更好」…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#F6F3EA"
  },
  label: {
    fontSize: 15,
    lineHeight: 22,
    color: "#312F2A"
  }
});
