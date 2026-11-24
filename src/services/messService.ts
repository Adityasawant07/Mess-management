import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import type {
  DayMenu,
  FoodType,
  MenuMealType,
  MealBooking,
  UserProfile,
  WeekDay,
  WeeklyMenu,
} from "../types/models";

export const WEEK_DAYS: WeekDay[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const createEmptyDayMenu = (): DayMenu => ({
  breakfast: [],
  lunch: [],
  dinner: [],
});

export const createEmptyWeeklyMenu = (messId: string): WeeklyMenu => ({
  messId,
  published: false,
  days: Object.fromEntries(WEEK_DAYS.map((day) => [day, createEmptyDayMenu()])) as Record<WeekDay, DayMenu>,
});

export const getDateForWeekDay = (day: WeekDay): string => {
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const now = new Date();
  const target = names.indexOf(day);
  const current = now.getDay();
  const difference = (target - current + 7) % 7;
  const date = new Date(now);
  date.setDate(now.getDate() + difference);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const dayOfMonth = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${dayOfMonth}`;
};

export const getTodayDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getWeekMealSlots = (): Array<{ date: string; day: WeekDay; mealType: "breakfast" | "lunch" | "dinner" }> => {
  const names: WeekDay[] = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const mealTypes: Array<"breakfast" | "lunch" | "dinner"> = ["breakfast", "lunch", "dinner"];
  const now = new Date();
  const slots: Array<{ date: string; day: WeekDay; mealType: "breakfast" | "lunch" | "dinner" }> = [];

  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() + dayOffset);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const dateText = `${year}-${month}-${day}`;
    for (const mealType of mealTypes) {
      slots.push({ date: dateText, day: names[date.getDay()], mealType });
    }
  }
  return slots;
};

export const getNextMealSlots = (): Array<{ date: string; day: WeekDay; mealType: "breakfast" | "lunch" | "dinner" }> => {
  const mealTimes = [
    { mealType: "breakfast" as const, hour: 7, minute: 30 },
    { mealType: "lunch" as const, hour: 12, minute: 30 },
    { mealType: "dinner" as const, hour: 19, minute: 30 },
  ];
  const names: WeekDay[] = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const now = new Date();

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  let slotIndex = mealTimes.findIndex((meal) => {
    const mealTime = new Date(now);
    mealTime.setHours(meal.hour, meal.minute, 0, 0);
    return now <= mealTime;
  });
  let dayOffset = 0;
  if (slotIndex === -1) {
    slotIndex = 0;
    dayOffset = 1;
  }
  const slots: Array<{ date: string; day: WeekDay; mealType: "breakfast" | "lunch" | "dinner" }> = [];

  for (let mealOffset = 0; mealOffset < 2; mealOffset += 1) {
    let index = slotIndex + mealOffset;
    let slotDayOffset = dayOffset;
    if (index >= mealTimes.length) {
      index -= mealTimes.length;
      slotDayOffset += 1;
    }

    const date = new Date(now);
    date.setDate(now.getDate() + slotDayOffset);
    slots.push({
      date: formatDate(date),
      day: names[date.getDay()],
      mealType: mealTimes[index].mealType,
    });
  }

  return slots;
};

export const publishWeeklyMenu = async (
  messId: string,
  days: Record<WeekDay, DayMenu>,
  vendorUid: string,
): Promise<void> => {
  await setDoc(doc(db, "weekly_menus", messId), {
    messId,
    days,
    published: true,
    updatedAt: serverTimestamp(),
    updatedBy: vendorUid,
  }, { merge: true });
};

export const submitMenuRating = async (
  messId: string,
  uid: string,
  day: WeekDay,
  mealType: MenuMealType,
  rating: number,
): Promise<void> => {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("INVALID_RATING");
  }
  await setDoc(doc(db, "menu_ratings", `${messId}_${uid}_${day}_${mealType}`), {
    messId,
    uid,
    day,
    mealType,
    rating,
    updatedAt: serverTimestamp(),
  }, { merge: true });
};

export const toggleMealBooking = async (
  profile: UserProfile,
  uid: string,
  date: string,
  mealType: MenuMealType,
  amount: number,
  foodType: FoodType = "veg",
  existing?: MealBooking,
): Promise<boolean> => {
  if (!profile.messId) throw new Error("MESS_NOT_ASSIGNED");
  if (!Number.isFinite(amount) || amount < 0) throw new Error("INVALID_MENU_PRICE");
  const bookingReference = doc(db, "meal_bookings", `${uid}_${date}_${mealType}`);
  const menuReference = doc(db, "weekly_menus", profile.messId);
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const bookingDay = names[new Date(`${date}T12:00:00`).getDay()] as WeekDay;

  const menuSnapshot = await getDoc(menuReference);
  if (!menuSnapshot.exists()) throw new Error("MENU_NOT_PUBLISHED");
  const menu = menuSnapshot.data() as WeeklyMenu;
  if (!menu.published) throw new Error("MENU_NOT_PUBLISHED");

  const items = menu.days?.[bookingDay]?.[mealType] ?? [];
  const matchingItems = items.filter((item) => (item.foodType ?? "veg") === foodType);
  if (!matchingItems.length) throw new Error("NO_MENU_ITEMS");
  const currentAmount = matchingItems.reduce((sum, item) => sum + item.price, 0);
  if (!Number.isFinite(currentAmount) || currentAmount < 0) throw new Error("INVALID_MENU_PRICE");

  if (existing) {
    throw new Error(existing.status === "consumed" ? "MEAL_ALREADY_CONSUMED" : "MEAL_ALREADY_MARKED");
  }

  await runTransaction(db, async (transaction) => {
    const studentReference = doc(db, "users", uid);
    const studentSnapshot = await transaction.get(studentReference);
    if (!studentSnapshot.exists()) throw new Error("STUDENT_NOT_FOUND");
    const student = studentSnapshot.data() as UserProfile;

    if ((student.balance ?? 0) < currentAmount) throw new Error("INSUFFICIENT_BALANCE");
    transaction.update(studentReference, { balance: (student.balance ?? 0) - currentAmount });
    transaction.set(bookingReference, {
      messId: profile.messId,
      uid,
      studentName: profile.name,
      rollNumber: profile.rollNumber,
      date,
      mealType,
      amount: currentAmount,
      foodType,
      status: "booked",
      createdAt: serverTimestamp(),
    });
    transaction.set(doc(collection(db, "balance_transactions")), {
      messId: profile.messId,
      uid,
      type: "deduction",
      amount: currentAmount,
      balanceAfter: (student.balance ?? 0) - currentAmount,
      description: `${mealType[0].toUpperCase()}${mealType.slice(1)} meal marked`,
      bookingId: bookingReference.id,
      createdAt: serverTimestamp(),
    });
  });
  return true;
};

export const consumeMealBooking = async (
  vendor: UserProfile,
  vendorUid: string,
  bookingId: string,
): Promise<void> => {
  if (vendor.role !== "vendor" || !vendor.messId) throw new Error("UNAUTHORIZED");
  const bookingReference = doc(db, "meal_bookings", bookingId);

  await runTransaction(db, async (transaction) => {
    const bookingSnapshot = await transaction.get(bookingReference);
    if (!bookingSnapshot.exists()) throw new Error("BOOKING_NOT_FOUND");
    const booking = bookingSnapshot.data();
    if (booking.messId !== vendor.messId) throw new Error("UNAUTHORIZED");
    if (booking.status === "consumed") throw new Error("ALREADY_CONSUMED");
    transaction.update(bookingReference, {
      status: "consumed",
      consumedAt: serverTimestamp(),
      consumedBy: vendorUid,
    });
  });
};

export const addStudentBalance = async (
  vendor: UserProfile,
  studentUid: string,
  amount: number,
): Promise<void> => {
  if (vendor.role !== "vendor" || !vendor.messId) throw new Error("UNAUTHORIZED");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("INVALID_AMOUNT");
  await runTransaction(db, async (transaction) => {
    const studentReference = doc(db, "users", studentUid);
    const snapshot = await transaction.get(studentReference);
    if (!snapshot.exists()) throw new Error("STUDENT_NOT_FOUND");
    const student = snapshot.data() as UserProfile;
    if (student.role !== "student") throw new Error("UNAUTHORIZED");
    const balanceAfter = (student.balance ?? 0) + amount;
    transaction.update(studentReference, { balance: increment(amount) });
    transaction.set(doc(collection(db, "balance_transactions")), {
      messId: vendor.messId,
      uid: studentUid,
      type: "topup",
      amount,
      balanceAfter,
      description: "Balance added by mess vendor",
      createdAt: serverTimestamp(),
    });
  });
};
