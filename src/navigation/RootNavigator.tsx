import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "../screens/HomeScreen";
import EventPreviewScreen from "../screens/EventPreviewScreen";
import { EventItem } from "../interfaces/events";

export type RootStackParamList = {
  Home: { audience: "student" | "faculty" };
  EventPreview: { event: EventItem };
  Details: { event: EventItem };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="EventPreview" component={EventPreviewScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
