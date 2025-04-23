import { View, StyleSheet, Image, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";

export default function HeaderBar() {
  return (
    <View style={styles.container}>
      <Pressable>
        <Feather name="menu" size={24} color="#fff" />
      </Pressable>

      <Image
        source={require("../../assets/images/Logo.png")}
        style={styles.logo}
      />

      <Image
        source={require("../../assets/images/avatar.png")}
        style={styles.avatar}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: {
    width: 36,
    height: 36,
    resizeMode: "contain",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
});
