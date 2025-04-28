// src/components/HeaderBar.tsx
import { View, StyleSheet, Pressable, Image } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";

export default function HeaderBar({ onReload }: { onReload?: () => void }) {
  const rotation = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const handlePress = () => {
    rotation.value = withTiming(rotation.value + 360, {
      duration: 800,
      easing: Easing.linear,
    });
    onReload?.(); // reload events on logo click
  };

  return (
    <View style={styles.container}>
      {/* Left: Menu button */}
      <Pressable>
        <Feather name="menu" size={24} color="#fff" />
      </Pressable>

      {/* Middle: Spinning Logo */}
      <Pressable onPress={handlePress} style={styles.logoWrapper}>
        <Animated.Image
          source={require("../../assets/images/Logo.png")}
          style={[styles.logo, animatedStyle]}
        />
      </Pressable>

      {/* Right: Avatar */}
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
  logoWrapper: {
    position: "absolute",
    left: "50%",
    transform: [{ translateX: -18 }], // Half of logo width (36/2 = 18)
    top: 50,
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
