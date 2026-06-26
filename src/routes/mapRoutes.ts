import { Router } from "express";
import {
  geocode,
  reverseGeocodeHandler,
  route,
} from "../controllers/mapController";
import { protect } from "../middleware/auth";

const router = Router();

router.use(protect);

router.post("/geocode", geocode);
router.post("/reverse-geocode", reverseGeocodeHandler);
router.post("/route", route);

export default router;
