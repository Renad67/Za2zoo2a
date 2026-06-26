import { User } from "../models/User";

/**
 * Firebase Cloud Messaging (FCM) push notification service.
 *
 * PLACEHOLDER: In production, initialize Firebase Admin SDK here:
 *
 *   import admin from "firebase-admin";
 *   admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
 *
 * For now, this logs the notification and returns.
 * Replace the body of sendPushNotification() with actual Firebase Admin calls
 * once you have the service account key configured.
 */

export const sendPushNotification = async (
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> => {
  try {
    const user = await User.findById(userId).select("pushToken");

    if (!user?.pushToken) {
      // No push token registered — skip silently
      return;
    }

    // ── Production implementation ──────────────────────────────────
    // const message: admin.messaging.Message = {
    //   token: user.pushToken,
    //   notification: { title, body },
    //   data: data ? Object.fromEntries(
    //     Object.entries(data).map(([k, v]) => [k, String(v)])
    //   ) : undefined,
    //   android: {
    //     priority: "high",
    //     notification: { sound: "default", channelId: "voltride_trips" },
    //   },
    //   apns: {
    //     payload: { aps: { sound: "default", badge: 1 } },
    //   },
    // };
    // await admin.messaging().send(message);

    // ── Placeholder log ───────────────────────────────────────────
    console.log(
      `📱  [FCM PLACEHOLDER] Push to user=${userId} token=${user.pushToken.substring(0, 20)}...`,
    );
    console.log(`    Title: ${title}`);
    console.log(`    Body:  ${body}`);
    if (data) console.log(`    Data:`, JSON.stringify(data));
  } catch (err) {
    console.error(`FCM send error for user=${userId}:`, err);
  }
};
