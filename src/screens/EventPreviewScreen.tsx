import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  SafeAreaView,
  ScrollView,
  Platform,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { RootStackParamList } from "../navigation/RootNavigator";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import CenteredLogoHeader from "../components/CenteredLogoHeader";

import { Linking } from "react-native";

export default function EventPreviewScreen() {
  const { params } = useRoute<any>();
  const event = params.event;

  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <SafeAreaView style={styles.container}>
      <CenteredLogoHeader />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Feather
            name="chevron-left"
            size={24}
            color="#fff"
            onPress={() => navigation.goBack()}
          />
          <Text style={styles.headerTitle}>{event.title}</Text>
        </View>

        {/* Event Card */}
        <View style={styles.card}>
          <Image source={{ uri: event.image }} style={styles.image} />
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>{event.title}</Text>
            <Text style={styles.cardSubtitle}>{event.title}</Text>
            <Text style={styles.cardLocation}>{event.location}</Text>

            <Pressable
              onPress={() => {
                if (event.link) {
                  if (Platform.OS === "web") {
                    window.open(event.link, "_blank");
                  } else {
                    Linking.openURL(event.link);
                  }
                } else {
                  navigation.navigate("Details", { event });
                }
              }}
              style={styles.viewMoreBtn}
            >
              <Text style={styles.viewMoreText}>View more</Text>
            </Pressable>
          </View>
        </View>

        {/* CTA Buttons */}
        <View style={styles.ctaGroup}>
          {["Add To Calendar", "Get Directions", "More Details"].map(
            (label) => (
              <Pressable key={label} style={styles.ctaBtn}>
                <Feather
                  name="corner-up-right"
                  size={14}
                  color="#fff"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.ctaText}>{label}</Text>
              </Pressable>
            )
          )}
        </View>

        {/* Chat gradient */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.8)"]}
          style={styles.chatBoxHolder}
        >
          <View style={styles.chatBox}>
            <Text style={styles.chatPlaceholder}>How can I help you?</Text>
          </View>
        </LinearGradient>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", padding: 20 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  content: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 120, // for scroll space above chat
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginLeft: 10,
    flexShrink: 1,
  },

  card: {
    backgroundColor: "#111",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#222",
    marginBottom: 30,
  },
  image: {
    width: "100%",
    height: 180,
  },
  cardContent: {
    padding: 16,
  },
  cardTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  cardSubtitle: {
    color: "#ccc",
    fontSize: 13,
    marginBottom: 2,
  },
  cardLocation: {
    color: "#888",
    fontSize: 12,
    marginBottom: 12,
  },
  viewMoreBtn: {
    borderColor: "#888",
    borderWidth: 1,
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: "flex-start",
    marginTop: 8,
  },
  viewMoreText: {
    color: "#fff",
    fontSize: 13,
  },

  ctaGroup: {
    gap: 10,
    marginBottom: 60,
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderColor: "#444",
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  ctaText: { color: "#fff", fontSize: 14 },

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
  logoContainer: {
    paddingTop: 40,
    alignItems: "center",
    marginBottom: 20,
  },
});
