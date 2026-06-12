import json, sys
sys.stdout.reconfigure(encoding="utf-8")
with open("schedule_pairs.json", encoding="utf-8") as f:
    data = json.load(f)
lines = ["["]
for r in data:
    pairs_json = json.dumps(r["schedule"])
    lines.append(f'  {{ id: "{r["id"]}", schedule: {pairs_json} }},')
lines.append("]")
print("\n".join(lines))
