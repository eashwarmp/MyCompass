// components/LogoButton.tsx
import { Pressable, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";

export default function LogoButton({ onReload }: { onReload?: () => void }) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const rotation = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  const handlePress = () => {
    rotation.value = withTiming(rotation.value + 360, { duration: 600 });

    if (route.name === "Home") {
      onReload?.();
    } else {
      navigation.navigate("Home");
    }
  };

  return (
    <Pressable onPress={handlePress} style={styles.logoWrapper}>
      <Animated.Image
        source={require("../../assets/images/Logo.png")}
        style={[styles.logo, animatedStyle]}
        resizeMode="contain"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  logoWrapper: {
    position: "absolute",
    top: 40,
    right: 20,
    zIndex: 20,
  },
  logo: {
    width: 36,
    height: 36,
  },
});
