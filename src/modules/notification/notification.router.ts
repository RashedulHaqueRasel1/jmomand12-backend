import { Router } from "express";
import { getAllNotifications, markAllAsRead } from "./notification.controller";
import auth from "../../middleware/auth";

const router = Router();

router.get("/", auth("admin"), getAllNotifications);
router.patch("/read/all", markAllAsRead);

const notificationRouter = router;
export default notificationRouter;
