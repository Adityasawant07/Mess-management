import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { Card, Icon, IconButton, Text } from "react-native-paper";
import { auth, db } from "../firebaseConfig";
import BottomNavigation from "../components/BottomNavigation";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MenuMealType, MenuRating, UserProfile, WeekDay, WeeklyMenu } from "../types/models";
import type { StudentStackParamList } from "../types/navigation";
import { submitMenuRating, WEEK_DAYS } from "../services/messService";

type Props = NativeStackScreenProps<StudentStackParamList, "WeeklyMenu">;

export default function WeeklyMenuStudentScreen({ navigation }: Props): ReactElement {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [weeklyMenu, setWeeklyMenu] = useState<WeeklyMenu | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [ratingMessage, setRatingMessage] = useState("");

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return undefined;
    let menuUnsubscribe: (() => void) | undefined;
    let ratingsUnsubscribe: (() => void) | undefined;
    const profileUnsubscribe = onSnapshot(doc(db, "users", user.uid), (snapshot) => {
      const data = snapshot.data() as UserProfile | undefined;
      const nextProfile = data ? { ...data, messId: data.messId?.trim() } : null;
      if (!nextProfile) return;
      setProfile(nextProfile);
      menuUnsubscribe?.();
      ratingsUnsubscribe?.();
      if (nextProfile.messId) {
        menuUnsubscribe = onSnapshot(doc(db, "weekly_menus", nextProfile.messId), (menuSnapshot) => {
          setWeeklyMenu(menuSnapshot.exists() ? menuSnapshot.data() as WeeklyMenu : null);
        });
        ratingsUnsubscribe = onSnapshot(
          query(
            collection(db, "menu_ratings"),
            where("messId", "==", nextProfile.messId),
            where("uid", "==", user.uid),
          ),
          (ratingsSnapshot) => {
            const nextRatings: Record<string, number> = {};
            ratingsSnapshot.docs.forEach((ratingSnapshot) => {
              const rating = { id: ratingSnapshot.id, ...ratingSnapshot.data() } as MenuRating;
              nextRatings[`${rating.day}_${rating.mealType}`] = rating.rating;
            });
            setRatings(nextRatings);
          },
        );
      }
    });
    return () => {
      profileUnsubscribe();
      menuUnsubscribe?.();
      ratingsUnsubscribe?.();
    };
  }, []);

  const rateMeal = async (day: WeekDay, mealType: MenuMealType, rating: number) => {
    if (!profile?.messId || !auth.currentUser) return;
    try {
      await submitMenuRating(profile.messId, auth.currentUser.uid, day, mealType, rating);
      setRatings((current) => ({ ...current, [`${day}_${mealType}`]: rating }));
      setRatingMessage("Rating saved.");
    } catch (error) {
      console.error("Unable to save menu rating.", error);
      setRatingMessage("Unable to save rating.");
    }
  };

  return (
    <View style={styles.page}>
      <FlatList
        contentContainerStyle={styles.container}
        data={WEEK_DAYS}
        keyExtractor={(day) => day}
        ListHeaderComponent={
          <View style={styles.mealText}>
            <Text style={styles.eyebrow}>THIS WEEK</Text>
            <Text variant="headlineMedium" style={styles.title}>Weekly menu</Text>
            {profile?.balance !== undefined && profile.balance < 500 && (
              <Text style={styles.lowBalance}>Low balance: ₹{profile.balance}</Text>
            )}
            {!!ratingMessage && <Text style={styles.ratingMessage}>{ratingMessage}</Text>}
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>The weekly menu has not been published.</Text>}
        renderItem={({ item: day }) => (
          <Card style={styles.dayCard}>
            <Card.Content>
              <Text style={styles.dayTitle}>{day}</Text>
              {(["breakfast", "lunch", "dinner"] as MenuMealType[]).map((mealType) => {
                const items = weeklyMenu?.published ? weeklyMenu.days[day]?.[mealType] ?? [] : [];
                const amount = items.reduce((total, item) => total + item.price, 0);
                return (
                  <View key={mealType} style={styles.mealSection}>
                    <View style={styles.mealHeader}>
                      <View style={styles.mealIcon}>
                        <Icon
                          source={mealType === "breakfast" ? "coffee" : mealType === "lunch" ? "food" : "silverware-fork-knife"}
                          size={22}
                          color="#D62828"
                        />
                      </View>
                      <View style={styles.mealText}>
                        <Text style={styles.mealTitle}>{mealType[0].toUpperCase() + mealType.slice(1)}</Text>
                        <Text style={styles.items}>{items.length ? items.map((item) => item.name).join(", ") : "Not published"}</Text>
                        {items.length > 0 && (
                          <View style={styles.foodBadges}>
                            {(["veg", "nonveg"] as const).map((foodType) => {
                              const count = items.filter((item) => (item.foodType ?? "veg") === foodType).length;
                              if (!count) return null;
                              return (
                                <View key={foodType} style={[styles.foodBadge, foodType === "nonveg" && styles.nonVegBadge]}>
                                  <Text style={[styles.foodBadgeText, foodType === "nonveg" && styles.nonVegBadgeText]}>
                                    {foodType === "veg" ? "Veg" : "Non-Veg"} · {count}
                                  </Text>
                                </View>
                              );
                            })}
                          </View>
                        )}
                      </View>
                      <Text style={styles.price}>₹{amount}</Text>
                    </View>
                    {items.length > 0 && (
                      <View style={styles.ratingRow}>
                        <Text style={styles.ratingLabel}>Mark menu</Text>
                        <View style={styles.stars}>
                          {[1, 2, 3, 4, 5].map((rating) => (
                            <IconButton
                              key={rating}
                              icon={(ratings[`${day}_${mealType}`] ?? 0) >= rating ? "star" : "star-outline"}
                              size={18}
                              iconColor="#F77F00"
                              style={styles.starButton}
                              onPress={() => void rateMeal(day, mealType, rating)}
                              accessibilityLabel={`Rate ${rating} out of 5`}
                            />
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </Card.Content>
          </Card>
        )}
      />
      <BottomNavigation navigation={navigation} active="WeeklyMenu" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 8 },
  dayCard: { borderRadius: 18, marginBottom: 12 },
  dayTitle: { color: "#252525", fontSize: 18, fontWeight: "900" },
  empty: { color: "#777777", marginTop: 30, textAlign: "center" },
  eyebrow: { color: "#D62828", fontSize: 12, fontWeight: "900", letterSpacing: 1.2 },
  foodBadge: { backgroundColor: "#E8F5E9", borderRadius: 8, marginRight: 6, paddingHorizontal: 7, paddingVertical: 3 },
  foodBadgeText: { color: "#2E7D32", fontSize: 10, fontWeight: "900" },
  foodBadges: { flexDirection: "row", marginTop: 7 },
  items: { color: "#777777", fontSize: 12, marginTop: 3, maxWidth: 220 },
  lowBalance: { backgroundColor: "#FFF1E6", borderRadius: 10, color: "#D62828", fontWeight: "800", marginTop: 10, padding: 10 },
  mealActions: { alignItems: "flex-end", gap: 4 },
  mealHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  mealIcon: { alignItems: "center", backgroundColor: "#FFF1E6", borderRadius: 12, height: 44, justifyContent: "center", marginRight: 10, width: 44 },
  mealText: { flex: 1 },
  mealSection: { borderTopColor: "#F2E7DF", borderTopWidth: 1, marginTop: 10, paddingTop: 10 },
  mealTitle: { color: "#252525", fontWeight: "900", textTransform: "capitalize" },
  message: { color: "#D62828", marginTop: 8 },
  nonVegBadge: { backgroundColor: "#FFF1E6" },
  nonVegBadgeText: { color: "#D62828" },
  page: { backgroundColor: "#FFF8F3", flex: 1 },
  price: { color: "#D62828", fontWeight: "900" },
  ratingLabel: { color: "#777777", fontSize: 12, fontWeight: "800" },
  ratingMessage: { color: "#2E7D32", fontSize: 12, fontWeight: "800", marginTop: 8 },
  ratingRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  selectedChip: { backgroundColor: "#D62828" },
  selectedText: { color: "#FFFFFF", fontWeight: "900" },
  starButton: { height: 28, margin: 0, width: 28 },
  stars: { flexDirection: "row" },
  title: { color: "#252525", fontWeight: "900", marginTop: 3 },
  unselectedChip: { borderColor: "#F77F00" },
  unselectedText: { color: "#F77F00", fontWeight: "800" },
});
