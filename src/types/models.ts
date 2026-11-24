import type { Timestamp } from "firebase/firestore";
import type { UserRole } from "./navigation";

export type UserProfile = {
  name: string;
  rollNumber: string;
  email: string;
  role: UserRole;
  balance: number;
  messId?: string;
  studentMessId?: string | null;
  messName?: string;
};

export type DailyMenu = {
  breakfast: string;
  lunch: string;
  dinner: string;
  updatedAt?: Timestamp;
};

export type MealType = keyof Pick<DailyMenu, "breakfast" | "lunch" | "dinner">;

export type MealLog = {
  id: string;
  uid: string;
  studentName?: string;
  mealType: MealType;
  amount: number;
  timestamp?: Timestamp;
};

export type WeekDay = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
export type MenuMealType = "breakfast" | "lunch" | "dinner";
export type FoodType = "veg" | "nonveg";

export type MenuItem = {
  name: string;
  price: number;
  foodType: FoodType;
};

export type DayMenu = Record<MenuMealType, MenuItem[]>;
export type WeeklyMenu = {
  messId: string;
  days: Record<WeekDay, DayMenu>;
  published: boolean;
  updatedAt?: Timestamp;
  updatedBy?: string;
};

export type MenuRating = {
  id: string;
  messId: string;
  uid: string;
  day: WeekDay;
  mealType: MenuMealType;
  rating: number;
  updatedAt?: Timestamp;
};

export type MealBooking = {
  id: string;
  messId: string;
  uid: string;
  studentName: string;
  rollNumber: string;
  date: string;
  mealType: MenuMealType;
  amount: number;
  foodType: FoodType;
  status: "booked" | "consumed" | "cancelled";
  createdAt?: Timestamp;
  consumedAt?: Timestamp;
};

export type BalanceTransaction = {
  id: string;
  messId: string;
  uid: string;
  type: "topup" | "deduction";
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt?: Timestamp;
  bookingId?: string;
};
