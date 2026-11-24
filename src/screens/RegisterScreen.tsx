import { useState } from "react";
import type { ReactElement } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, doc, getDocs, query, setDoc, serverTimestamp, where } from "firebase/firestore";
import { Button, HelperText, SegmentedButtons, Text, TextInput } from "react-native-paper";
import { auth, db } from "../firebaseConfig";
import type { UserRole } from "../types/navigation";

export default function RegisterScreen({ onBack }: { onBack: () => void }): ReactElement {
  const [name, setName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [messId, setMessId] = useState("");
  const [messName, setMessName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleRegister = async () => {
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const enteredMessId = messId.trim().replace(/\s/g, "");
      let resolvedMessId = enteredMessId;
      if (role === "vendor") {
        const existingVendor = await getDocs(
          query(collection(db, "users"), where("messId", "==", resolvedMessId)),
        );
        if (!existingVendor.empty) throw new Error("MESS_ID_TAKEN");
      } else {
        const vendorsSnapshot = await getDocs(
          query(collection(db, "users"), where("role", "==", "vendor")),
        );
        const vendors = vendorsSnapshot.docs.map((vendor) => ({
          id: vendor.id,
          ...(vendor.data() as { messId?: string; email?: string }),
        }));
        const campusVendor = vendors.find((vendor) =>
          vendor.email?.trim().toLowerCase().includes("campusmess.demo"),
        ) ?? vendors[0];
        if (!campusVendor) throw new Error("NO_VENDOR_AVAILABLE");
        resolvedMessId = String(campusVendor.messId || campusVendor.id).trim();
      }
      const studentMessId = role === "student"
        ? `STU-${credential.user.uid.slice(0, 12).toUpperCase()}`
        : null;
      await setDoc(doc(db, "users", credential.user.uid), {
        name: name.trim(),
        rollNumber: rollNumber.trim(),
        email: email.trim(),
        role,
        balance: 2000,
        messId: resolvedMessId,
        messName: role === "vendor" ? messName.trim() : "",
        studentMessId,
      });
      if (role === "student") {
        await setDoc(doc(db, "mess_memberships", `${resolvedMessId}_${credential.user.uid}`), {
          messId: resolvedMessId,
          uid: credential.user.uid,
          studentName: name.trim(),
          rollNumber: rollNumber.trim(),
          email: email.trim(),
          studentMessId,
          role: "student",
          active: true,
          registeredAt: serverTimestamp(),
        });
      }
      setSuccess(role === "student"
        ? `Account created. Assigned to Mess ID: ${resolvedMessId}. Student ID: ${studentMessId}`
        : "Account created. You can now sign in.");
      setName("");
      setRollNumber("");
      setEmail("");
      setPassword("");
      setMessId("");
      await signOut(auth);
    } catch (registrationError) {
      console.error("Registration failed.", registrationError);
      if (registrationError instanceof Error && "code" in registrationError) {
        const code = String((registrationError as Error & { code: string }).code);
        if (code === "auth/email-already-in-use") setError("This email is already registered.");
        else if (code === "auth/invalid-email") setError("Enter a valid email address.");
        else if (code === "auth/weak-password") setError("Password must be at least 6 characters.");
        else setError("Unable to create the account. Check the Mess ID and your details.");
      } else if (registrationError instanceof Error && registrationError.message === "MESS_ID_TAKEN") {
        setError("That Mess ID is already taken. Choose a different one.");
        await signOut(auth);
      } else if (registrationError instanceof Error && registrationError.message === "NO_VENDOR_AVAILABLE") {
        setError("No vendor is available yet. Ask a vendor to create an account first.");
        await signOut(auth);
      } else {
        setError("Unable to create the account. Check the Mess ID and your details.");
        await signOut(auth);
      }
    } finally { setSubmitting(false); }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}><Text style={styles.eyebrow}>JOIN CAMPUS MESS</Text><Text variant="headlineMedium" style={styles.title}>Create account</Text></View>
      <TextInput mode="outlined" label="Name" onChangeText={setName} style={styles.input} value={name} outlineStyle={styles.inputOutline} />
      {role === "student" && <TextInput mode="outlined" label="Roll Number" onChangeText={setRollNumber} style={styles.input} value={rollNumber} outlineStyle={styles.inputOutline} />}
      {role === "vendor" && <TextInput mode="outlined" label="Mess Name" onChangeText={setMessName} style={styles.input} value={messName} outlineStyle={styles.inputOutline} />}
      {role === "vendor" && (
        <>
          <TextInput
            mode="outlined"
            label="Choose Mess ID"
            onChangeText={setMessId}
            style={styles.input}
            value={messId}
            autoCapitalize="none"
            outlineStyle={styles.inputOutline}
          />
          <HelperText type="info" visible={!messId}>
            Choose a unique ID for your mess.
          </HelperText>
        </>
      )}
      <TextInput mode="outlined" autoCapitalize="none" label="Email" keyboardType="email-address" onChangeText={setEmail} style={styles.input} value={email} outlineStyle={styles.inputOutline} />
      <TextInput mode="outlined" label="Password" onChangeText={setPassword} secureTextEntry style={styles.input} value={password} outlineStyle={styles.inputOutline} />
      <SegmentedButtons buttons={[{ label: "Student", value: "student" }, { label: "Vendor", value: "vendor" }]} onValueChange={(value) => setRole(value as UserRole)} value={role} style={styles.roles} />
      <HelperText type="error" visible={Boolean(error)}>{error}</HelperText>
      {!!success && <HelperText type="info" visible>{success}</HelperText>}
      <Button disabled={submitting || !name || !email || password.length < 6 || (role === "student" && !rollNumber) || (role === "vendor" && (!messName.trim() || !messId.trim()))} loading={submitting} mode="contained" onPress={() => void handleRegister()} style={styles.primary} contentStyle={styles.primaryContent}>Register</Button>
      <Button onPress={onBack} textColor="#D62828">Back to sign in</Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: "#FFF8F3", flexGrow: 1, justifyContent: "center", padding: 24 },
  eyebrow: { color: "#D62828", fontSize: 12, fontWeight: "900", letterSpacing: 1.2, textAlign: "center" },
  header: { marginBottom: 16 },
  input: { backgroundColor: "#FFFFFF", marginBottom: 10 },
  inputOutline: { borderRadius: 14 },
  primary: { borderRadius: 14 },
  primaryContent: { height: 52 },
  roles: { marginBottom: 8, marginTop: 4 },
  title: { color: "#252525", fontWeight: "900", textAlign: "center" },
});
