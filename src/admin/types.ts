export type Role = "customer" | "admin";
export type AdminUser = { _id: string; name: string; email: string; role: Role; isActive: boolean; createdAt?: string; lastLoginAt?: string };
export type Paged<T> = { items: T[]; total: number; page: number; pages: number };

export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled";
export type Booking = {
  _id: string; carId: number; carName: string; name: string; email: string; phone: string;
  location: string; date: string; time: string; notes: string; status: BookingStatus; createdAt: string;
};

export type InquiryStatus = "new" | "contacted" | "closed";
export type Inquiry = {
  _id: string; type: "finance" | "general"; name: string; email: string; phone: string; message: string;
  carId?: number; carName?: string; status: InquiryStatus; createdAt: string;
  finance?: { price: number; down: number; rate: number; years: number; monthly: number };
};

export type Subscriber = { _id: string; email: string; source: string; active: boolean; createdAt: string };

export type CarRecord = {
  id: number; name: string; category: string; fuel: string; price: number; hp: number; zero: number; top: number;
  transmission: string; image: string; isActive: boolean;
  colors: { name: string; accent: string; image: string }[];
};

export type Stats = {
  totals: { cars: number; activeCars: number; users: number; subscribers: number; newInquiries: number; upcomingBookings: number };
  bookingsByStatus: Record<string, number>;
  carsByCategory: Record<string, number>;
  recentBookings: Booking[];
  recentInquiries: Inquiry[];
};
