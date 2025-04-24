import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "../screens/HomeScreen";
import EventDetailScreen from "../screens/EventDetailScreen";
import { EventItem } from "../interfaces/events";

export type RootStackParamList = {
  Home: undefined;
  Details: { event: EventItem };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Details" component={EventDetailScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
