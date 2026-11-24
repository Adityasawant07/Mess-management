import { useState } from "react";
import type { ReactElement } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Button, HelperText, Icon, Text, TextInput } from "react-native-paper";
import { auth } from "../firebaseConfig";

type Props = { onRegister: () => void };

export default function LoginScreen({ onRegister }: Props): ReactElement {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async () => {
    setError(""); setSubmitting(true);
    try { await signInWithEmailAndPassword(auth, email.trim(), password); }
    catch (loginError) { console.error("Login failed.", loginError); setError("Unable to sign in. Check your email and password."); }
    finally { setSubmitting(false); }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.brand}>
        <View style={styles.brandIcon}><Icon source="silverware-fork-knife" size={34} color="#FFFFFF" /></View>
        <Text style={styles.brandName}>Campus Mess</Text>
        <Text style={styles.brandTag}>Fresh meals, simple living</Text>
      </View>
      <Text variant="headlineMedium" style={styles.title}>Welcome back</Text>
      <Text style={styles.subtitle}>Sign in to manage your meals</Text>
      <TextInput mode="outlined" left={<TextInput.Icon icon="email-outline" />} autoCapitalize="none" label="Email" keyboardType="email-address" onChangeText={setEmail} style={styles.input} value={email} outlineStyle={styles.inputOutline} />
      <TextInput mode="outlined" left={<TextInput.Icon icon="lock-outline" />} label="Password" onChangeText={setPassword} secureTextEntry style={styles.input} value={password} outlineStyle={styles.inputOutline} />
      <HelperText type="error" visible={Boolean(error)}>{error}</HelperText>
      <Button disabled={submitting || !email || !password} loading={submitting} mode="contained" onPress={() => void handleLogin()} style={styles.primary} contentStyle={styles.primaryContent}>Sign in</Button>
      <Button onPress={onRegister} textColor="#D62828" style={styles.secondary}>Create an account</Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: "center", marginBottom: 34 },
  brandIcon: { alignItems: "center", backgroundColor: "#D62828", borderRadius: 24, elevation: 6, height: 72, justifyContent: "center", marginBottom: 12, width: 72 },
  brandName: { color: "#252525", fontSize: 22, fontWeight: "900" },
  brandTag: { color: "#777777", fontSize: 13, marginTop: 4 },
  container: { backgroundColor: "#FFF8F3", flexGrow: 1, justifyContent: "center", padding: 24 },
  input: { backgroundColor: "#FFFFFF", marginBottom: 10 },
  inputOutline: { borderRadius: 14 },
  primary: { borderRadius: 14, marginTop: 6 },
  primaryContent: { height: 52 },
  secondary: { marginTop: 8 },
  subtitle: { color: "#777777", marginBottom: 18, textAlign: "center" },
  title: { color: "#252525", fontWeight: "900", textAlign: "center" },
});
