import { Registration } from "../models/Registration.js";

export async function listRegistrations(req, res) {
  const q = String(req.query.q || "").trim();
  const filter = q
    ? {
        $or: [
          { name: { $regex: q, $options: "i" } },
          { email: { $regex: q, $options: "i" } },
          { dealership: { $regex: q, $options: "i" } },
        ],
      }
    : {};

  const rows = await Registration.find(filter).sort({ createdAt: -1 }).lean();
  return res.json({
    registrations: rows.map((item) => ({
      id: item._id,
      name: item.name,
      email: item.email,
      phone: item.phone,
      dealership: item.dealership,
      plan: item.plan,
      status: item.status,
      paymentStatus: item.paymentStatus,
      monthlyFee: item.monthlyFee,
      createdAt: item.createdAt,
    })),
  });
}

export async function getRegistration(req, res) {
  const row = await Registration.findById(req.params.id).lean();
  if (!row) return res.status(404).json({ message: "Registration not found." });
  return res.json({ registration: row });
}
