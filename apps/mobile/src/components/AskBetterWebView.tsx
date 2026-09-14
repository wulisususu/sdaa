import { useCallback, useRef, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

import { ASK_BETTER_WEB_URL } from "../config";
import { classifyNavigation } from "../navigation-policy";
import { shouldShowNativeLoadError } from "../webview-shell-state";
import { LoadingView } from "./LoadingView";
import { WebErrorView } from "./WebErrorView";

export function AskBetterWebView() {
  const [reloadEpoch, setReloadEpoch] = useState(0);
  const [showNativeError, setShowNativeError] = useState(false);
  const hasLoadedMainDocument = useRef(false);

  const openExternalUrl = useCallback(async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      // Android may have no handler for a particular external scheme.
    }
  }, []);

  const retry = useCallback(() => {
    hasLoadedMainDocument.current = false;
    setShowNativeError(false);
    setReloadEpoch((value) => value + 1);
  }, []);

  if (showNativeError) {
    return (
      <WebErrorView
        onRetry={retry}
        onOpenWeb={() => {
          void openExternalUrl(ASK_BETTER_WEB_URL);
        }}
      />
    );
  }

  return (
    <View style={styles.root}>
      <WebView
        key={reloadEpoch}
        source={{ uri: ASK_BETTER_WEB_URL }}
        originWhitelist={["https://*", "http://*"]}
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        setSupportMultipleWindows={false}
        startInLoadingState
        renderLoading={() => <LoadingView />}
        onShouldStartLoadWithRequest={(request) => {
          const decision = classifyNavigation(request.url);

          if (decision.kind === "internal") {
            return true;
          }

          if (decision.kind === "external") {
            void openExternalUrl(decision.url);
          }

          return false;
        }}
        onOpenWindow={(event) => {
          const targetUrl = event.nativeEvent.targetUrl;
          const decision = classifyNavigation(targetUrl);

          if (decision.kind === "external") {
            void openExternalUrl(decision.url);
          }
        }}
        onLoad={(event) => {
          if (classifyNavigation(event.nativeEvent.url).kind === "internal") {
            hasLoadedMainDocument.current = true;
          }
        }}
        onError={(event) => {
          if (
            shouldShowNativeLoadError({
              hasLoadedMainDocument: hasLoadedMainDocument.current,
              failedUrl: event.nativeEvent.url,
              mainDocumentUrl: ASK_BETTER_WEB_URL
            })
          ) {
            setShowNativeError(true);
          }
        }}
        onHttpError={(event) => {
          if (
            shouldShowNativeLoadError({
              hasLoadedMainDocument: hasLoadedMainDocument.current,
              failedUrl: event.nativeEvent.url,
              mainDocumentUrl: ASK_BETTER_WEB_URL
            })
          ) {
            setShowNativeError(true);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F6F3EA"
  }
});
