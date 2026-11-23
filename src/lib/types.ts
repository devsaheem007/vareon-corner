export type Category = "All" | "Supercars" | "SUVs" | "Electric" | "Luxury Sedans";
export type Fuel = "All" | "EV" | "Hybrid" | "Petrol";

export type Car = {
  id: number;
  name: string;
  category: Exclude<Category, "All">;
  fuel: Exclude<Fuel, "All">;
  price: number;
  hp: number;
  zero: number;
  top: number;
  transmission: string;
  image: string;
  colors: { name: string; accent: string; image: string }[];
};

export type SiteSettings = {
  businessName: string;
  social: { instagram: string; facebook: string; youtube: string; tiktok: string; x: string; linkedin: string };
  whatsapp: string;
  whatsappUrl: string;
  contact: { phone: string; email: string; address: string };
  locations: string[];
  googleClientId?: string;
};
