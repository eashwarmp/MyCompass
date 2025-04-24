import { StyleSheet, Text, View, Pressable, Image } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { RootStackParamList } from "../navigation/RootNavigator";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

type Props = {
  event: {
    id: string;
    title: string;
    subtitle: string;
    icon: string;
    cover: string;
    location: string;
    description?: string;
  };
};

const iconMap: Record<string, any> = {
  book: require("../../assets/images/categories/course.png"),
  campus: require("../../assets/images/categories/campus.png"),
  briefcase: require("../../assets/images/categories/career.png"),
  graduation: require("../../assets/images/categories/social.png"),
  calendar: require("../../assets/images/categories/bell.png"),
  user: require("../../assets/images/avatar.png"), // fallback
};

export default function TaskCard({ event }: Props) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <Pressable
      onPress={() => navigation.navigate("Details", { event })}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.row}>
        <View style={styles.iconCircle}>
          <Image
            source={iconMap[event.icon] || iconMap.user}
            style={styles.iconImage}
          />
        </View>
        <View style={styles.texts}>
          <Text style={styles.title}>{event.title}</Text>
          <Text style={styles.subtitle}>{event.subtitle}</Text>
        </View>
        <Feather name="chevron-right" size={18} color="#aaa" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#222",
  },
  iconImage: {
    width: 20,
    height: 20,
    resizeMode: "contain",
  },
  row: { flexDirection: "row", alignItems: "center" },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#222",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  texts: { flex: 1 },
  title: { color: "#fff", fontWeight: "600", marginBottom: 2 },
  subtitle: { color: "#aaa", fontSize: 12 },
});
