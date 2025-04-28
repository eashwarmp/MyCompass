import { FlatList, View, StyleSheet, SafeAreaView, Text } from "react-native";
import { useEvents } from "../hooks/useEvents";
import TaskCard from "../components/TaskCard";
import { LinearGradient } from "expo-linear-gradient";
import HeaderBar from "../components/HeaderBar";

export default function HomeScreen() {
  const { events, reload } = useEvents();

  return (
    <SafeAreaView style={styles.container}>
      <HeaderBar onReload={reload} />

      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <TaskCard event={item} />}
      />

      {/* Chat bar */}
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
