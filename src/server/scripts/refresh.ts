import { getDashboard } from "../services/dashboard.js";

async function run() {
  const payload = await getDashboard(true);
  console.log(
    JSON.stringify(
      {
        generatedAt: payload.generatedAt,
        people: payload.people.map((person) => ({
          id: person.id,
          theme: person.note.theme,
          status: person.note.snapshot.status
        }))
      },
      null,
      2
    )
  );
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
