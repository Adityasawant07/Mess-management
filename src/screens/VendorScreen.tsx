import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { Button, Card, HelperText, Icon, Snackbar, Text, TextInput } from "react-native-paper";
import { db } from "../firebaseConfig";
import type { DailyMenu, MealBooking, UserProfile } from "../types/models";
import { auth } from "../firebaseConfig";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { VendorStackParamList } from "../types/navigation";
import { consumeMealBooking, getTodayDate } from "../services/messService";

const emptyMenu: DailyMenu = { breakfast: "", lunch: "", dinner: "" };

type Props = NativeStackScreenProps<VendorStackParamList, "VendorHome">;

export default function VendorScreen({ navigation }: Props): ReactElement {
  const [menu, setMenu] = useState<DailyMenu>(emptyMenu);
  const [bookings, setBookings] = useState<MealBooking[]>([]);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [vendor, setVendor] = useState<UserProfile | null>(null);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const menuUnsubscribe = onSnapshot(doc(db, "daily_menu", "today"), (snapshot) => setMenu({ ...emptyMenu, ...snapshot.data() } as DailyMenu));
    const user = auth.currentUser;
    if (!user) return menuUnsubscribe;
    let bookingsUnsubscribe: (() => void) | undefined;
    let studentsUnsubscribe: (() => void) | undefined;
    let membershipsUnsubscribe: (() => void) | undefined;
    const vendorUnsubscribe = onSnapshot(doc(db, "users", user.uid), (snapshot) => {
      const data = snapshot.exists() ? snapshot.data() as UserProfile : {
        name: "Vendor", rollNumber: "", email: "", role: "vendor", balance: 0,
      } as UserProfile;
      const profile = { ...data, role: data.role ?? "vendor", messId: data.messId || user.uid };
      setVendor(profile);
      if (!data.messId) {
        void setDoc(doc(db, "users", user.uid), { messId: user.uid, role: "vendor" }, { merge: true }).catch((error) =>
          console.error("Unable to initialize vendor Mess ID.", error),
        );
      }
      bookingsUnsubscribe?.();
      studentsUnsubscribe?.();
      membershipsUnsubscribe?.();
      if (profile.messId) {
        bookingsUnsubscribe = onSnapshot(query(collection(db, "meal_bookings"), where("messId", "==", profile.messId)), (snapshot) =>
          setBookings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as MealBooking)),
        );
        studentsUnsubscribe = onSnapshot(query(collection(db, "users"), where("messId", "==", profile.messId)), (snapshot) =>
          setStudents(snapshot.docs
            .map((item) => ({ id: item.id, ...item.data() }) as UserProfile & { id: string })
            .filter((item) => item.role === "student")),
        );
        membershipsUnsubscribe = onSnapshot(query(collection(db, "mess_memberships"), where("messId", "==", profile.messId)), (snapshot) => {
          setStudents((current) => {
            const merged = new Map<string, UserProfile & { id?: string }>();
            current.forEach((student) => {
              const user = student as UserProfile & { id?: string };
              const key = user.id ? `uid:${user.id}` : `email:${user.email?.trim().toLowerCase()}`;
              merged.set(key, user);
              const email = user.email?.trim().toLowerCase();
              if (email) merged.set(`email:${email}`, user);
            });
            snapshot.docs.forEach((membership) => {
              const data = membership.data();
              const uid = String(data.uid ?? "");
              const email = String(data.email ?? "").trim().toLowerCase();
              const existingByUid = uid ? Array.from(merged.entries()).find(([key]) => key === `uid:${uid}`)?.[1] : undefined;
              const existingByEmail = email ? merged.get(`email:${email}`) : undefined;
              const existing = existingByUid ?? existingByEmail;
              if (!existing) {
                merged.set(uid ? `uid:${uid}` : `email:${email}`, {
                  id: uid,
                  name: data.studentName as string,
                  rollNumber: data.rollNumber as string,
                  email: String(data.email ?? ""),
                  role: "student",
                  balance: 2000,
                  messId: profile.messId,
                });
              }
            });
            const unique = new Map<string, UserProfile & { id?: string }>();
            Array.from(merged.values()).forEach((student) => {
              const key = student.id
                ? `uid:${student.id}`
                : `email:${student.email?.trim().toLowerCase()}`;
              if (!unique.has(key)) unique.set(key, student);
            });
            return Array.from(unique.values());
          });
        });
      }
    });
    return () => { menuUnsubscribe(); vendorUnsubscribe(); bookingsUnsubscribe?.(); studentsUnsubscribe?.(); membershipsUnsubscribe?.(); };
  }, []);

  const markConsumed = async (booking: MealBooking) => {
    if (!vendor) return;
    try {
      await consumeMealBooking(vendor, auth.currentUser!.uid, booking.id);
      setMessage("Meal marked as consumed.");
      setSuccess(true);
    } catch (error) {
      console.error("Unable to mark meal consumed.", error);
      setMessage(error instanceof Error ? error.message : "Unable to mark meal consumed.");
    }
  };

  const today = getTodayDate();
  const todayBookings = bookings.filter((item) => item.date === today);
  const weeklyBookings = bookings.filter((item) => item.status !== "cancelled");
  const lowBalances = students.filter((item) => (item.balance ?? 0) <= 500).length;
  const totalBalance = students.reduce((sum, item) => sum + (item.balance ?? 0), 0);
  const totalCollected = bookings
    .filter((item) => item.status === "consumed")
    .reduce((sum, item) => sum + item.amount, 0);

  const updateMenu = async () => {
    try {
      await setDoc(doc(db, "daily_menu", "today"), { ...menu, updatedAt: serverTimestamp() }, { merge: true });
      setMessage("Today's menu updated."); setSuccess(true);
    } catch (error) { console.error("Unable to update menu.", error); setMessage("Unable to update the menu."); }
  };

  return (
    <View style={styles.page}>
      <FlatList contentContainerStyle={styles.container} data={bookings} keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <Text style={styles.eyebrow}>VENDOR CONSOLE</Text><Text variant="headlineMedium" style={styles.title}>Manage today&apos;s menu</Text>
            {!!vendor?.messId && <Text style={styles.messId}>Mess ID: {vendor.messId}</Text>}
            <Button
              mode="outlined"
              icon="logout"
              textColor="#D62828"
              onPress={() => void signOut(auth)}
              style={styles.signOutButton}
            >
              Sign out
            </Button>
            <View style={styles.actionRow}>
              <Button mode="outlined" icon="calendar-week" onPress={() => navigation.navigate("WeeklyMenuManagement")} style={styles.actionButton}>Weekly menu</Button>
              <Button mode="outlined" icon="account-group" onPress={() => navigation.navigate("StudentManagement")} style={styles.actionButton}>Students</Button>
            </View>
            <View style={styles.analytics}>
              <View style={styles.statCard}><Text style={styles.statValue}>{students.length}</Text><Text style={styles.statLabel}>Students</Text></View>
              <View style={styles.statCard}><Text style={styles.statValue}>{todayBookings.length}</Text><Text style={styles.statLabel}>Today</Text></View>
              <View style={styles.statCard}><Text style={styles.statValue}>{weeklyBookings.length}</Text><Text style={styles.statLabel}>Week</Text></View>
              <View style={styles.statCard}><Text style={styles.statValue}>₹{totalBalance}</Text><Text style={styles.statLabel}>Balances</Text></View>
              <View style={styles.statCard}><Text style={styles.statValue}>₹{totalCollected}</Text><Text style={styles.statLabel}>Collected</Text></View>
              <View style={styles.statCard}><Text style={styles.statValue}>{lowBalances}</Text><Text style={styles.statLabel}>Low balance</Text></View>
            </View>
            <Card style={styles.todayCard}><Card.Content>
              {(["breakfast", "lunch", "dinner"] as const).map((mealType) => (
                <View key={mealType} style={styles.mealCountRow}>
                  <Text style={styles.mealCountLabel}>{mealType[0].toUpperCase() + mealType.slice(1)}</Text>
                  <Text style={styles.mealCountValue}>{todayBookings.filter((item) => item.mealType === mealType).length}</Text>
                </View>
              ))}
            </Card.Content></Card>
            <Card style={styles.menuCard}><Card.Content>
              {(["breakfast", "lunch", "dinner"] as const).map((mealType) => (
                <TextInput key={mealType} mode="outlined" label={mealType[0].toUpperCase() + mealType.slice(1)} onChangeText={(value) => setMenu({ ...menu, [mealType]: value })} style={styles.input} value={menu[mealType]} outlineStyle={styles.inputOutline} />
              ))}
              <HelperText type={message.includes("Unable") ? "error" : "info"}>{message}</HelperText>
              <Button mode="contained" icon="publish" onPress={() => void updateMenu()} contentStyle={styles.publishContent}>Publish menu</Button>
            </Card.Content></Card>
            <View style={styles.headcount}><View><Text style={styles.headcountLabel}>Live bookings</Text><Text style={styles.headcountValue}>{bookings.length}</Text></View><View style={styles.headcountIcon}><Icon source="account-group-outline" size={28} color="#FFFFFF" /></View></View>
            <Text variant="titleMedium" style={styles.sectionTitle}>Recent orders</Text>
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>No bookings yet.</Text>}
        renderItem={({ item }) => (
          <Card style={styles.logCard}><Card.Content style={styles.logItem}>
            <View style={styles.logIcon}><Icon source="account" size={20} color="#D62828" /></View>
            <View style={styles.logText}><Text style={styles.student}>{item.studentName ?? item.uid}</Text><Text style={styles.meal}>{item.mealType[0].toUpperCase() + item.mealType.slice(1)} · {item.date}</Text></View>
            <Text style={styles.amount}>₹{item.amount}</Text>
            {item.status !== "consumed" && <Button compact mode="text" onPress={() => void markConsumed(item)}>Consume</Button>}
            {item.status === "consumed" && <Text style={styles.consumed}>Consumed</Text>}
          </Card.Content></Card>
        )}
      />
      <Snackbar visible={success} onDismiss={() => setSuccess(false)} duration={2500} style={styles.snackbar}>Today's menu updated</Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  actionButton: { flex: 1, marginHorizontal: 3 },
  actionRow: { flexDirection: "row", marginBottom: 12, marginTop: 12 },
  analytics: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -3, marginBottom: 12 },
  amount: { color: "#D62828", fontSize: 15, fontWeight: "900" },
  container: { paddingBottom: 24, paddingHorizontal: 18, paddingTop: 20 },
  empty: { color: "#777777", textAlign: "center", marginTop: 30 },
  eyebrow: { color: "#D62828", fontSize: 12, fontWeight: "900", letterSpacing: 1.2 },
  headcount: { alignItems: "center", backgroundColor: "#F77F00", borderRadius: 18, flexDirection: "row", justifyContent: "space-between", marginBottom: 20, minHeight: 82, paddingHorizontal: 16 },
  headcountIcon: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 18, height: 50, justifyContent: "center", width: 50 },
  headcountLabel: { color: "#FFFFFF", opacity: 0.9 },
  headcountValue: { color: "#FFFFFF", fontSize: 28, fontWeight: "900" },
  input: { backgroundColor: "#FFFFFF", marginBottom: 8 },
  inputOutline: { borderRadius: 12 },
  logCard: { borderRadius: 15, marginBottom: 9 },
  logIcon: { alignItems: "center", backgroundColor: "#FFF1E6", borderRadius: 12, height: 42, justifyContent: "center", width: 42 },
  logItem: { alignItems: "center", flexDirection: "row" },
  logText: { flex: 1, marginHorizontal: 12 },
  consumed: { color: "#2E7D32", fontSize: 10, fontWeight: "900" },
  meal: { color: "#777777", fontSize: 11, marginTop: 3 },
  menuCard: { borderRadius: 20, marginBottom: 14, marginTop: 12 },
  page: { backgroundColor: "#FFF8F3", flex: 1 },
  publishContent: { height: 48 },
  sectionTitle: { color: "#252525", fontWeight: "900", marginBottom: 10 },
  snackbar: { backgroundColor: "#9D0208" },
  mealCountLabel: { color: "#252525", fontWeight: "800", textTransform: "capitalize" },
  mealCountRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  mealCountValue: { color: "#D62828", fontWeight: "900" },
  messId: { color: "#777777", fontSize: 12, marginTop: 4 },
  signOutButton: { alignSelf: "flex-end", borderColor: "#D62828", borderRadius: 12, marginTop: 8 },
  statCard: { backgroundColor: "#FFFFFF", borderRadius: 14, margin: 3, minHeight: 72, padding: 10, width: "30%" },
  statLabel: { color: "#777777", fontSize: 10, marginTop: 3 },
  statValue: { color: "#D62828", fontSize: 18, fontWeight: "900" },
  todayCard: { borderRadius: 16, marginBottom: 14 },
  student: { color: "#252525", fontWeight: "900" },
  title: { color: "#252525", fontWeight: "900", marginTop: 3 },
});
