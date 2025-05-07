import { StyleSheet, Text, View, Pressable, Image } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { RootStackParamList } from "../navigation/RootNavigator";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { EventItem } from "../interfaces/events";

type Props = {
  event: EventItem;
  audience: "student" | "faculty";
};

const iconMap: Record<string, any> = {
  course: require("../../assets/images/categories/course.png"),
  campus: require("../../assets/images/categories/campus.png"),
  career: require("../../assets/images/categories/career.png"),
  social: require("../../assets/images/categories/social.png"),
  other: require("../../assets/images/categories/bell.png"),
  user: require("../../assets/images/student-avatar.png"), // fallback
};

export default function TaskCard({ event, audience }: Props) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Add this debugging
  console.log(`TaskCard for ${event.title}:`, {
    parsed_date: event.parsed_date,
    additional_days: event.additional_days,
    time: event.time
  });

  return (
    <Pressable
      onPress={() => navigation.navigate("EventPreview", { event })}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.row}>
        <View style={styles.iconCircle}>
          {/* <Image
            source={iconMap[event.icon] || iconMap.user}
            style={styles.iconImage}
          /> */}
          <Image
            source={
              iconMap[
                event.category ? event.category.toLowerCase() : "calendar"
              ]
            } // or your default icon
            style={styles.iconImage}
          />
        </View>
        <View style={styles.texts}>
          <Text style={styles.title}>{event.title}</Text>
          <Text style={styles.date}>
            {event.parsed_date || event.date}
            {(event.additional_days ?? 0) > 0 && ` +${event.additional_days ?? 0} days`}
            {event.time && ` • ${event.time}`}
          </Text>
        </View>
        <Feather name="chevron-right" size={20} color="#aaa" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 20, // ⬆ a touch more breathing room
    paddingHorizontal: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#222",
  },
  iconImage: {
    width: "70%", // <- key: percentage, not px
    height: "70%",
    resizeMode: "contain",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },

  iconCircle: {
    width: 52, // big pill
    height: 52,
    borderRadius: 26,
    backgroundColor: "#1b1b1b",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 18,
  },

  texts: { flex: 1 },

  title: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
    marginBottom: 2,
  },
  date: { color: "#aaa", fontSize: 12 },
});
