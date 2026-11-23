import mongoose from "mongoose";
import Car from "../models/Car.js";
import { nextSequence } from "../models/Counter.js";
import { AppError, asyncHandler, containsFilter } from "../utils/helpers.js";

const { trusted } = mongoose;

function buildFilter(q, { includeInactive = false } = {}) {
  const filter = {};
  if (!includeInactive) filter.isActive = true;
  if (q.category) filter.category = q.category;
  if (q.fuel) filter.fuel = q.fuel;
  if (q.maxPrice != null) filter.price = trusted({ $lte: q.maxPrice });
  if (q.search) filter.name = containsFilter(q.search);
  return filter;
}

export const listCars = asyncHandler(async (req, res) => {
  const cars = await Car.find(buildFilter(req.query)).sort({ id: 1 });
  res.set("Cache-Control", "public, max-age=30");
  res.json({ cars });
});

export const listAllCarsAdmin = asyncHandler(async (req, res) => {
  const cars = await Car.find(buildFilter(req.query, { includeInactive: true })).sort({ id: 1 });
  res.json({ cars });
});

export const getCar = asyncHandler(async (req, res) => {
  const car = await Car.findOne({ id: req.params.id, isActive: true });
  if (!car) throw new AppError(404, "Vehicle not found");
  res.json({ car });
});

export const createCar = asyncHandler(async (req, res) => {
  const car = await Car.create({ ...req.body, id: await nextSequence("car") });
  res.status(201).json({ car });
});

export const updateCar = asyncHandler(async (req, res) => {
  const car = await Car.findOne({ id: req.params.id });
  if (!car) throw new AppError(404, "Vehicle not found");
  car.set(req.body);
  await car.save();
  res.json({ car });
});

export const deleteCar = asyncHandler(async (req, res) => {
  const car = await Car.findOneAndDelete({ id: req.params.id });
  if (!car) throw new AppError(404, "Vehicle not found");
  res.json({ message: "Vehicle deleted" });
});
