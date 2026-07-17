import pkg from "whatsapp-web.js";
const { Client, LocalAuth, MessageMedia } = pkg;

import qrcode from "qrcode-terminal";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// =================== ثوابت ===================
const ACCOUNTS_FILE = "./accounts.json";
const MESSAGE_FILE = "./message.txt";          // للتوافق القديم
const MESSAGES_FILE = "./message.json";        // الملف الجديد للرسائل المتعددة
const IMAGES_LIST_FILE = "./images.json";      // قائمة الصور
const DASHBOARD_DIR = "./dashboard";
const SESSION_DIR = "./session";
const LOGS_DIR = "./logs";
const CHECKPOINT_FILE = "./checkpoint.json";
const AGGREGATE_FILE = "./aggregate.json";
const ADMIN_NUMBER = "212642284241";

const MAX_RETRIES = 2;
const RETRY_DELAY = 5000;
const MIN_DELAY = 20000;
const MAX_DELAY = 40000;

// وضع اختيار الرسالة: "random" أو "sequential"
const MESSAGE_MODE = "random"; // أو "sequential"

// =================== أدوات مساعدة ===================
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const randomDelay = () => MIN_DELAY + Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY));
const cleanNumber = (raw) => raw.replace(/\D/g, "");

// =================== تهيئة المجلدات ===================
await fs.ensureDir(DASHBOARD_DIR);
await fs.ensureDir(SESSION_DIR);
await fs.ensureDir(LOGS_DIR);

const today = new Date().toISOString().split("T")[0];
const dashboardPath = path.join(DASHBOARD_DIR, `dashboard-${today}.json`);
const logPath = path.join(LOGS_DIR, `${today}.log`);

let dashboard = {
  date: today,
  attempted: 0,
  success: 0,
  failed: 0,
  sent: [],
  failedList: [],
};

if (await fs.pathExists(dashboardPath)) {
  try {
    const loaded = await fs.readJson(dashboardPath);
    dashboard = { ...dashboard, ...loaded };
    if (!Array.isArray(dashboard.sent)) dashboard.sent = [];
    if (!Array.isArray(dashboard.failedList)) dashboard.failedList = [];
    console.log(`📂 تم تحميل dashboard اليومي (${dashboard.success} نجاح، ${dashboard.failed} فشل)`);
  } catch (err) {
    console.warn(`⚠️ فشل تحميل dashboard: ${err.message}`);
  }
}

// =================== إعداد الـ Logger ===================
const logStream = fs.createWriteStream(logPath, { flags: "a" });
function logMessage(msg) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}`;
  console.log(msg);
  logStream.write(line + "\n");
}

logMessage("🚀 بدء تشغيل السكربت");

// =================== إدارة نقطة التوقف ===================
let checkpoint = { lastIndex: 0 };
if (await fs.pathExists(CHECKPOINT_FILE)) {
  try {
    checkpoint = await fs.readJson(CHECKPOINT_FILE);
    if (typeof checkpoint.lastIndex !== "number") checkpoint.lastIndex = 0;
  } catch {
    checkpoint.lastIndex = 0;
  }
}
logMessage(`📌 نقطة التوقف الحالية: الفهرس ${checkpoint.lastIndex}`);

// =================== إنشاء عميل واتساب ===================
const client = new Client({
  authStrategy: new LocalAuth({
    clientId: "main",
    dataPath: SESSION_DIR,
  }),
  puppeteer: {
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true,
  },
});

client.on("qr", (qr) => {
  console.log("🔐 امسح رمز QR:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", async () => {
  logMessage("✅ واتساب جاهز");

  // ========== قراءة الملفات ==========
  if (!(await fs.pathExists(ACCOUNTS_FILE))) {
    logMessage("❌ ملف accounts.json غير موجود");
    process.exit(1);
  }
  let numbers = await fs.readJson(ACCOUNTS_FILE);
  if (!Array.isArray(numbers) || numbers.length === 0) {
    logMessage("❌ لا توجد أرقام في accounts.json");
    process.exit(1);
  }

  const cleanNumbers = [...new Set(numbers.map(cleanNumber))];
  logMessage(`📞 عدد الأرقام بعد التنظيف: ${cleanNumbers.length}`);

  // ========== قراءة الرسائل ==========
  let messages = [];
  let messageMode = MESSAGE_MODE;

  // محاولة تحميل message.json أولاً
  if (await fs.pathExists(MESSAGES_FILE)) {
    try {
      const data = await fs.readJson(MESSAGES_FILE);
      if (Array.isArray(data) && data.length > 0) {
        messages = data.filter(msg => typeof msg === "string" && msg.trim().length > 0);
        logMessage(`📝 تم تحميل ${messages.length} رسالة من message.json`);
      } else {
        logMessage(`⚠️ message.json موجود لكنه لا يحتوي على رسائل صالحة، سنحاول استخدام message.txt`);
      }
    } catch (err) {
      logMessage(`⚠️ فشل قراءة message.json: ${err.message}`);
    }
  }

  // إذا لم توجد رسائل من JSON، نقرأ message.txt
  if (messages.length === 0) {
    if (!(await fs.pathExists(MESSAGE_FILE))) {
      logMessage("❌ لا يوجد message.txt ولا message.json صالح");
      process.exit(1);
    }
    const text = await fs.readFile(MESSAGE_FILE, "utf8");
    if (!text.trim()) {
      logMessage("❌ الرسالة فارغة");
      process.exit(1);
    }
    messages = [text.trim()];
    logMessage(`📝 تم تحميل رسالة واحدة من message.txt`);
  }

  // عرض أول 3 رسائل كمثال
  logMessage(`📌 نماذج من الرسائل: ${messages.slice(0, 3).join(" | ")}${messages.length > 3 ? " ..." : ""}`);

  // ========== قراءة قائمة الصور ==========
  let imagePaths = [];
  if (await fs.pathExists(IMAGES_LIST_FILE)) {
    try {
      const data = await fs.readJson(IMAGES_LIST_FILE);
      if (Array.isArray(data) && data.length > 0) {
        imagePaths = data.filter(p => typeof p === "string" && p.trim().length > 0);
        logMessage(`🖼️ تم تحميل ${imagePaths.length} صورة من images.json`);
      } else {
        logMessage(`⚠️ images.json موجود لكن لا يحتوي على صور صالحة`);
      }
    } catch (err) {
      logMessage(`⚠️ فشل قراءة images.json: ${err.message}`);
    }
  } else {
    logMessage(`ℹ️ لا يوجد ملف images.json، سيتم إرسال النص فقط`);
  }

  // ========== تحديد نقطة البداية ==========
  let startIndex = 0;
  if (checkpoint.lastIndex < cleanNumbers.length) {
    startIndex = checkpoint.lastIndex;
    logMessage(`⏩ الاستئناف من الفهرس ${startIndex} (الرقم: ${cleanNumbers[startIndex]})`);
  } else {
    startIndex = 0;
    logMessage(`🔄 بدء من البداية (الفهرس ${startIndex})`);
  }

  // عداد لتوزيع الرسائل بالتتابع (إن اخترنا sequential)
  let messageCounter = 0;

  // ========== الحلقة الرئيسية ==========
  let index = startIndex;
  while (index < cleanNumbers.length) {
    const rawNumber = cleanNumbers[index];
    const chatId = `${rawNumber}@c.us`;

    if (dashboard.sent.includes(rawNumber) || dashboard.failedList.includes(rawNumber)) {
      logMessage(`⏭️ الرقم ${rawNumber} سبق معالجته اليوم، تخطي`);
      index++;
      continue;
    }

    // اختيار الرسالة النصية
    let currentMessage;
    if (messageMode === "random") {
      currentMessage = messages[Math.floor(Math.random() * messages.length)];
    } else { // sequential
      currentMessage = messages[messageCounter % messages.length];
      messageCounter++;
    }

    // اختيار صورة عشوائية (إن وجدت)
    let selectedImagePath = null;
    if (imagePaths.length > 0) {
      selectedImagePath = imagePaths[Math.floor(Math.random() * imagePaths.length)];
    }

    let success = false;
    let attempts = 0;

    while (attempts <= MAX_RETRIES && !success) {
      try {
        const numberId = await client.getNumberId(chatId);
        if (!numberId) {
          logMessage(`⚠️ الرقم ${rawNumber} غير موجود على واتساب`);
          break;
        }

        // إرسال الصورة مع النص إذا وجدت صورة
        if (selectedImagePath) {
          try {
            // المسار الكامل للصورة (نفترض أن المجلد images/ موجود بنفس مستوى السكربت)
            const fullPath = path.join(__dirname, selectedImagePath);
            if (await fs.pathExists(fullPath)) {
              const media = MessageMedia.fromFilePath(fullPath);
              await client.sendMessage(chatId, media, { caption: currentMessage });
              logMessage(`🖼️ تم إرسال صورة + نص إلى ${rawNumber}`);
            } else {
              // إذا لم يكن الملف موجوداً، أرسل النص فقط
              logMessage(`⚠️ الصورة ${selectedImagePath} غير موجودة، إرسال نص فقط`);
              await client.sendMessage(chatId, currentMessage);
            }
          } catch (imgErr) {
            // في حال فشل إرسال الصورة، حاول إرسال النص فقط
            logMessage(`⚠️ فشل إرسال الصورة: ${imgErr.message}، إرسال نص فقط`);
            await client.sendMessage(chatId, currentMessage);
          }
        } else {
          // لا توجد صور، أرسل النص فقط
          await client.sendMessage(chatId, currentMessage);
        }

        success = true;

        dashboard.attempted++;
        dashboard.success++;
        dashboard.sent.push(rawNumber);
        logMessage(`✔ تم الإرسال إلى ${rawNumber} (${currentMessage.substring(0, 30)}...)`);

        checkpoint.lastIndex = index + 1;
        await fs.writeJson(CHECKPOINT_FILE, checkpoint, { spaces: 2 });
        await fs.writeJson(dashboardPath, dashboard, { spaces: 2 });

      } catch (err) {
        attempts++;
        if (attempts <= MAX_RETRIES) {
          logMessage(`🔁 محاولة ${attempts}/${MAX_RETRIES} للرقم ${rawNumber} فشلت: ${err.message}`);
          await wait(RETRY_DELAY);
        } else {
          dashboard.attempted++;
          dashboard.failed++;
          dashboard.failedList.push(rawNumber);
          logMessage(`❌ فشل نهائي للرقم ${rawNumber}: ${err.message}`);
          await fs.writeJson(dashboardPath, dashboard, { spaces: 2 });
        }
      }
    }

    const delay = randomDelay();
    logMessage(`⏳ انتظار ${(delay / 1000).toFixed(1)} ثانية`);
    await wait(delay);
    index++;
  }

  // ========== انتهى الإرسال ==========
  logMessage("🏁 انتهت الحلقة الرئيسية");
  await fs.remove(CHECKPOINT_FILE).catch(() => {});

  // ========== تحديث الـ Aggregate ==========
  try {
    const allDashboards = await fs.readdir(DASHBOARD_DIR);
    const aggregate = [];
    for (const file of allDashboards) {
      if (file.endsWith(".json")) {
        const data = await fs.readJson(path.join(DASHBOARD_DIR, file));
        aggregate.push({
          date: data.date,
          attempted: data.attempted || 0,
          success: data.success || 0,
          failed: data.failed || 0,
        });
      }
    }
    await fs.writeJson(AGGREGATE_FILE, aggregate, { spaces: 2 });
    logMessage("📊 تم تحديث aggregate.json");
  } catch (err) {
    logMessage(`⚠️ فشل تحديث aggregate: ${err.message}`);
  }

  // ========== إرسال التقرير للإدمن ==========
  const report = `
✅ تقرير الإرسال
📅 التاريخ: ${today}
📤 المحاولات: ${dashboard.attempted}
✔ النجاح: ${dashboard.success}
❌ الفشل: ${dashboard.failed}
📌 المرسلة: ${dashboard.sent.length} رقم
❌ الفاشلة: ${dashboard.failedList.join(", ") || "لا يوجد"}
📝 عدد الرسائل المستخدمة: ${messages.length}
🖼️ عدد الصور المتاحة: ${imagePaths.length}
🔄 وضع اختيار الرسالة: ${messageMode}
`;

  const adminChatId = `${ADMIN_NUMBER}@c.us`;
  try {
    const adminId = await client.getNumberId(adminChatId);
    if (!adminId) {
      logMessage(`⚠️ رقم الإدمن ${ADMIN_NUMBER} غير مسجل على واتساب`);
    } else {
      await client.sendMessage(adminChatId, report);
      logMessage("📨 تم إرسال التقرير للإدمن");
    }
  } catch (err) {
    logMessage(`⚠️ فشل إرسال التقرير للإدمن: ${err.message}`);
    await wait(5000);
    try {
      await client.sendMessage(adminChatId, report);
      logMessage("📨 تم إرسال التقرير بعد المحاولة الثانية");
    } catch (err2) {
      logMessage(`⚠️ فشل المحاولة الثانية: ${err2.message}`);
    }
  }

  logMessage("✅ تم إنهاء السكربت بنجاح");
  logStream.end();
  process.exit(0);
});

client.on("disconnected", (reason) => {
  logMessage(`⚠️ تم فصل الاتصال: ${reason}`);
  process.exit(1);
});

client.initialize();
console.log(`🕒 الوقت الحالي: ${new Date().toLocaleTimeString()}`);
