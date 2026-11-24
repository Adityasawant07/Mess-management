import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { Button, Card, Icon, Text } from "react-native-paper";
import { auth, db } from "../firebaseConfig";
import BottomNavigation from "../components/BottomNavigation";
import type { UserProfile } from "../types/models";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { StudentStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<StudentStackParamList, "Profile">;

export default function ProfileScreen({ navigation }: Props): ReactElement {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return undefined;
    return onSnapshot(doc(db, "users", user.uid), (snapshot) => setProfile(snapshot.data() as UserProfile));
  }, []);

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>STUDENT ACCOUNT</Text>
        <Text variant="headlineMedium" style={styles.title}>Profile</Text>
        <Card style={styles.profileCard}>
          <Card.Content style={styles.profileContent}>
            <View style={styles.avatar}><Icon source="account" size={34} color="#FFFFFF" /></View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{profile?.name ?? "Student"}</Text>
              <Text style={styles.profileEmail}>{profile?.email}</Text>
              <View style={styles.roleChip}><Text style={styles.roleText}>{profile?.role ?? "student"}</Text></View>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.walletCard}>
          <Card.Content style={styles.walletContent}>
            <View><Text style={styles.walletLabel}>Available balance</Text><Text style={styles.walletAmount}>₹{profile?.balance?.toLocaleString("en-IN") ?? "0"}</Text></View>
            <View style={styles.walletIcon}><Icon source="wallet-outline" size={30} color="#FFFFFF" /></View>
          </Card.Content>
        </Card>

        <Text variant="titleMedium" style={styles.sectionTitle}>Account details</Text>
        <Card style={styles.detailsCard}>
          <Card.Content>
            <View style={styles.detailRow}><View style={styles.detailIcon}><Icon source="identifier" size={20} color="#D62828" /></View><View><Text style={styles.detailLabel}>Roll number</Text><Text style={styles.detailValue}>{profile?.rollNumber ?? "—"}</Text></View></View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}><View style={styles.detailIcon}><Icon source="school-outline" size={20} color="#D62828" /></View><View><Text style={styles.detailLabel}>Current semester</Text><Text style={styles.detailValue}>Active semester</Text></View></View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}><View style={styles.detailIcon}><Icon source="email-outline" size={20} color="#D62828" /></View><View style={styles.detailText}><Text style={styles.detailLabel}>Email address</Text><Text style={styles.detailValue}>{profile?.email ?? "—"}</Text></View></View>
          </Card.Content>
        </Card>
        <Button icon="logout" mode="outlined" textColor="#D62828" onPress={() => void signOut(auth)} style={styles.signOut}>Sign out</Button>
      </ScrollView>
      <BottomNavigation navigation={navigation} active="Profile" />
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", backgroundColor: "#D62828", borderRadius: 30, height: 60, justifyContent: "center", width: 60 },
  avatarText: { color: "#FFFFFF", fontSize: 24, fontWeight: "900" },
  container: { paddingBottom: 12, paddingHorizontal: 18, paddingTop: 20 },
  detailDivider: { backgroundColor: "#F2E7DF", height: 1, marginVertical: 12 },
  detailIcon: { alignItems: "center", backgroundColor: "#FFF1E6", borderRadius: 12, height: 42, justifyContent: "center", marginRight: 12, width: 42 },
  detailLabel: { color: "#777777", fontSize: 11 },
  detailRow: { alignItems: "center", flexDirection: "row" },
  detailText: { flex: 1 },
  detailValue: { color: "#252525", fontSize: 14, fontWeight: "800", marginTop: 2 },
  detailsCard: { borderRadius: 18, marginBottom: 16 },
  dialog: { borderRadius: 24 },
  dialogText: { color: "#777777", textAlign: "center" },
  dialogTitle: { textAlign: "center" },
  eyebrow: { color: "#D62828", fontSize: 12, fontWeight: "900", letterSpacing: 1.2 },
  page: { backgroundColor: "#FFF8F3", flex: 1 },
  profileCard: { borderRadius: 20, marginBottom: 12, marginTop: 14 },
  profileContent: { alignItems: "center", flexDirection: "row", paddingVertical: 8 },
  profileEmail: { color: "#777777", fontSize: 12, marginTop: 3 },
  profileInfo: { flex: 1, marginLeft: 14 },
  profileName: { color: "#252525", fontSize: 18, fontWeight: "900" },
  roleChip: { alignSelf: "flex-start", backgroundColor: "#FFF1E6", borderRadius: 10, marginTop: 7, paddingHorizontal: 9, paddingVertical: 3 },
  roleText: { color: "#D62828", fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  sectionTitle: { color: "#252525", fontWeight: "900", marginBottom: 10 },
  signOut: { borderColor: "#D62828", borderRadius: 14, marginBottom: 10 },
  snackbar: { backgroundColor: "#9D0208" },
  title: { color: "#252525", fontWeight: "900", marginTop: 3 },
  topUpButton: { borderRadius: 12 },
  walletAmount: { color: "#FFFFFF", fontSize: 28, fontWeight: "900", marginTop: 3 },
  walletCard: { backgroundColor: "#F77F00", borderRadius: 20, marginBottom: 22 },
  walletContent: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 82 },
  walletIcon: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 20, height: 50, justifyContent: "center", width: 50 },
  walletLabel: { color: "#FFFFFF", opacity: 0.9 },
});
