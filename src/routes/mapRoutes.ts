import { Router } from "express";
import {
  geocode,
  reverseGeocodeHandler,
  route,
} from "../controllers/mapController";
import { authenticate } from "../middleware/auth";

const router = Router();

router.use(authenticate);

router.post("/geocode", geocode);
router.post("/reverse-geocode", reverseGeocodeHandler);
router.post("/route", route);

export default router;
