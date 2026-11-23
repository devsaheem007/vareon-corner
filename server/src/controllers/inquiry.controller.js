import Car from "../models/Car.js";
import Inquiry from "../models/Inquiry.js";
import { AppError, asyncHandler, containsFilter } from "../utils/helpers.js";
import { notifyAdmins, notifyUser } from "../utils/notify.js";

/** Standard amortised monthly payment (same formula as the on-page finance calculator). */
export function monthlyPayment(price, down, ratePct, years) {
  const principal = Math.max(0, price - down);
  const n = years * 12;
  const r = ratePct / 100 / 12;
  if (principal === 0) return 0;
  const m = r === 0 ? principal / n : (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return Math.round(m);
}

export const createInquiry = asyncHandler(async (req, res) => {
  const { type, name, email, phone, message, carId, finance } = req.body;
  const doc = { type, name, email, phone: phone || "", message: message || "", user: req.user?._id };

  if (carId != null) {
    const car = await Car.findOne({ id: carId, isActive: true });
    if (!car) throw new AppError(404, "Vehicle not found");
    doc.carId = car.id;
    doc.carName = car.name;
    if (finance) {
      // Never trust a client supplied price or payment: recompute from the stored vehicle price.
      const down = Math.min(finance.down, Math.round(car.price * 0.7));
      doc.finance = {
        price: car.price,
        down,
        rate: finance.rate,
        years: finance.years,
        monthly: monthlyPayment(car.price, down, finance.rate, finance.years),
      };
    }
  } else if (type === "finance") {
    throw new AppError(400, "A vehicle is required for a finance quote");
  }

  const inquiry = await Inquiry.create(doc);
  const isFinance = type === "finance";
  const f = doc.finance;
  await notifyAdmins({
    type: "inquiry",
    title: isFinance ? `Finance quote request: ${doc.carName}` : "New inquiry",
    body: `${name}${f ? ` · $${f.monthly.toLocaleString()}/mo` : ""}${doc.carName && !isFinance ? ` · ${doc.carName}` : ""}`,
    link: "/admin#inquiries",
    mail: {
      lines: [["Name", name], ["Email", email], ["Phone", doc.phone || "-"], ...(doc.carName ? [["Vehicle", doc.carName]] : []), ...(f ? [["Estimate", `$${f.monthly.toLocaleString()}/mo · $${f.down.toLocaleString()} down · ${f.rate}% · ${f.years} years`]] : []), ["Message", doc.message || "-"]],
      linkLabel: "Open inquiries",
    },
  });
  if (req.user) {
    await notifyUser(req.user, {
      type: "inquiry",
      title: isFinance ? "Finance quote requested" : "We received your message",
      body: doc.carName || "Our team will be in touch shortly",
      link: "account:requests",
      mail: { lines: [["Request", isFinance ? "Finance quote" : "Inquiry"], ...(doc.carName ? [["Vehicle", doc.carName]] : []), ...(f ? [["Estimate", `$${f.monthly.toLocaleString()}/mo`]] : [])] },
    });
  }
  res.status(201).json({ message: "Thank you - our team will be in touch shortly", id: inquiry.id });
});

export const myInquiries = asyncHandler(async (req, res) => {
  res.json({ inquiries: await Inquiry.find({ user: req.user._id }).sort({ createdAt: -1 }) });
});

export const listInquiries = asyncHandler(async (req, res) => {
  const { status, type, search, page, limit } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (type) filter.type = type;
  if (search) {
    const rx = containsFilter(search);
    filter.$or = [{ name: rx }, { email: rx }, { carName: rx }];
  }
  const [items, total] = await Promise.all([
    Inquiry.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Inquiry.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

export const updateInquiry = asyncHandler(async (req, res) => {
  const inquiry = await Inquiry.findById(req.params.id);
  if (!inquiry) throw new AppError(404, "Inquiry not found");
  const changed = inquiry.status !== req.body.status;
  inquiry.status = req.body.status;
  await inquiry.save();
  if (changed && inquiry.user) {
    await notifyUser(inquiry.user, {
      type: "inquiry",
      title: `Your request is now ${inquiry.status}`,
      body: inquiry.carName || "",
      link: "account:requests",
    });
  }
  res.json({ inquiry });
});

export const deleteInquiry = asyncHandler(async (req, res) => {
  const inquiry = await Inquiry.findByIdAndDelete(req.params.id);
  if (!inquiry) throw new AppError(404, "Inquiry not found");
  res.json({ message: "Inquiry deleted" });
});
