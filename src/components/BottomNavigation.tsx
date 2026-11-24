import { Pressable, StyleSheet, View } from "react-native";
import type { ReactElement } from "react";
import { Icon, Text } from "react-native-paper";
import type { NavigationProp } from "@react-navigation/native";
import type { StudentStackParamList } from "../types/navigation";

type StudentTabRoute = "Dashboard" | "Booking" | "WeeklyMenu" | "History" | "Profile";

type Props = {
  navigation: NavigationProp<StudentStackParamList>;
  active: StudentTabRoute;
};

const tabs: Array<{
  label: string;
  route: StudentTabRoute;
  icon: string;
  activeIcon: string;
}> = [
  { label: "Dashboard", route: "Dashboard", icon: "home-outline", activeIcon: "home" },
  { label: "Meals", route: "Booking", icon: "silverware-fork-knife", activeIcon: "silverware-fork-knife" },
  { label: "Week", route: "WeeklyMenu", icon: "calendar-week", activeIcon: "calendar-week" },
  { label: "History", route: "History", icon: "history", activeIcon: "history" },
  { label: "Profile", route: "Profile", icon: "account-outline", activeIcon: "account" },
];

export default function BottomNavigation({ navigation, active }: Props): ReactElement {
  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        {tabs.map((tab) => {
          const selected = tab.route === active;
          return (
            <Pressable
              key={tab.route}
              accessibilityRole="button"
              onPress={() => {
                if (!selected) navigation.navigate(tab.route);
              }}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            >
              {selected && <View style={styles.activeDot} />}
              <Icon source={selected ? tab.activeIcon : tab.icon} size={21} color={selected ? "#D62828" : "#777777"} />
              <Text style={[styles.label, selected && styles.activeLabel]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  activeDot: { backgroundColor: "#F77F00", borderRadius: 3, height: 3, position: "absolute", top: 4, width: 22 },
  activeLabel: { color: "#D62828", fontWeight: "800" },
  bar: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "rgba(214,40,40,0.08)",
    borderRadius: 24,
    borderWidth: 1,
    elevation: 12,
    flexDirection: "row",
    height: 68,
    justifyContent: "space-around",
    shadowColor: "#9D0208",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  label: { color: "#777777", fontSize: 10, marginTop: 2 },
  pressed: { opacity: 0.6, transform: [{ scale: 0.96 }] },
  tab: { alignItems: "center", flex: 1, height: 62, justifyContent: "center" },
  wrap: { backgroundColor: "#FFF8F3", paddingBottom: 8, paddingHorizontal: 12, paddingTop: 4 },
});
