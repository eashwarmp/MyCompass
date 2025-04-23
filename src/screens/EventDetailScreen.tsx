import {
  View,
  StyleSheet,
  Image,
  SafeAreaView,
  Text,
  Pressable,
  ScrollView,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { RootStackParamList } from "../navigation/RootNavigator";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useEvents } from "../hooks/useEvents";
import { LinearGradient } from "expo-linear-gradient";

export default function EventDetailScreen() {
  const { params } = useRoute<any>();
  const { events } = useEvents();
  const event = events.find((e) => e.id === params.id)!;
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <SafeAreaView style={styles.container}>
      <Pressable style={styles.back} onPress={navigation.goBack}>
        <Feather name="chevron-left" size={24} color="#fff" />
      </Pressable>

      <ScrollView contentContainerStyle={styles.content}>
        <Image source={{ uri: event.cover }} style={styles.cover} />
        <Text style={styles.h1}>{event.title}</Text>
        <Text style={styles.subtitle}>{event.subtitle}</Text>
        <Text style={styles.subtitle}>{event.location}</Text>

        {/* CTA buttons */}
        {["Add To Calendar", "Get Directions", "More Details"].map((txt) => (
          <Pressable
            key={txt}
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.7 }]}
          >
            <Feather
              name="corner-up-right"
              size={14}
              color="#fff"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.btnTxt}>{txt}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Chat bar gradient */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.8)"]}
        style={styles.chatBoxHolder}
      >
        <View style={styles.chatBox} />
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  back: {
    position: "absolute",
    zIndex: 10,
    top: 50,
    left: 24,
  },
  content: { paddingTop: 80, paddingHorizontal: 24, paddingBottom: 200 },
  cover: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    marginBottom: 20,
  },
  h1: { color: "#fff", fontSize: 20, fontWeight: "700", marginBottom: 4 },
  subtitle: { color: "#aaa", marginBottom: 6 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#555",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginTop: 14,
    alignSelf: "flex-start",
  },
  btnTxt: { color: "#fff", fontSize: 14 },
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
  },
});
