import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { Button, Card, Icon, SegmentedButtons, Text } from "react-native-paper";
import { auth, db } from "../firebaseConfig";
import BottomNavigation from "../components/BottomNavigation";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { FoodType, MealBooking, MenuMealType, UserProfile, WeeklyMenu } from "../types/models";
import type { StudentStackParamList } from "../types/navigation";
import { getWeekMealSlots, toggleMealBooking } from "../services/messService";

type Props = NativeStackScreenProps<StudentStackParamList, "Booking">;

export default function BookMealScreen({ navigation }: Props): ReactElement | null {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [weeklyMenu, setWeeklyMenu] = useState<WeeklyMenu | null>(null);
  const [bookings, setBookings] = useState<MealBooking[]>([]);
  const [message, setMessage] = useState("");
  const [submittingKey, setSubmittingKey] = useState("");
  const [foodPreferences, setFoodPreferences] = useState<Record<string, FoodType>>({});
  const [menuLoading, setMenuLoading] = useState(true);
  const slots = getWeekMealSlots();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return undefined;
    let menuUnsubscribe: (() => void) | undefined;
    const profileUnsubscribe = onSnapshot(doc(db, "users", user.uid), (snapshot) => {
      const data = snapshot.data() as UserProfile | undefined;
      if (!data) return;
      const nextProfile = { ...data, messId: data.messId?.trim() };
      setProfile(nextProfile);
      menuUnsubscribe?.();
      if (nextProfile.messId) {
        menuUnsubscribe = onSnapshot(
          doc(db, "weekly_menus", nextProfile.messId),
          (menuSnapshot) => {
            setMenuLoading(false);
            setWeeklyMenu(menuSnapshot.exists() ? menuSnapshot.data() as WeeklyMenu : null);
          },
          (error) => {
            setMenuLoading(false);
            setMessage("Unable to load the weekly menu. Check your Mess ID and connection.");
            console.error("Unable to subscribe to weekly menu.", error);
          },
        );
      } else {
        setMenuLoading(false);
        setMessage("Your Mess ID is not configured. Ask the vendor to share it.");
      }
    });
    const bookingsUnsubscribe = onSnapshot(
      query(collection(db, "meal_bookings"), where("uid", "==", user.uid)),
      (snapshot) => setBookings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as MealBooking)),
    );
    return () => {
      profileUnsubscribe();
      menuUnsubscribe?.();
      bookingsUnsubscribe();
    };
  }, []);

  const selected = (date: string, mealType: MenuMealType) =>
    bookings.some((item) => item.status !== "cancelled" && item.date === date && item.mealType === mealType);

  const getFoodPreference = (key: string, date: string, mealType: MenuMealType): FoodType => {
    const booking = bookings.find((item) => item.date === date && item.mealType === mealType && item.status !== "cancelled");
    return booking?.foodType ?? foodPreferences[key] ?? "veg";
  };

  const toggle = async (date: string, mealType: MenuMealType, amount: number, foodType: FoodType) => {
    const user = auth.currentUser;
    if (!user || !profile) return;
    const key = `${date}_${mealType}`;
    setSubmittingKey(key);
    setMessage("");
    try {
      const existing = bookings.find(
        (item) => item.date === date && item.mealType === mealType && item.status !== "cancelled",
      );
      await toggleMealBooking(profile, user.uid, date, mealType, amount, foodType, existing);
      setMessage("");
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      const messages: Record<string, string> = {
        MESS_NOT_ASSIGNED: "Your Mess ID is not configured. Please contact the vendor.",
        MENU_NOT_PUBLISHED: "The weekly menu has not been published yet.",
        NO_MENU_ITEMS: "No items are published for this food type.",
        MENU_PRICE_CHANGED: "The menu changed. Refresh the page and try again.",
        MEAL_ALREADY_CONSUMED: "This meal has already been consumed.",
        INVALID_MENU_PRICE: "The menu price is invalid.",
        INSUFFICIENT_BALANCE: "You do not have enough wallet balance.",
        STUDENT_NOT_FOUND: "Your student profile could not be found.",
        MEAL_ALREADY_MARKED: "This meal is already marked and cannot be unchecked.",
      };
      setMessage(messages[code] ?? "Unable to update the booking.");
    } finally {
      setSubmittingKey("");
    }
  };

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.eyebrow}>MEAL BOOKINGS</Text>
        <View style={styles.headingRow}>
          <View style={styles.headingIcon}><Icon source="calendar-check" size={26} color="#FFFFFF" /></View>
          <Text variant="headlineMedium" style={styles.title}>Mark your meals</Text>
        </View>
        <Text style={styles.subtitle}>Mark whenever you want to eat in the next seven days.</Text>
        {(profile?.balance ?? 0) <= 500 && (
          <View style={styles.lowBalance}><Icon source="alert-circle-outline" size={18} color="#D62828" /><Text style={styles.lowBalanceText}>Low balance: ₹{profile?.balance ?? 0}</Text></View>
        )}
        {!!message && <Text style={styles.message}>{message}</Text>}
        {menuLoading && <Text style={styles.menuStatus}>Loading the published menu...</Text>}
        {!menuLoading && weeklyMenu && !weeklyMenu.published && (
          <Text style={styles.menuStatus}>The vendor has not published the weekly menu yet.</Text>
        )}

        {slots.map((slot) => {
          const items = weeklyMenu?.published ? weeklyMenu.days[slot.day]?.[slot.mealType] ?? [] : [];
          const key = `${slot.date}_${slot.mealType}`;
          const foodPreference = getFoodPreference(key, slot.date, slot.mealType);
          const matchingItems = items.filter((item) => (item.foodType ?? "veg") === foodPreference);
          const amount = matchingItems.length
            ? matchingItems.reduce((sum, item) => sum + item.price, 0)
            : 0;
          const isSelected = selected(slot.date, slot.mealType);
          const existingBooking = bookings.find(
            (item) => item.date === slot.date && item.mealType === slot.mealType && item.status !== "cancelled",
          );
          const isConsumed = existingBooking?.status === "consumed";
          const mealName = slot.mealType[0].toUpperCase() + slot.mealType.slice(1);
          const canMark = Boolean(profile?.messId && weeklyMenu?.published && matchingItems.length && !isSelected);
          return (
            <Card
              key={key}
              style={[styles.slotCard, isSelected && styles.selectedCard]}
            >
              <Card.Content>
                <View style={styles.slotHeader}>
                  <View style={[
                    styles.mealIcon,
                    isSelected && styles.selectedMealIcon,
                  ]}>
                    <Icon
                      source={slot.mealType === "breakfast" ? "coffee" : slot.mealType === "lunch" ? "food" : "silverware-fork-knife"}
                      size={25}
                      color={isSelected ? "#FFFFFF" : "#D62828"}
                    />
                  </View>
                  <View style={styles.slotText}>
                    <Text style={styles.day}>{slot.day}</Text>
                    <Text style={styles.mealName}>{mealName}</Text>
                    <Text style={styles.items}>{matchingItems.length ? matchingItems.map((item) => item.name).join(", ") : "No matching items published"}</Text>
                  </View>
                  <View style={styles.actions}>
                    <Text style={styles.price}>₹{amount}</Text>
                    <SegmentedButtons
                      value={foodPreference}
                      onValueChange={(value) => setFoodPreferences((current) => ({ ...current, [key]: value as FoodType }))}
                      density="small"
                      buttons={[
                        { label: "Veg", value: "veg", icon: "leaf", disabled: isSelected },
                        { label: "Non-Veg", value: "nonveg", icon: "silverware-fork-knife", disabled: isSelected },
                      ]}
                      style={styles.preferenceButtons}
                    />
                    <Button
                      compact
                      mode={isSelected ? "contained" : "outlined"}
                      buttonColor={isSelected ? "#D62828" : undefined}
                      textColor={isSelected ? "#FFFFFF" : "#F77F00"}
                      icon={isConsumed ? "silverware-fork-knife" : isSelected ? "check-circle" : "checkbox-blank-circle-outline"}
                      loading={submittingKey === key}
                      disabled={!canMark || submittingKey !== ""}
                      onPress={() => void toggle(slot.date, slot.mealType, amount, foodPreference)}
                      style={isSelected ? styles.markedButton : styles.markButton}
                    >
                      {isConsumed ? "Consumed" : isSelected ? "Marked" : "Mark"}
                    </Button>
                  </View>
                </View>
              </Card.Content>
            </Card>
          );
        })}
      </ScrollView>
      <BottomNavigation navigation={navigation} active="Booking" />
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { alignItems: "flex-end", gap: 5 },
  container: { paddingBottom: 12, paddingHorizontal: 18, paddingTop: 20 },
  day: { color: "#777777", fontSize: 12 },
  eyebrow: { color: "#D62828", fontSize: 12, fontWeight: "900", letterSpacing: 1.2 },
  headingIcon: { alignItems: "center", backgroundColor: "#D62828", borderRadius: 16, height: 48, justifyContent: "center", marginRight: 12, width: 48 },
  headingRow: { alignItems: "center", flexDirection: "row", marginBottom: 4, marginTop: 3 },
  items: { color: "#777777", fontSize: 12, marginTop: 5, maxWidth: 230 },
  lowBalance: { alignItems: "center", backgroundColor: "#FFF1E6", borderRadius: 10, flexDirection: "row", marginBottom: 12, padding: 10 },
  lowBalanceText: { color: "#D62828", fontWeight: "800", marginLeft: 7 },
  menuStatus: { color: "#777777", marginBottom: 12, textAlign: "center" },
  mealIcon: { alignItems: "center", backgroundColor: "#FFF1E6", borderRadius: 16, height: 52, justifyContent: "center", marginRight: 12, width: 52 },
  mealName: { color: "#252525", fontSize: 18, fontWeight: "900", marginTop: 2 },
  message: { color: "#D62828", marginBottom: 10 },
  page: { backgroundColor: "#FFF8F3", flex: 1 },
  preferenceButtons: { marginTop: 4, minWidth: 190 },
  price: { color: "#D62828", fontSize: 17, fontWeight: "900" },
  selectedCard: { borderColor: "#D62828", borderWidth: 2 },
  selectedMealIcon: { backgroundColor: "#D62828" },
  markButton: { borderColor: "#F77F00", borderRadius: 12, marginTop: 3 },
  markedButton: { borderRadius: 12, marginTop: 3 },
  slotCard: { borderColor: "transparent", borderRadius: 18, borderWidth: 2, marginBottom: 12 },
  slotHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  slotText: { flex: 1 },
  subtitle: { color: "#777777", marginBottom: 16, marginTop: 5 },
  title: { color: "#252525", fontWeight: "900", marginTop: 3 },
});
