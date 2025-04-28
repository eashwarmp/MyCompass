import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "../screens/HomeScreen";
import EventDetailScreen from "../screens/EventDetailScreen";
import EventPreviewScreen from "../screens/EventPreviewScreen";
import { EventItem } from "../interfaces/events";

export type RootStackParamList = {
  Home: undefined;
  EventPreview: { event: EventItem }; // Add this line
  Details: { event: EventItem };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="EventPreview" component={EventPreviewScreen} />
        <Stack.Screen name="Details" component={EventDetailScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
