import { useCallback, useEffect, useState } from "react";
import type { ComponentProps } from "react";
import type { ReactElement } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { Animated, LogBox, Platform } from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  createNativeStackNavigator,
} from "@react-navigation/native-stack";
import { MD3LightTheme, PaperProvider } from "react-native-paper";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import BookMealScreen from "./src/screens/BookMealScreen";
import HistoryScreen from "./src/screens/HistoryScreen";
import LoginScreen from "./src/screens/LoginScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import SplashScreen from "./src/screens/SplashScreen";
import StudentDashboard from "./src/screens/StudentDashboard";
import VendorScreen from "./src/screens/VendorScreen";
import WeeklyMenuStudentScreen from "./src/screens/WeeklyMenuStudentScreen";
import WeeklyMenuVendorScreen from "./src/screens/WeeklyMenuVendorScreen";
import StudentManagementScreen from "./src/screens/StudentManagementScreen";
import { auth, db } from "./src/firebaseConfig";
import type {
  RootStackParamList,
  StudentStackParamList,
  UserRole,
  VendorStackParamList,
} from "./src/types/navigation";

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator();
const StudentStack = createNativeStackNavigator<StudentStackParamList>();
const VendorStack = createNativeStackNavigator<VendorStackParamList>();

if (Platform.OS === "web") {
  const timing = Animated.timing;
  const timingPatch: typeof timing = (value, config) =>
    timing(value, { ...config, useNativeDriver: false });
  Object.defineProperty(Animated, "timing", { value: timingPatch });

  const spring = Animated.spring;
  const springPatch: typeof spring = (value, config) =>
    spring(value, { ...config, useNativeDriver: false });
  Object.defineProperty(Animated, "spring", { value: springPatch });

  LogBox.ignoreLogs([
    "Animated: `useNativeDriver` is not supported",
  ]);
}

const paperTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: "#D62828",
    secondary: "#F77F00",
    tertiary: "#FCBF49",
    background: "#FFF8F3",
    surface: "#FFFFFF",
    onSurface: "#252525",
  },
};

function AuthNavigator(): ReactElement {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false, animation: "fade" }}>
      <AuthStack.Screen name="Login" options={{ title: "Sign in" }}>
        {({ navigation }) => (
          <LoginScreen onRegister={() => navigation.navigate("Register")} />
        )}
      </AuthStack.Screen>
      <AuthStack.Screen name="Register" options={{ title: "Register" }}>
        {({ navigation }) => (
          <RegisterScreen onBack={() => navigation.goBack()} />
        )}
      </AuthStack.Screen>
    </AuthStack.Navigator>
  );
}

function StudentNavigator(): ReactElement {
  return (
    <StudentStack.Navigator screenOptions={{ headerShown: false, animation: "fade_from_bottom" }}>
      <StudentStack.Screen
        component={StudentDashboard}
        name="Dashboard"
        options={{ title: "Student dashboard" }}
      />
      <StudentStack.Screen
        component={BookMealScreen}
        name="Booking"
        options={{ title: "Book a meal" }}
      />
      <StudentStack.Screen
        component={WeeklyMenuStudentScreen}
        name="WeeklyMenu"
        options={{ title: "Weekly menu" }}
      />
      <StudentStack.Screen
        component={HistoryScreen}
        name="History"
        options={{ title: "Booking history" }}
      />
      <StudentStack.Screen
        component={ProfileScreen}
        name="Profile"
        options={{ title: "Profile" }}
      />
    </StudentStack.Navigator>
  );
}

function VendorNavigator(): ReactElement {
  return (
    <VendorStack.Navigator screenOptions={{ headerShown: false, animation: "fade_from_bottom" }}>
      <VendorStack.Screen
        component={VendorScreen}
        name="VendorHome"
        options={{ title: "Vendor dashboard" }}
      />
      <VendorStack.Screen
        component={WeeklyMenuVendorScreen}
        name="WeeklyMenuManagement"
        options={{ title: "Weekly menu management" }}
      />
      <VendorStack.Screen
        component={StudentManagementScreen}
        name="StudentManagement"
        options={{ title: "Student management" }}
      />
    </VendorStack.Navigator>
  );
}

export default function App(): ReactElement {
  const [uid, setUid] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUid(null);
        setRole(null);
        return;
      }

      try {
        const profile = await getDoc(doc(db, "users", user.uid));
        const nextRole = profile.data()?.role;
        if (nextRole === "student" || nextRole === "vendor") {
          setUid(user.uid);
          setRole(nextRole);
        } else {
          setUid(null);
          setRole(null);
        }
      } catch (error) {
        console.error("Unable to load the authenticated user profile.", error);
        setUid(null);
        setRole(null);
      }
    });

    return unsubscribe;
  }, []);

  const handleSplashResolved = useCallback(
    (resolvedUid: string | null, resolvedRole: UserRole | null) => {
      setUid(resolvedUid);
      setRole(resolvedRole);
      setInitializing(false);
    },
    [],
  );

  return (
    <PaperProvider
      theme={paperTheme}
      settings={{
        icon: ({ name, color, size }) => (
          <MaterialCommunityIcons
            name={name as ComponentProps<typeof MaterialCommunityIcons>["name"]}
            size={size}
            color={color}
          />
        ),
      }}
    >
      <NavigationContainer>
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          {initializing ? (
            <RootStack.Screen name="Splash">
              {() => <SplashScreen onResolved={handleSplashResolved} />}
            </RootStack.Screen>
          ) : !uid || !role ? (
            <RootStack.Screen name="Auth" component={AuthNavigator} />
          ) : role === "student" ? (
            <RootStack.Screen name="Student" component={StudentNavigator} />
          ) : (
            <RootStack.Screen name="Vendor" component={VendorNavigator} />
          )}
        </RootStack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}
