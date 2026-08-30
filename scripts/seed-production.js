import { MongoClient } from 'mongodb';

const pad = (value) => String(value).padStart(2, '0');
const formatDateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const formatTime = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB_NAME || 'nexaline';

async function main() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);
    const cycles = db.collection('cycles');
    const pieces = db.collection('pieces');

    const today = new Date();
    today.setHours(6, 0, 0, 0);
    const dayKey = formatDateKey(today);

    await cycles.deleteMany({ date: dayKey });
    await pieces.deleteMany({ date: dayKey });

    const cycleRecords = [];
    const pieceRecords = [];

    for (let i = 0; i < 1000; i += 1) {
      const startedAt = new Date(today.getTime() + i * 8000);
      const duration = Number((7.4 + ((i % 17) * 0.18) + ((i % 5) * 0.03)).toFixed(2));
      const endedAt = new Date(startedAt.getTime() + duration * 1000);
      const shift = endedAt.getHours() >= 14 ? 2 : 1;
      const date = formatDateKey(endedAt);
      const time = formatTime(endedAt);

      cycleRecords.push({
        id: `seed-cycle-${dayKey}-${i}`,
        date,
        time,
        startedAt: startedAt.getTime(),
        endedAt: endedAt.getTime(),
        duration,
        shift,
        above: duration > 7.5,
      });

      pieceRecords.push({
        id: `seed-piece-${dayKey}-${i}`,
        date,
        time,
        ts: endedAt.getTime(),
        shift,
      });
    }

    if (cycleRecords.length) {
      await cycles.insertMany(cycleRecords);
      await pieces.insertMany(pieceRecords);
    }

    const cycleCount = await cycles.countDocuments({ date: dayKey });
    const pieceCount = await pieces.countDocuments({ date: dayKey });

    console.log(JSON.stringify({
      dbName,
      date: dayKey,
      insertedCycles: cycleCount,
      insertedPieces: pieceCount,
      firstStartedAt: cycleRecords[0]?.startedAt,
      lastEndedAt: cycleRecords[cycleRecords.length - 1]?.endedAt,
    }, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
