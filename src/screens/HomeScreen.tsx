import { FlatList, View, StyleSheet, SafeAreaView, Text } from "react-native";
import { useEvents } from "../hooks/useEvents";
import TaskCard from "../components/TaskCard";
import { LinearGradient } from "expo-linear-gradient";
import HeaderBar from "../components/HeaderBar";
import { RouteProp, useRoute } from "@react-navigation/native";
import { RootStackParamList } from "../navigation/RootNavigator";
import { useEffect, useState } from "react";

type HomeRouteProp = RouteProp<RootStackParamList, "Home">;

function getQueryParamFromURL(key: string): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get(key);
}

export default function HomeScreen() {
  const initialAudience = (() => {
    if (typeof window === "undefined") return "student";
    const param = new URLSearchParams(window.location.search).get("audience");
    return param === "faculty" ? "faculty" : "student";
  })();

  const { events, reload } = useEvents(initialAudience);

  return (
    <SafeAreaView style={styles.container}>
      <HeaderBar onReload={reload} audience={initialAudience} />

      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TaskCard event={item} audience={initialAudience} />
        )}
      />

      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.6)"]}
        style={styles.chatBoxHolder}
      >
        <View style={styles.chatBox}>
          <Text style={styles.chatPlaceholder}>How can I help you?</Text>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  list: { padding: 16 },
  chatBoxHolder: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    justifyContent: "flex-end",
  },
  chatBox: {
    margin: 20,
    height: 44,
    borderWidth: 1,
    borderColor: "#555",
    borderRadius: 22,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  chatPlaceholder: {
    color: "#aaa",
    fontSize: 14,
  },
});
