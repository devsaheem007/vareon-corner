import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } }, { versionKey: false });
const Counter = mongoose.model("Counter", counterSchema);

/** Atomic, race-free auto-increment used for the public numeric car id. */
export async function nextSequence(name) {
  const doc = await Counter.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return doc.seq;
}

export async function ensureSequenceAtLeast(name, value) {
  await Counter.updateOne({ _id: name }, { $max: { seq: value } }, { upsert: true });
}

export default Counter;
