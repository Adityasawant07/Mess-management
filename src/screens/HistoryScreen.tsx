import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Card, Icon, Text } from "react-native-paper";
import { auth, db } from "../firebaseConfig";
import BottomNavigation from "../components/BottomNavigation";
import type { BalanceTransaction, MealBooking } from "../types/models";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<StudentStackParamList, "History">;

export default function HistoryScreen({ navigation }: Props): ReactElement {
  const [logs, setLogs] = useState<MealBooking[]>([]);
  const [transactions, setTransactions] = useState<BalanceTransaction[]>([]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) { setLogs([]); return undefined; }
    const bookingsQuery = query(collection(db, "meal_bookings"), where("uid", "==", user.uid));
    const transactionQuery = query(collection(db, "balance_transactions"), where("uid", "==", user.uid));
    const transactionUnsubscribe = onSnapshot(transactionQuery, (snapshot) =>
      setTransactions(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as BalanceTransaction)),
    );
    const bookingsUnsubscribe = onSnapshot(bookingsQuery, (snapshot) => {
      const nextLogs = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as MealBooking);
      nextLogs.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      setLogs(nextLogs);
    });
    return () => { bookingsUnsubscribe(); transactionUnsubscribe(); };
  }, []);

  const deductions = transactions.filter((item) => item.type === "deduction");
  const total = deductions.reduce((sum, item) => sum + item.amount, 0);
  const month = new Date().getMonth();
  const monthly = deductions
    .filter((item) => item.createdAt?.toDate().getMonth() === month)
    .reduce((sum, item) => sum + item.amount, 0);

  return (
    <View style={styles.page}>
      <FlatList
        contentContainerStyle={styles.container}
        data={logs}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <Text style={styles.eyebrow}>MEAL ACTIVITY</Text>
            <Text variant="headlineMedium" style={styles.title}>History</Text>
            <Card style={styles.summaryCard}>
              <Card.Content style={styles.summaryContent}>
                <View>
                  <Text style={styles.summaryLabel}>Total deductions</Text><Text style={styles.summaryAmount}>₹{total}</Text>
                  <Text style={styles.summaryLabel}>This month: ₹{monthly}</Text>
                </View>
                <View style={styles.summaryIcon}><Icon source="chart-donut" size={26} color="#FFFFFF" /></View>
              </Card.Content>
            </Card>
            <Text variant="titleMedium" style={styles.sectionTitle}>Recent transactions</Text>
          </View>
        }
        ListEmptyComponent={<View style={styles.empty}><Icon source="receipt-text-outline" size={44} color="#777777" /><Text style={styles.emptyText}>No meal bookings yet.</Text></View>}
        renderItem={({ item }) => {
          const label = item.mealType[0].toUpperCase() + item.mealType.slice(1);
          return (
            <Card style={styles.card} mode="elevated">
              <Card.Content style={styles.item}>
                <View style={styles.mealIcon}><Icon source={item.mealType === "breakfast" ? "coffee" : item.mealType === "lunch" ? "food" : "silverware-fork-knife"} size={22} color="#D62828" /></View>
                <View style={styles.itemText}>
                  <Text style={styles.mealName}>{label}</Text>
                  <Text style={styles.timestamp}>{item.createdAt ? item.createdAt.toDate().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : item.date}</Text>
                </View>
                <View style={styles.amountWrap}><Text style={styles.amount}>− ₹{item.amount}</Text><Text style={styles.status}>{item.status === "consumed" ? "Deducted" : item.status === "booked" ? "Booked" : "Cancelled"}</Text></View>
              </Card.Content>
            </Card>
          );
        }}
      />
      <BottomNavigation navigation={navigation} active="History" />
    </View>
  );
}

const styles = StyleSheet.create({
  amount: { color: "#D62828", fontSize: 14, fontWeight: "900" },
  amountWrap: { alignItems: "flex-end" },
  card: { borderRadius: 16, marginBottom: 10 },
  container: { paddingBottom: 12, paddingHorizontal: 18, paddingTop: 20 },
  empty: { alignItems: "center", paddingVertical: 50 },
  emptyText: { color: "#777777", marginTop: 8 },
  eyebrow: { color: "#D62828", fontSize: 12, fontWeight: "900", letterSpacing: 1.2 },
  item: { alignItems: "center", flexDirection: "row" },
  itemText: { flex: 1, marginHorizontal: 12 },
  mealIcon: { alignItems: "center", backgroundColor: "#FFF1E6", borderRadius: 13, height: 46, justifyContent: "center", width: 46 },
  mealName: { color: "#252525", fontSize: 15, fontWeight: "900" },
  page: { backgroundColor: "#FFF8F3", flex: 1 },
  sectionTitle: { color: "#252525", fontWeight: "900", marginBottom: 12 },
  status: { color: "#777777", fontSize: 10, marginTop: 3 },
  summaryAmount: { color: "#FFFFFF", fontSize: 29, fontWeight: "900", marginTop: 3 },
  summaryCard: { backgroundColor: "#D62828", borderRadius: 20, marginBottom: 22, marginTop: 14, overflow: "hidden" },
  summaryContent: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 96 },
  summaryIcon: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.16)", borderRadius: 20, height: 54, justifyContent: "center", width: 54 },
  summaryLabel: { color: "#FFFFFF", opacity: 0.85 },
  timestamp: { color: "#777777", fontSize: 11, marginTop: 4 },
  title: { color: "#252525", fontWeight: "900", marginTop: 3 },
});
