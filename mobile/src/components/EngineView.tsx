// Runs the shared SparkForge engine (games and kids' code) in a sandboxed web view.
// Native: react-native-webview with no network and no file access. Web preview: a sandboxed iframe.
import { createElement, useEffect, useRef } from "react";
import { Platform, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

export interface EngineMessage {
  sparkforge: "ready" | "error" | "end";
  message?: string;
  line?: number;
  result?: "won" | "lost";
  score?: number;
}

export function EngineView({ html, onMessage, height = 620 }: { html: string; onMessage?: (m: EngineMessage) => void; height?: number }) {
  const cb = useRef(onMessage);
  cb.current = onMessage;
  const frame = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handler = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || !e.data?.sparkforge) return;
      cb.current?.(e.data as EngineMessage);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  if (Platform.OS === "web") {
    return (
      <View style={{ height, borderRadius: 20, overflow: "hidden", backgroundColor: "#f8f5ff" }}>
        {createElement("iframe", {
          ref: frame,
          srcDoc: html,
          sandbox: "allow-scripts",
          title: "SparkForge engine",
          style: { width: "100%", height: "100%", border: 0 },
        })}
      </View>
    );
  }
  return (
    <View style={{ height, borderRadius: 20, overflow: "hidden", backgroundColor: "#f8f5ff" }}>
      <WebView
        originWhitelist={["about:blank"]}
        source={{ html, baseUrl: "about:blank" }}
        javaScriptEnabled
        domStorageEnabled={false}
        allowFileAccess={false}
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        setSupportMultipleWindows={false}
        incognito
        onShouldStartLoadWithRequest={(r) => r.url === "about:blank" || r.url.startsWith("data:")}
        onMessage={(e: WebViewMessageEvent) => {
          try {
            cb.current?.(JSON.parse(e.nativeEvent.data) as EngineMessage);
          } catch {
            /* ignore */
          }
        }}
        style={{ backgroundColor: "#f8f5ff" }}
        scrollEnabled={false}
        bounces={false}
      />
    </View>
  );
}
