const admin = require("firebase-admin");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");

admin.initializeApp();

const appId = "gokhan-makina-v1";
const appUrl = "https://gokhankey.github.io/Gokhan_makina-/";

exports.sendTaskNotifications = onDocumentWritten(
  "artifacts/gokhan-makina-v1/public/data/backups/main",
  async (event) => {
    const beforeState = event.data?.before?.data()?.state || {};
    const afterState = event.data?.after?.data()?.state || {};
    const beforeTasks = Array.isArray(beforeState.tasks) ? beforeState.tasks : [];
    const afterTasks = Array.isArray(afterState.tasks) ? afterState.tasks : [];

    const beforeOpenIds = new Set(
      beforeTasks
        .filter((task) => task.status === "open")
        .map((task) => task.id)
    );

    const newOpenTasks = afterTasks.filter((task) => {
      return task.status === "open" && task.id && task.pId && !beforeOpenIds.has(task.id);
    });

    if (!newOpenTasks.length) return;

    const db = admin.firestore();
    const tokenCollection = db
      .collection("artifacts")
      .doc(appId)
      .collection("public")
      .doc("data")
      .collection("pushTokens");

    for (const task of newOpenTasks) {
      const tokenSnapshot = await tokenCollection.where("pId", "==", task.pId).get();
      const tokenDocs = tokenSnapshot.docs.filter((doc) => doc.data().token);
      const tokens = tokenDocs.map((doc) => doc.data().token);

      if (!tokens.length) continue;

      const response = await admin.messaging().sendEachForMulticast({
        tokens,
        notification: {
          title: "Yeni servis görevi",
          body: `${task.customer || "Müşteri"} - ${task.detail || "Servis detayı"}`
        },
        data: {
          taskId: String(task.id),
          url: appUrl
        },
        webpush: {
          fcmOptions: {
            link: appUrl
          }
        }
      });

      const removals = [];
      response.responses.forEach((result, index) => {
        const code = result.error?.code || "";
        if (
          code.includes("registration-token-not-registered") ||
          code.includes("invalid-registration-token")
        ) {
          removals.push(tokenDocs[index].ref.delete());
        }
      });

      await Promise.all(removals);
    }
  }
);
