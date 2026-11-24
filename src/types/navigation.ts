export type UserRole = "student" | "vendor";

export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Student: undefined;
  Vendor: undefined;
};

export type StudentStackParamList = {
  Dashboard: undefined;
  Booking: undefined;
  WeeklyMenu: undefined;
  History: undefined;
  Profile: undefined;
};

export type VendorStackParamList = {
  VendorHome: undefined;
  WeeklyMenuManagement: undefined;
  StudentManagement: undefined;
};
