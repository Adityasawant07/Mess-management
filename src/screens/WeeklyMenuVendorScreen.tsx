import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { collection, doc, onSnapshot, query, setDoc, where } from "firebase/firestore";
import { Button, Card, IconButton, SegmentedButtons, Text, TextInput } from "react-native-paper";
import { auth, db } from "../firebaseConfig";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { DayMenu, FoodType, MenuMealType, MenuItem, MenuRating, UserProfile, WeekDay, WeeklyMenu } from "../types/models";
import type { VendorStackParamList } from "../types/navigation";
import { createEmptyWeeklyMenu, publishWeeklyMenu, WEEK_DAYS } from "../services/messService";

type Props = NativeStackScreenProps<VendorStackParamList, "WeeklyMenuManagement">;

export default function WeeklyMenuVendorScreen({ navigation }: Props): ReactElement {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [weeklyMenu, setWeeklyMenu] = useState<WeeklyMenu | null>(null);
  const [editing, setEditing] = useState<{ day: WeekDay; mealType: MenuMealType; index: number | null } | null>(null);
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemFoodType, setItemFoodType] = useState<FoodType>("veg");
  const [message, setMessage] = useState("");
  const [ratingStats, setRatingStats] = useState<Record<string, { average: number; count: number }>>({});

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return undefined;
    setProfile({
      name: "Vendor",
      rollNumber: "",
      email: "",
      role: "vendor",
      balance: 0,
      messId: user.uid,
    });
    let menuUnsubscribe: (() => void) | undefined;
    let ratingsUnsubscribe: (() => void) | undefined;
    const profileUnsubscribe = onSnapshot(doc(db, "users", user.uid), (snapshot) => {
      const data = snapshot.exists() ? snapshot.data() as UserProfile : {
        name: "Vendor", rollNumber: "", email: "", role: "vendor", balance: 0,
      } as UserProfile;
      const nextProfile = { ...data, role: data.role ?? "vendor", messId: data.messId || user.uid };
      setProfile(nextProfile);
      if (!data.messId) {
        void setDoc(doc(db, "users", user.uid), { messId: user.uid, role: "vendor" }, { merge: true }).catch((error) =>
          console.error("Unable to configure vendor mess profile.", error),
        );
      }
      menuUnsubscribe?.();
      ratingsUnsubscribe?.();
      if (nextProfile.messId) {
        menuUnsubscribe = onSnapshot(doc(db, "weekly_menus", nextProfile.messId), (menuSnapshot) => {
          setWeeklyMenu(menuSnapshot.exists()
            ? menuSnapshot.data() as WeeklyMenu
            : createEmptyWeeklyMenu(nextProfile.messId!));
        });
        ratingsUnsubscribe = onSnapshot(
          query(collection(db, "menu_ratings"), where("messId", "==", nextProfile.messId)),
          (ratingsSnapshot) => {
            const totals: Record<string, { total: number; count: number }> = {};
            ratingsSnapshot.docs.forEach((ratingSnapshot) => {
              const rating = { id: ratingSnapshot.id, ...ratingSnapshot.data() } as MenuRating;
              const key = `${rating.day}_${rating.mealType}`;
              totals[key] ??= { total: 0, count: 0 };
              totals[key].total += rating.rating;
              totals[key].count += 1;
            });
            setRatingStats(Object.fromEntries(
              Object.entries(totals).map(([key, value]) => [
                key,
                { average: value.total / value.count, count: value.count },
              ]),
            ));
          },
        );
      }
    });
    return () => { profileUnsubscribe(); menuUnsubscribe?.(); ratingsUnsubscribe?.(); };
  }, []);

  const menu = weeklyMenu ?? (profile?.messId ? createEmptyWeeklyMenu(profile.messId) : null);

  const startAdd = (day: WeekDay, mealType: MenuMealType) => {
    setEditing({ day, mealType, index: null });
    setItemName("");
    setItemPrice("");
    setItemFoodType("veg");
  };

  const startEdit = (day: WeekDay, mealType: MenuMealType, index: number) => {
    const item = menu?.days[day][mealType][index];
    if (!item) return;
    setEditing({ day, mealType, index });
    setItemName(item.name);
    setItemPrice(String(item.price));
    setItemFoodType(item.foodType ?? "veg");
  };

  const saveItem = () => {
    if (!editing || !menu || !itemName.trim() || !itemPrice.trim()) return;
    const price = Number(itemPrice);
    if (!Number.isFinite(price) || price < 0) return;
    const nextDays = JSON.parse(JSON.stringify(menu.days)) as Record<WeekDay, DayMenu>;
    const items = nextDays[editing.day][editing.mealType];
    const nextItem: MenuItem = { name: itemName.trim(), price, foodType: itemFoodType };
    if (editing.index === null) items.push(nextItem);
    else items[editing.index] = nextItem;
    setWeeklyMenu({ ...menu, days: nextDays });
    setEditing(null);
  };

  const removeItem = (day: WeekDay, mealType: MenuMealType, index: number) => {
    if (!menu) return;
    const nextDays = JSON.parse(JSON.stringify(menu.days)) as Record<WeekDay, DayMenu>;
    nextDays[day][mealType].splice(index, 1);
    setWeeklyMenu({ ...menu, days: nextDays });
  };

  const publish = async () => {
    if (!profile?.messId || !menu) return;
    try {
      const messId = profile.messId;
      await setDoc(doc(db, "users", auth.currentUser!.uid), {
        messId,
        role: "vendor",
      }, { merge: true });
      await publishWeeklyMenu(messId, menu.days, auth.currentUser!.uid);
      setMessage("Weekly menu published.");
    } catch (error) {
      console.error("Unable to publish weekly menu.", error);
      setMessage("Unable to publish the menu.");
    }
  };

  if (!profile?.messId) return <View style={styles.page}><Text style={styles.empty}>Vendor mess profile is not configured.</Text></View>;

  return (
    <View style={styles.page}>
      <FlatList
        contentContainerStyle={styles.container}
        data={WEEK_DAYS}
        keyExtractor={(day) => day}
        ListHeaderComponent={
          <View>
            <Text style={styles.eyebrow}>WEEKLY MENU</Text>
            <Text variant="headlineMedium" style={styles.title}>Plan the week</Text>
            <Text style={styles.subtitle}>Changes remain draft until published.</Text>
            {editing && (
              <Card style={styles.editorCard}>
                <Card.Content>
                  <Text style={styles.editorTitle}>{editing.index === null ? "Add" : "Edit"} {editing.mealType} - {editing.day}</Text>
                  <TextInput label="Food item" value={itemName} onChangeText={setItemName} mode="outlined" style={styles.input} />
                  <TextInput label="Price (₹)" value={itemPrice} onChangeText={setItemPrice} mode="outlined" keyboardType="numeric" style={styles.input} />
                  <SegmentedButtons
                    value={itemFoodType}
                    onValueChange={(value) => setItemFoodType(value as FoodType)}
                    buttons={[
                      { label: "Veg", value: "veg", icon: "leaf" },
                      { label: "Non-Veg", value: "nonveg", icon: "silverware-fork-knife" },
                    ]}
                    style={styles.foodTypeButtons}
                  />
                  <View style={styles.editorActions}>
                    <Button onPress={() => setEditing(null)}>Cancel</Button>
                    <Button mode="contained" onPress={saveItem}>Save item</Button>
                  </View>
                </Card.Content>
              </Card>
            )}
          </View>
        }
        renderItem={({ item: day }) => (
          <Card style={styles.dayCard}>
            <Card.Content>
              <Text style={styles.dayTitle}>{day}</Text>
              {(["breakfast", "lunch", "dinner"] as MenuMealType[]).map((mealType) => (
                <View key={mealType} style={styles.mealSection}>
                  <View style={styles.mealHeader}>
                    <Text style={styles.mealTitle}>{mealType[0].toUpperCase() + mealType.slice(1)}</Text>
                    <View style={styles.mealHeaderActions}>
                      {ratingStats[`${day}_${mealType}`] ? (
                        <Text style={styles.ratingSummary}>
                          ★ {ratingStats[`${day}_${mealType}`].average.toFixed(1)} ({ratingStats[`${day}_${mealType}`].count})
                        </Text>
                      ) : (
                        <Text style={styles.ratingSummaryEmpty}>No ratings</Text>
                      )}
                      <IconButton icon="plus" size={18} iconColor="#D62828" onPress={() => startAdd(day, mealType)} />
                    </View>
                  </View>
                  {menu?.days[day][mealType].map((item, index) => (
                    <View key={`${item.name}-${index}`} style={styles.itemRow}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <View style={[styles.foodBadge, item.foodType === "nonveg" && styles.nonVegBadge]}>
                        <Text style={[styles.foodBadgeText, item.foodType === "nonveg" && styles.nonVegBadgeText]}>
                          {item.foodType === "nonveg" ? "Non-Veg" : "Veg"}
                        </Text>
                      </View>
                      <Text style={styles.itemPrice}>₹{item.price}</Text>
                      <IconButton icon="pencil-outline" size={18} onPress={() => startEdit(day, mealType, index)} />
                      <IconButton icon="delete-outline" size={18} iconColor="#D62828" onPress={() => removeItem(day, mealType, index)} />
                    </View>
                  ))}
                  {!menu?.days[day][mealType].length && <Text style={styles.noItems}>No items</Text>}
                </View>
              ))}
            </Card.Content>
          </Card>
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            <Text style={message.includes("Unable") ? styles.error : styles.success}>{message}</Text>
            <Button mode="contained" icon="publish" onPress={() => void publish()} contentStyle={styles.publishContent}>Publish Weekly Menu</Button>
          </View>
        }
      />
      <Button icon="arrow-left" onPress={() => navigation.goBack()} style={styles.back}>Back</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { marginHorizontal: 18, marginBottom: 8 },
  container: { padding: 18, paddingBottom: 8 },
  dayCard: { borderRadius: 18, marginBottom: 12 },
  dayTitle: { color: "#252525", fontSize: 18, fontWeight: "900" },
  editorActions: { flexDirection: "row", justifyContent: "flex-end" },
  editorCard: { borderColor: "#F77F00", borderRadius: 18, borderWidth: 1, marginBottom: 12 },
  editorTitle: { color: "#252525", fontWeight: "900", marginBottom: 8, textTransform: "capitalize" },
  empty: { color: "#777777", padding: 24, textAlign: "center" },
  error: { color: "#D62828", marginBottom: 8, textAlign: "center" },
  eyebrow: { color: "#D62828", fontSize: 12, fontWeight: "900", letterSpacing: 1.2 },
  footer: { paddingBottom: 8, paddingTop: 4 },
  foodBadge: { backgroundColor: "#E8F5E9", borderRadius: 8, marginRight: 4, paddingHorizontal: 7, paddingVertical: 4 },
  foodBadgeText: { color: "#2E7D32", fontSize: 10, fontWeight: "900" },
  foodTypeButtons: { marginBottom: 10 },
  input: { backgroundColor: "#FFFFFF", marginBottom: 8 },
  itemName: { color: "#252525", flex: 1, fontWeight: "700" },
  itemPrice: { color: "#D62828", fontWeight: "900", width: 68 },
  itemRow: { alignItems: "center", flexDirection: "row" },
  mealHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  mealHeaderActions: { alignItems: "center", flexDirection: "row" },
  mealSection: { borderTopColor: "#F2E7DF", borderTopWidth: 1, marginTop: 10, paddingTop: 4 },
  mealTitle: { color: "#777777", fontWeight: "800", textTransform: "capitalize" },
  noItems: { color: "#999999", fontSize: 12, paddingBottom: 8 },
  nonVegBadge: { backgroundColor: "#FFF1E6" },
  nonVegBadgeText: { color: "#D62828" },
  page: { backgroundColor: "#FFF8F3", flex: 1 },
  publishContent: { height: 52 },
  ratingSummary: { color: "#F77F00", fontSize: 12, fontWeight: "900" },
  ratingSummaryEmpty: { color: "#999999", fontSize: 11 },
  subtitle: { color: "#777777", marginBottom: 12, marginTop: 4 },
  success: { color: "#2E7D32", marginBottom: 8, textAlign: "center" },
  title: { color: "#252525", fontWeight: "900", marginTop: 3 },
});
