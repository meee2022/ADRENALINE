import { internalMutation } from "./_generated/server";

const MONTH = "2026-08";

const roster: Array<[string, string, number, number]> = [
  ["Abdulrahman", "MD", 6000, 4000],
  ["Abdulla", "Marketing Dept", 1200, 800],
  ["Abeer", "Dietitian", 3600, 2400],
  ["Jimmy Bablin", "Accountant", 2700, 1800],
  ["Zuhair", "Finance", 2400, 1600],
  ["Nader Altay", "Kitchen Supervisor", 1800, 1200],
  ["Abbas", "PRO", 2400, 1600],
  ["Amal Hanan", "Reception", 1500, 1000],
  ["Muhammed Rashed", "Head Chef", 3600, 2400],
  ["Aziz", "Head Chef", 4400, 3600],
  ["Rahil Khan", "Assit. Chef: Subscription", 2100, 1400],
  ["Shariful Islam", "CDP:Subscription", 1500, 1000],
  ["Mosab Eltahir", "CDP: Butchery", 1400, 900],
  ["Iftikhar Hussain", "CDP:Gym+Online+Lusail", 1800, 1200],
  ["Arman Hossan", "Helper: Deserts", 1200, 600],
  ["Shorub Hossan", "Helper: Subscription", 1200, 600],
  ["Mary Wanjiru Kangethe", "Helper: Salads All", 1400, 400],
  ["Saidul Islam Nurul", "Helper:Iftikar", 1200, 600],
  ["Billal Abulbassar", "Helper:Grill + StaffFood", 1200, 600],
  ["Mohamed Wagiealla", "Cleaner: OutSide+Kitchen", 1200, 600],
  ["Nahidul Islam Robin", "Helper:Iftikar", 1000, 600],
  ["Abu Sayed Shakib", "Helper: Subscription", 1000, 600],
  ["Akram Abdulla", "Cleaner: Dishwash", 1000, 600],
  ["Arif Mohammad", "Helper:Iftar", 1000, 600],
  ["Khalid Mirghani", "Store Keeper", 1000, 600],
  ["Bakri Mirghani Mustafa Elhassan", "Cleaner", 1200, 400],
  ["Fakheredin Ashraf Sabir Eisa", "DishWash", 1000, 600],
  ["MD Ratul Islam", "Cleaner", 1000, 400],
  ["Sifatullah", "Helper:Iftikar", 1000, 500],
  ["Md Robin Md Nasir Sheikh", "Helper:Iftikar", 1000, 400],
  ["Moshiur Alam Munna", "Shop", 1200, 800],
  ["Ramsheed Majeed", "Supervisor+Purchasing", 1800, 1200],
  ["Abdelaziz Mohamed", "Driver", 1500, 1000],
  ["Mohanad Elbadwi", "Driver", 1500, 1000],
  ["Siddig Mohamed", "Driver", 1500, 1000],
];

const aliases: Record<string, string> = {
  Jimmy: "Jimmy Bablin", Nadir: "Nader Altay", Hanan: "Amal Hanan", Mosab: "Mosab Eltahir",
  "Arman Hussain": "Arman Hossan", "Shourub Hussain": "Shorub Hossan",
  "Saidul Islam Shiblu": "Saidul Islam Nurul", "Bilal Abdul Basser": "Billal Abulbassar",
  "Mohammed Wagiealla": "Mohamed Wagiealla", Shakib: "Abu Sayed Shakib",
  "Arif Mohamed": "Arif Mohammad", "Arif Mohammed": "Arif Mohammad", "Arif Mphammed": "Arif Mohammad",
  Khalid: "Khalid Mirghani", Munna: "Moshiur Alam Munna", Ramsheed: "Ramsheed Majeed", Siddig: "Siddig Mohamed",
};

function attendanceScore(row: any) {
  return (row.checkIn && row.checkOut ? 100 : row.checkIn || row.checkOut ? 20 : 0)
    + (typeof row.workedHours === "number" ? 10 : 0)
    + Number(row.updatedAt ?? row.createdAt ?? 0) / 1e15;
}

/** Idempotent production migration for the approved August 2026 employee roster. */
export const apply = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let renamedAttendance = 0, mergedAttendance = 0, renamedLeaves = 0, renamedSettings = 0;

    const attendance = await ctx.db.query("attendance").collect();
    for (const row of attendance) {
      const canonical = aliases[row.name];
      if (!canonical) continue;
      const duplicate = await ctx.db.query("attendance").withIndex("by_name_date", (q: any) => q.eq("name", canonical).eq("date", row.date)).first();
      if (duplicate && duplicate._id !== row._id) {
        if (attendanceScore(row) > attendanceScore(duplicate)) {
          await ctx.db.patch(duplicate._id, { ...Object.fromEntries(Object.entries(row).filter(([k]) => !k.startsWith("_"))), name: canonical, updatedAt: now });
        }
        await ctx.db.delete(row._id);
        mergedAttendance++;
      } else {
        await ctx.db.patch(row._id, { name: canonical, updatedAt: now });
        renamedAttendance++;
      }
    }

    for (const row of await ctx.db.query("leaves").collect()) {
      const canonical = aliases[row.name];
      if (canonical) { await ctx.db.patch(row._id, { name: canonical, updatedAt: now }); renamedLeaves++; }
    }
    for (const row of await ctx.db.query("otApprovals").collect()) {
      const canonical = aliases[row.name];
      if (canonical) await ctx.db.patch(row._id, { name: canonical, updatedAt: now });
    }
    for (const row of await ctx.db.query("employeeWorkSettings").collect()) {
      const canonical = aliases[row.name];
      if (!canonical) continue;
      const duplicate = await ctx.db.query("employeeWorkSettings").withIndex("by_name", (q: any) => q.eq("name", canonical)).first();
      if (duplicate && duplicate._id !== row._id) await ctx.db.delete(row._id);
      else await ctx.db.patch(row._id, { name: canonical, updatedAt: now });
      renamedSettings++;
    }

    const monthAttendance = (await ctx.db.query("attendance").withIndex("by_month", (q: any) => q.eq("month", MONTH)).collect());
    const workSettings = await ctx.db.query("employeeWorkSettings").collect();
    const stdHours = new Map(workSettings.map((r: any) => [r.name, Number(r.standardHours) || 9]));
    const settings: any = await ctx.db.query("restaurantSettings").first();
    const otRate = Number(settings?.attendanceOtRate) || 1.5;
    const existing = await ctx.db.query("payroll").withIndex("by_month", (q: any) => q.eq("month", MONTH)).collect();
    let inserted = 0, updated = 0;
    for (let i = 0; i < roster.length; i++) {
      const [name, designation, basic, allowance] = roster[i];
      const att = monthAttendance.filter((r: any) => r.name === name);
      const days = Math.min(31, Math.round(att.reduce((n: number, r: any) => n + (r.status === "present" ? 1 : r.status === "half" ? 0.5 : 0), 0)));
      const otHours = Math.round(att.reduce((n: number, r: any) => n + (Number(r.otHours) || 0), 0) * 100) / 100;
      const overtime = Math.round(otHours * ((basic + allowance) / (30 * (stdHours.get(name) || 9))) * otRate);
      const data = { name, designation, basic, allowance, days, overtime, otHours, advance: 0, paid: 0, month: MONTH, sortOrder: i + 1, updatedAt: now };
      const row = existing.find((r: any) => r.name === name && !r.isVoid);
      if (row) { await ctx.db.patch(row._id, data); updated++; }
      else { await ctx.db.insert("payroll", { ...data, createdAt: now }); inserted++; }
    }
    return { month: MONTH, officialEmployees: roster.length, inserted, updated, renamedAttendance, mergedAttendance, renamedLeaves, renamedSettings };
  },
});
