import { View, StyleSheet, Pressable, Image } from "react-native";
import {
  useNavigation,
  useRoute,
  NavigationProp,
} from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { RootStackParamList } from "../navigation/RootNavigator";

export default function CenteredLogoHeader({
  onReload,
}: {
  onReload?: () => void;
}) {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute();
  const rotation = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const handlePress = () => {
    rotation.value = withTiming(rotation.value + 360, {
      duration: 800,
      easing: Easing.linear,
    });

    if (route.name === "Home") {
      onReload?.(); // ← no setTimeout here
    } else {
      setTimeout(() => {
        navigation.navigate("Home");
      }, 800); // ← setTimeout here
    }
  };

  return (
    <View style={styles.wrapper}>
      {route.name !== "Home" && (
        <Pressable style={styles.back} onPress={() => navigation.goBack()}>
          <Feather name="chevron-left" size={24} color="#fff" />
        </Pressable>
      )}

      <Animated.View style={animatedStyle}>
        <Pressable onPress={handlePress}>
          <Image
            source={require("../../assets/images/Logo.png")}
            style={styles.logo}
          />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 30,
    position: "relative",
  },
  back: {
    position: "absolute",
    left: 24,
    top: 60,
  },
  logo: {
    width: 40,
    height: 40,
    resizeMode: "contain",
  },
});
