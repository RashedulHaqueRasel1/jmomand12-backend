import { Router } from "express";
import { contactController } from "./contact.controller";

const router = Router();

router.post("/send-message", contactController.sendContact);

const contactRouter = router;
export default contactRouter;
