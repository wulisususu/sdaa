import { Pressable, StyleSheet, Text, View } from "react-native";

type WebErrorViewProps = {
  onRetry: () => void;
  onOpenWeb: () => void;
};

export function WebErrorView({ onRetry, onOpenWeb }: WebErrorViewProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>暂时无法打开「问得更好」</Text>
      <Text style={styles.body}>请检查网络连接后重试，或直接在系统浏览器中打开网页。</Text>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={onRetry} style={styles.primaryButton}>
          <Text style={styles.primaryText}>重新加载</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onOpenWeb} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>在浏览器中打开</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    backgroundColor: "#F6F3EA"
  },
  title: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "700",
    color: "#25231F"
  },
  body: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 23,
    color: "#666157"
  },
  actions: {
    marginTop: 24,
    gap: 10
  },
  primaryButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#25231F"
  },
  secondaryButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#C8C1B3"
  },
  primaryText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF"
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#25231F"
  }
});
