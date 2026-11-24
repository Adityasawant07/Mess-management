import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { Card, Icon, IconButton, Text } from "react-native-paper";
import { auth, db } from "../firebaseConfig";
import BottomNavigation from "../components/BottomNavigation";
import type { DailyMenu, MealBooking, UserProfile } from "../types/models";
import type { StudentStackParamList } from "../types/navigation";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

type Props = NativeStackScreenProps<StudentStackParamList, "Dashboard">;

export default function StudentDashboard({ navigation }: Props): ReactElement {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [menu, setMenu] = useState<DailyMenu | null>(null);
  const [logs, setLogs] = useState<MealBooking[]>([]);
  const [loadingMeal, setLoadingMeal] = useState(true);
  const [mealName, setMealName] = useState("");

  useEffect(() => {
    let profileUnsubscribe: (() => void) | undefined;
    let logsUnsubscribe: (() => void) | undefined;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      profileUnsubscribe?.();
      logsUnsubscribe?.();
      if (user) {
        profileUnsubscribe = onSnapshot(doc(db, "users", user.uid), (snapshot) => setProfile(snapshot.data() as UserProfile));
        const bookingsQuery = query(collection(db, "meal_bookings"), where("uid", "==", user.uid));
        logsUnsubscribe = onSnapshot(bookingsQuery, (snapshot) => {
          const nextLogs = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as MealBooking);
          nextLogs.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
          setLogs(nextLogs);
        });
      }

      const styles = StyleSheet.create({
        actionCard: { borderRadius: 18, flex: 1, marginHorizontal: 4 },
        actionContent: { alignItems: "center", flexDirection: "row", gap: 10, paddingVertical: 10 },
        actionIcon: { alignItems: "center", backgroundColor: "#D62828", borderRadius: 14, height: 42, justifyContent: "center", width: 42 },
        actionRow: { flexDirection: "row", marginBottom: 22, marginHorizontal: -4 },
        actionText: { color: "#252525", fontSize: 13, fontWeight: "800" },
        balanceAmount: { color: "#FFFFFF", fontSize: 34, fontWeight: "900", marginTop: 2 },
        balanceCard: { borderRadius: 24, height: 190, marginBottom: 24, overflow: "hidden" },
        balanceContent: { position: "relative", zIndex: 2 },
        balanceLabel: { color: "#FFFFFF", fontSize: 14, opacity: 0.9 },
        balanceTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
        bell: { backgroundColor: "#FFFFFF", elevation: 3 },
        container: { paddingBottom: 12, paddingHorizontal: 18, paddingTop: 18 },
        greeting: { color: "#777777", fontSize: 14 },
        header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
        inspirationCard: { borderRadius: 18, marginBottom: 8 },
        inspirationContent: { alignItems: "center", flexDirection: "row", gap: 12, minHeight: 58 },
        inspirationIcon: { alignItems: "center", backgroundColor: "#FFF1E6", borderRadius: 14, height: 44, justifyContent: "center", width: 44 },
        inspirationText: { color: "#252525", flex: 1, fontWeight: "700" },
        lowBalanceCard: { backgroundColor: "#FFF1E6", borderColor: "#D62828", borderRadius: 14, borderWidth: 1, marginBottom: 18 },
        lowBalanceText: { color: "#D62828", fontWeight: "800" },
        menuCard: { borderRadius: 16, marginBottom: 9 },
        menuIcon: { alignItems: "center", backgroundColor: "#FFF1E6", borderRadius: 12, height: 42, justifyContent: "center", width: 42 },
        menuLabel: { color: "#252525", fontSize: 13, fontWeight: "800" },
        menuRow: { alignItems: "center", flexDirection: "row" },
        menuText: { flex: 1, marginHorizontal: 12 },
        menuValue: { color: "#777777", fontSize: 12, marginTop: 2 },
        name: { color: "#252525", fontWeight: "900" },
        orangeAction: { backgroundColor: "#F77F00" },
        orangeLayer: { backgroundColor: "#F77F00", borderRadius: 90, height: 180, opacity: 0.35, position: "absolute", right: -72, top: -70, width: 180 },
        page: { backgroundColor: "#FFF8F3", flex: 1 },
        progress: { backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 6, height: 5, marginTop: 10, overflow: "hidden" },
        progressFill: { backgroundColor: "#FCBF49", borderRadius: 6, height: 5 },
        redLayer: { backgroundColor: "#D62828", borderRadius: 24, bottom: 0, left: 0, position: "absolute", right: 0, top: 0 },
        sectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
        sectionTitle: { color: "#252525", fontWeight: "900", marginBottom: 10 },
        semesterRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 24 },
        semesterText: { color: "#FFFFFF", opacity: 0.85 },
        semesterValue: { backgroundColor: "#FCBF49", borderRadius: 12, color: "#252525", fontSize: 11, fontWeight: "900", overflow: "hidden", paddingHorizontal: 10, paddingVertical: 4 },
        statCard: { borderRadius: 18, flex: 1, marginHorizontal: 4 },
        statCount: { color: "#252525", fontSize: 22, fontWeight: "900", marginTop: 5 },
        statContent: { alignItems: "center", paddingHorizontal: 4, paddingVertical: 10 },
        statIcon: { alignItems: "center", backgroundColor: "#FFF1E6", borderRadius: 12, height: 38, justifyContent: "center", width: 38 },
        statLabel: { color: "#777777", fontSize: 11, marginTop: 1 },
        statsRow: { flexDirection: "row", marginBottom: 22, marginHorizontal: -4 },
        totalMeals: { color: "#D62828", fontSize: 12, fontWeight: "800", marginBottom: 10 },
        walletIcon: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 20, height: 52, justifyContent: "center", width: 52 },
      });
    });
    return () => { unsubscribe(); profileUnsubscribe?.(); logsUnsubscribe?.(); };
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "daily_menu", "today"), (snapshot) => setMenu(snapshot.data() as DailyMenu | null));
    return unsubscribe;
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("https://www.themealdb.com/api/json/v1/1/random.php");
        const result = await response.json();
        setMealName(result.meals?.[0]?.strMeal ?? "");
      } catch (error) {
        console.error("Unable to load meal inspiration.", error);
      } finally {
        setLoadingMeal(false);
      }
    };
    void load();
  }, []);

  const count = (type: "breakfast" | "lunch" | "dinner") => logs.filter((item) => item.mealType === type).length;
  const totalMeals = logs.length;
  const balanceProgress = Math.min((profile?.balance ?? 0) / 3000, 1);
  const mealMeta = [
    { type: "breakfast", label: "Breakfast", icon: "weather-sunset-up", count: count("breakfast") },
    { type: "lunch", label: "Lunch", icon: "white-balance-sunny", count: count("lunch") },
    { type: "dinner", label: "Dinner", icon: "weather-night", count: count("dinner") },
  ] as const;

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good day,</Text>
            <Text variant="headlineMedium" style={styles.name}>{profile?.name ?? "Student"}</Text>
          </View>
          <IconButton icon="bell-outline" iconColor="#D62828" style={styles.bell} size={22} onPress={() => navigation.navigate("Profile")} />
        </View>

        <Card style={styles.balanceCard}>
          <View style={styles.redLayer} />
          <View style={styles.orangeLayer} />
          <Card.Content style={styles.balanceContent}>
            <View style={styles.balanceTop}>
              <View>
                <Text style={styles.balanceLabel}>Mess wallet</Text>
                <Text style={styles.balanceAmount}>₹{profile?.balance?.toLocaleString("en-IN") ?? "0"}</Text>
              </View>
              <View style={styles.walletIcon}><Icon source="wallet-outline" size={28} color="#FFFFFF" /></View>
            </View>
            <View style={styles.semesterRow}>
              <Text style={styles.semesterText}>Current semester</Text>
              <Text style={styles.semesterValue}>Active</Text>
            </View>
            <View style={styles.progress}>
              <View style={[styles.progressFill, { width: `${balanceProgress * 100}%` }]} />
            </View>
          </Card.Content>
        </Card>
        {(profile?.balance ?? 0) <= 500 && (
          <Card style={styles.lowBalanceCard}>
            <Card.Content><Text style={styles.lowBalanceText}>Low balance: ₹{profile?.balance ?? 0}. Ask your mess vendor to add funds.</Text></Card.Content>
          </Card>
        )}

        <View style={styles.sectionHeader}>
          <Text variant="titleLarge" style={styles.sectionTitle}>Today&apos;s overview</Text>
          <Text style={styles.totalMeals}>{totalMeals} meals</Text>
        </View>
        <View style={styles.statsRow}>
          {mealMeta.map((item) => (
            <Card key={item.type} style={styles.statCard} mode="elevated" onPress={() => navigation.navigate("WeeklyMenu")}>
              <Card.Content style={styles.statContent}>
                <View style={styles.statIcon}><Icon source={item.icon} size={20} color="#F77F00" /></View>
                <Text style={styles.statCount}>{item.count}</Text>
                <Text style={styles.statLabel}>{item.label}</Text>
              </Card.Content>
            </Card>
          ))}
        </View>

        <Text variant="titleLarge" style={styles.sectionTitle}>Today&apos;s menu</Text>
        {(["breakfast", "lunch", "dinner"] as const).map((mealType) => (
          <Card key={mealType} style={styles.menuCard} mode="elevated">
            <Card.Content style={styles.menuRow}>
              <View style={styles.menuIcon}><Icon source={mealType === "breakfast" ? "coffee" : mealType === "lunch" ? "food" : "silverware-fork-knife"} size={22} color="#D62828" /></View>
              <View style={styles.menuText}>
                <Text style={styles.menuLabel}>{mealType[0].toUpperCase() + mealType.slice(1)}</Text>
                <Text numberOfLines={1} style={styles.menuValue}>{menu?.[mealType] ?? "Menu not published yet"}</Text>
              </View>
              <Icon source="chevron-right" size={20} color="#777777" />
            </Card.Content>
          </Card>
        ))}

        <View style={styles.sectionHeader}>
          <Text variant="titleLarge" style={styles.sectionTitle}>Quick actions</Text>
        </View>
        <View style={styles.actionRow}>
          <Card style={styles.actionCard} onPress={() => navigation.navigate("Booking")}>
            <Card.Content style={styles.actionContent}>
              <View style={styles.actionIcon}><Icon source="plus" size={24} color="#FFFFFF" /></View>
              <Text style={styles.actionText}>Book meal</Text>
            </Card.Content>
          </Card>
          <Card style={styles.actionCard} onPress={() => navigation.navigate("History")}>
            <Card.Content style={styles.actionContent}>
              <View style={[styles.actionIcon, styles.orangeAction]}><Icon source="receipt-text-outline" size={23} color="#FFFFFF" /></View>
              <Text style={styles.actionText}>View history</Text>
            </Card.Content>
          </Card>
        </View>

        <Text variant="titleLarge" style={styles.sectionTitle}>Daily inspiration</Text>
        <Card style={styles.inspirationCard}>
          <Card.Content style={styles.inspirationContent}>
            {loadingMeal ? <ActivityIndicator color="#D62828" /> : (
              <><View style={styles.inspirationIcon}><Icon source="silverware" size={24} color="#D62828" /></View><Text style={styles.inspirationText}>{mealName || "Discover something delicious today"}</Text></>
            )}
          </Card.Content>
        </Card>
      </ScrollView>
      <BottomNavigation navigation={navigation} active="Dashboard" />
    </View>
  );
}

const styles = StyleSheet.create({
  actionCard: { borderRadius: 18, flex: 1, marginHorizontal: 4 },
  actionContent: { alignItems: "center", flexDirection: "row", gap: 10, paddingVertical: 10 },
  actionIcon: { alignItems: "center", backgroundColor: "#D62828", borderRadius: 14, height: 42, justifyContent: "center", width: 42 },
  actionRow: { flexDirection: "row", marginBottom: 22, marginHorizontal: -4 },
  actionText: { color: "#252525", fontSize: 13, fontWeight: "800" },
  balanceAmount: { color: "#FFFFFF", fontSize: 34, fontWeight: "900", marginTop: 2 },
  balanceCard: { borderRadius: 24, height: 190, marginBottom: 24, overflow: "hidden" },
  balanceContent: { position: "relative", zIndex: 2 },
  balanceLabel: { color: "#FFFFFF", fontSize: 14, opacity: 0.9 },
  balanceTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  bell: { backgroundColor: "#FFFFFF", elevation: 3 },
  container: { paddingBottom: 12, paddingHorizontal: 18, paddingTop: 18 },
  greeting: { color: "#777777", fontSize: 14 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  inspirationCard: { borderRadius: 18, marginBottom: 8 },
  inspirationContent: { alignItems: "center", flexDirection: "row", gap: 12, minHeight: 58 },
  inspirationIcon: { alignItems: "center", backgroundColor: "#FFF1E6", borderRadius: 14, height: 44, justifyContent: "center", width: 44 },
  inspirationText: { color: "#252525", flex: 1, fontWeight: "700" },
  lowBalanceCard: { backgroundColor: "#FFF1E6", borderColor: "#D62828", borderRadius: 14, borderWidth: 1, marginBottom: 18 },
  lowBalanceText: { color: "#D62828", fontWeight: "800" },
  menuCard: { borderRadius: 16, marginBottom: 9 },
  menuIcon: { alignItems: "center", backgroundColor: "#FFF1E6", borderRadius: 12, height: 42, justifyContent: "center", width: 42 },
  menuLabel: { color: "#252525", fontSize: 13, fontWeight: "800" },
  menuRow: { alignItems: "center", flexDirection: "row" },
  menuText: { flex: 1, marginHorizontal: 12 },
  menuValue: { color: "#777777", fontSize: 12, marginTop: 2 },
  name: { color: "#252525", fontWeight: "900" },
  orangeAction: { backgroundColor: "#F77F00" },
  orangeLayer: { backgroundColor: "#F77F00", borderRadius: 90, height: 180, opacity: 0.35, position: "absolute", right: -72, top: -70, width: 180 },
  page: { backgroundColor: "#FFF8F3", flex: 1 },
  progress: { backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 6, height: 5, marginTop: 10, overflow: "hidden" },
  progressFill: { backgroundColor: "#FCBF49", borderRadius: 6, height: 5 },
  redLayer: { backgroundColor: "#D62828", borderRadius: 24, bottom: 0, left: 0, position: "absolute", right: 0, top: 0 },
  sectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { color: "#252525", fontWeight: "900", marginBottom: 10 },
  semesterRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 24 },
  semesterText: { color: "#FFFFFF", opacity: 0.85 },
  semesterValue: { backgroundColor: "#FCBF49", borderRadius: 12, color: "#252525", fontSize: 11, fontWeight: "900", overflow: "hidden", paddingHorizontal: 10, paddingVertical: 4 },
  statCard: { borderRadius: 18, flex: 1, marginHorizontal: 4 },
  statCount: { color: "#252525", fontSize: 22, fontWeight: "900", marginTop: 5 },
  statContent: { alignItems: "center", paddingHorizontal: 4, paddingVertical: 10 },
  statIcon: { alignItems: "center", backgroundColor: "#FFF1E6", borderRadius: 12, height: 38, justifyContent: "center", width: 38 },
  statLabel: { color: "#777777", fontSize: 11, marginTop: 1 },
  statsRow: { flexDirection: "row", marginBottom: 22, marginHorizontal: -4 },
  totalMeals: { color: "#D62828", fontSize: 12, fontWeight: "800", marginBottom: 10 },
  walletIcon: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 20, height: 52, justifyContent: "center", width: 52 },
});
