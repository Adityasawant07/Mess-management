import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { collection, doc, onSnapshot, query, setDoc, where } from "firebase/firestore";
import { Button, Card, Dialog, Portal, Text, TextInput } from "react-native-paper";
import { auth, db } from "../firebaseConfig";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BalanceTransaction, MealBooking, UserProfile } from "../types/models";
import type { VendorStackParamList } from "../types/navigation";
import { addStudentBalance } from "../services/messService";

type Props = NativeStackScreenProps<VendorStackParamList, "StudentManagement">;

export default function StudentManagementScreen({ navigation }: Props): ReactElement {
  const [vendor, setVendor] = useState<UserProfile | null>(null);
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState("");
  const [selectedUid, setSelectedUid] = useState("");
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpVisible, setTopUpVisible] = useState(false);
  const [history, setHistory] = useState<MealBooking[]>([]);
  const [transactions, setTransactions] = useState<BalanceTransaction[]>([]);
  const [membershipOnlyStudents, setMembershipOnlyStudents] = useState<Array<UserProfile & { id: string }>>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return undefined;
    let studentsUnsubscribe: (() => void) | undefined;
    let membershipsUnsubscribe: (() => void) | undefined;
    const vendorUnsubscribe = onSnapshot(doc(db, "users", user.uid), (snapshot) => {
      const data = snapshot.exists() ? snapshot.data() as UserProfile : {
        name: "Vendor", rollNumber: "", email: "", role: "vendor", balance: 0,
      } as UserProfile;
      const nextVendor = { ...data, role: data.role ?? "vendor", messId: data.messId || user.uid };
      setVendor(nextVendor);
      if (!data.messId) {
        void setDoc(doc(db, "users", user.uid), { messId: user.uid, role: "vendor" }, { merge: true }).catch((error) =>
          console.error("Unable to initialize vendor Mess ID.", error),
        );
      }
      studentsUnsubscribe?.();
      membershipsUnsubscribe?.();
      if (nextVendor.messId) {
        studentsUnsubscribe = onSnapshot(
          query(collection(db, "users"), where("messId", "==", nextVendor.messId)),
          (studentSnapshot) => setStudents(studentSnapshot.docs
            .map((item) => ({ id: item.id, ...item.data() }) as UserProfile & { id: string })
            .filter((item) => item.role === "student")),
        );
        membershipsUnsubscribe = onSnapshot(
          query(collection(db, "mess_memberships"), where("messId", "==", nextVendor.messId)),
          (membershipSnapshot) => setMembershipOnlyStudents(
            membershipSnapshot.docs.map((item) => {
              const data = item.data();
              return {
                id: data.uid as string,
                name: data.studentName as string,
                rollNumber: data.rollNumber as string,
                email: data.email as string,
                role: "student",
                balance: 2000,
                messId: nextVendor.messId,
              };
            }),
          ),
        );
      }
    });
    return () => { vendorUnsubscribe(); studentsUnsubscribe?.(); membershipsUnsubscribe?.(); };
  }, []);

  const openStudent = (student: UserProfile & { id?: string }) => {
    if (!student.id) return;
    setSelectedUid(student.id);
    setTopUpAmount("");
    setTopUpVisible(false);
    onSnapshot(query(collection(db, "meal_bookings"), where("uid", "==", student.id)), (snapshot) =>
      setHistory(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as MealBooking)),
    );
    onSnapshot(query(collection(db, "balance_transactions"), where("uid", "==", student.id)), (snapshot) =>
      setTransactions(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as BalanceTransaction)),
    );
  };

  const allStudents = [...students];
  for (const member of membershipOnlyStudents) {
    const studentIndex = allStudents.findIndex((student) => {
      const user = student as UserProfile & { id?: string };
      return user.id === member.id ||
        Boolean(user.email && member.email && user.email.trim().toLowerCase() === member.email.trim().toLowerCase());
    });
    if (studentIndex === -1) allStudents.push(member);
    else allStudents[studentIndex] = { ...member, ...allStudents[studentIndex] };
  }
  const selectedStudent = allStudents.find((student) => (student as UserProfile & { id?: string }).id === selectedUid);
  const filtered = allStudents.filter((student) => {
    const text = `${student.name} ${student.rollNumber}`.toLowerCase();
    return text.includes(search.toLowerCase());
  });
  const monthSpent = history
    .filter((item) => item.status === "consumed" && item.consumedAt?.toDate().getMonth() === new Date().getMonth())
    .reduce((total, item) => total + item.amount, 0);

  const topUp = async () => {
    if (!vendor || !selectedUid) return;
    const amount = Number(topUpAmount);
    try {
      await addStudentBalance(vendor, selectedUid, amount);
      setTopUpVisible(false);
      setMessage(`₹${amount} added successfully.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add balance.");
    }
  };

  return (
    <View style={styles.page}>
      <FlatList
        contentContainerStyle={styles.container}
        data={filtered}
        keyExtractor={(item) => (item as UserProfile & { id: string }).id}
        ListHeaderComponent={
          <View>
            <Text style={styles.eyebrow}>MESS DIRECTORY</Text>
            <Text variant="headlineMedium" style={styles.title}>Student management</Text>
            <TextInput mode="outlined" label="Search name or student ID" value={search} onChangeText={setSearch} left={<TextInput.Icon icon="magnify" />} style={styles.search} />
            {selectedStudent && (
              <Card style={[styles.detailCard, (selectedStudent.balance ?? 0) <= 500 && styles.lowCard]}>
                <Card.Content>
                  <Text style={styles.detailName}>{selectedStudent.name}</Text>
                  <Text style={styles.detailMeta}>{selectedStudent.rollNumber} · Balance ₹{selectedStudent.balance ?? 0}</Text>
                  <Text style={styles.detailMeta}>Monthly expenditure: ₹{monthSpent}</Text>
                  <Text style={styles.detailMeta}>{history.filter((item) => item.status === "consumed").length} consumed meals</Text>
                  <Button mode="contained" onPress={() => setTopUpVisible(true)} style={styles.topUpButton}>Add balance</Button>
                </Card.Content>
              </Card>
            )}
            {!!message && <Text style={styles.message}>{message}</Text>}
          </View>
        }
        renderItem={({ item }) => {
          const student = item as UserProfile & { id: string };
          const low = (student.balance ?? 0) <= 500;
          return (
            <Card style={[styles.studentCard, low && styles.lowCard]} onPress={() => openStudent(student)}>
              <Card.Content style={styles.studentRow}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{student.name.charAt(0).toUpperCase()}</Text></View>
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{student.name}</Text>
                  <Text style={styles.studentMeta}>{student.rollNumber}</Text>
                </View>
                <View style={styles.balanceWrap}>
                  <Text style={[styles.studentBalance, low && styles.lowText]}>{low ? "Low" : "Balance"}</Text>
                  <Text style={styles.balanceAmount}>₹{student.balance ?? 0}</Text>
                </View>
              </Card.Content>
            </Card>
          );
        }}
      />
      <Button icon="arrow-left" onPress={() => navigation.goBack()} style={styles.back}>Back</Button>
      <Portal>
        <Dialog visible={topUpVisible} onDismiss={() => setTopUpVisible(false)}>
          <Dialog.Title>Add student balance</Dialog.Title>
          <Dialog.Content>
            <TextInput label="Amount (₹)" value={topUpAmount} onChangeText={setTopUpAmount} keyboardType="numeric" mode="outlined" />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setTopUpVisible(false)}>Cancel</Button>
            <Button mode="contained" onPress={() => void topUp()} disabled={!topUpAmount || Number(topUpAmount) <= 0}>Add</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", backgroundColor: "#FFF1E6", borderRadius: 16, height: 48, justifyContent: "center", width: 48 },
  avatarText: { color: "#D62828", fontSize: 18, fontWeight: "900" },
  back: { marginHorizontal: 18, marginBottom: 8 },
  balanceAmount: { color: "#252525", fontSize: 16, fontWeight: "900" },
  balanceWrap: { alignItems: "flex-end" },
  container: { padding: 18, paddingBottom: 8 },
  detailCard: { borderRadius: 18, marginBottom: 12 },
  detailMeta: { color: "#777777", marginTop: 4 },
  detailName: { color: "#252525", fontSize: 17, fontWeight: "900" },
  eyebrow: { color: "#D62828", fontSize: 12, fontWeight: "900", letterSpacing: 1.2 },
  lowCard: { borderColor: "#D62828", borderWidth: 1 },
  lowText: { color: "#D62828" },
  message: { color: "#2E7D32", marginBottom: 10, textAlign: "center" },
  page: { backgroundColor: "#FFF8F3", flex: 1 },
  search: { backgroundColor: "#FFFFFF", marginBottom: 12, marginTop: 12 },
  studentBalance: { color: "#777777", fontSize: 10 },
  studentCard: { borderRadius: 16, marginBottom: 9 },
  studentInfo: { flex: 1, marginHorizontal: 12 },
  studentMeta: { color: "#777777", fontSize: 12, marginTop: 3 },
  studentName: { color: "#252525", fontWeight: "900" },
  studentRow: { alignItems: "center", flexDirection: "row" },
  title: { color: "#252525", fontWeight: "900", marginTop: 3 },
  topUpButton: { marginTop: 12 },
});
