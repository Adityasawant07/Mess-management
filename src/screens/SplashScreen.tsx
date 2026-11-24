import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { Text } from "react-native-paper";
import { auth, db } from "../firebaseConfig";
import type { UserRole } from "../types/navigation";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function SplashScreenView({ onResolved }: { onResolved: (uid: string | null, role: UserRole | null) => void }): ReactElement {
  const logoScale = useRef(new Animated.Value(0.65)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(18)).current;
  const loaderOpacity = useRef(new Animated.Value(0)).current;
  const loaderScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const startedAt = Date.now();
    let resolvedResult: { uid: string | null; role: UserRole | null } | null = null;
    let finishTimeout: ReturnType<typeof setTimeout> | null = null;

    const finishAfterAnimation = () => {
      if (!resolvedResult || finishTimeout) return;
      const remaining = Math.max(0, 1800 - (Date.now() - startedAt));
      finishTimeout = setTimeout(() => {
        onResolved(resolvedResult!.uid, resolvedResult!.role);
        void SplashScreen.hideAsync();
      }, remaining);
    };

    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 550,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 5,
          tension: 70,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(titleTranslateY, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(loaderOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.spring(loaderScale, {
          toValue: 1,
          friction: 6,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          resolvedResult = { uid: null, role: null };
          finishAfterAnimation();
          return;
        }
        const profile = await getDoc(doc(db, "users", user.uid));
        const role = profile.data()?.role;
        resolvedResult = {
          uid: user.uid,
          role: role === "student" || role === "vendor" ? role : null,
        };
        finishAfterAnimation();
      } catch (error) {
        console.error("Unable to load the user profile.", error);
        resolvedResult = { uid: null, role: null };
        finishAfterAnimation();
      }
    });
    return () => {
      unsubscribe();
      if (finishTimeout) clearTimeout(finishTimeout);
    };
  }, [onResolved]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.logo,
          { opacity: logoOpacity, transform: [{ scale: logoScale }] },
        ]}
      >
        <Image source={require("../../assets/splash-icon.png")} style={styles.logoImage} resizeMode="contain" />
      </Animated.View>
      <Animated.View
        style={[
          styles.copy,
          {
            opacity: titleOpacity,
            transform: [{ translateY: titleTranslateY }],
          },
        ]}
      >
        <Text style={styles.name}>Campus Mess</Text>
        <Text style={styles.tag}>Fresh meals, simple living</Text>
      </Animated.View>
      <Animated.View
        style={[
          styles.loader,
          { opacity: loaderOpacity, transform: [{ scale: loaderScale }] },
        ]}
      >
        <View style={[styles.loaderDot, styles.dotOne]} />
        <View style={[styles.loaderDot, styles.dotTwo]} />
        <View style={[styles.loaderDot, styles.dotThree]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", backgroundColor: "#FFF8F3", flex: 1, justifyContent: "center" },
  copy: { alignItems: "center" },
  dotOne: { backgroundColor: "#D62828" },
  dotTwo: { backgroundColor: "#F77F00" },
  dotThree: { backgroundColor: "#FCBF49" },
  loader: { flexDirection: "row", marginTop: 24 },
  loaderDot: { borderRadius: 5, height: 10, marginHorizontal: 4, width: 10 },
  logo: { alignItems: "center", backgroundColor: "#D62828", borderRadius: 28, elevation: 8, height: 88, justifyContent: "center", width: 88 },
  logoImage: { height: 88, width: 88 },
  name: { color: "#252525", fontSize: 26, fontWeight: "900", marginTop: 18 },
  tag: { color: "#777777", marginTop: 5 },
});
